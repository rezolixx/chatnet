import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { contactIdentity, contactUnavailableMessage, safeContactErrors, validateContactInput, type ContactErrors } from "@/lib/support/contact";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 32768;

function error(status: number, code: string, message: string, errors?: ContactErrors) {
  return NextResponse.json({ code, message, ...(errors ? { errors } : {}) }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED", "Session expirée. Reconnectez-vous.");
  clearBridgeCookies(response);
  return response;
}

function withBridge(response: NextResponse, original: UpstreamCookies, current: UpstreamCookies) {
  if (original.session !== current.session || original.xsrf !== current.xsrf) setBridgeCookies(response, current);
  return response;
}

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("Input too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Input too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();
  let value: unknown;
  try { value = await readLimitedJson(request); }
  catch { return error(400, "INVALID_INPUT", "Requête invalide."); }
  const checked = validateContactInput(value);
  if (!checked.input) {
    const invalidFields = Object.keys(checked.errors).length === 0;
    return error(invalidFields ? 400 : 422, invalidFields ? "INVALID_INPUT" : "VALIDATION_ERROR", "Vérifiez les champs du formulaire.", checked.errors);
  }

  let current = cookies;
  try {
    const verified = await laravelMe(cookies);
    current = verified.cookies;
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return withBridge(error(503, "UNAVAILABLE", contactUnavailableMessage), cookies, current);
    const identity = contactIdentity(await verified.response.json());
    if (!identity) return withBridge(error(503, "UNAVAILABLE", "Les informations de votre compte ne permettent pas l’envoi. Veuillez réessayer plus tard."), cookies, current);

    const refreshed = await csrfCookies(current);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return withBridge(error(503, "UNAVAILABLE", contactUnavailableMessage), cookies, current);
    current = refreshed;
    const upstream = await fetchLaravel("/api/contact-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(current), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify({ name: identity.name, email: identity.email, subject: checked.input.subject, message: checked.input.message }),
      redirect: "error",
    });
    current = completeUpstreamCookies(mergeUpstreamCookies(current, upstream.headers)) ?? current;
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    if (upstream.status === 201) {
      // HTTP 201 is the audited acknowledgement. Do not read or return its body.
      return withBridge(NextResponse.json({ sent: true }, { status: 201, headers: noStore }), cookies, current);
    }
    if (upstream.status === 422) {
      const errors = safeContactErrors(await upstream.json().catch(() => null));
      return withBridge(error(422, "VALIDATION_ERROR", Object.keys(errors).length ? "Vérifiez les champs du formulaire." : "L’envoi est impossible avec les informations de votre compte. Veuillez réessayer plus tard.", errors), cookies, current);
    }
    if (upstream.status === 429) return withBridge(error(429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard."), cookies, current);
    return withBridge(error(upstream.status === 500 ? 500 : 503, "UNAVAILABLE", contactUnavailableMessage), cookies, current);
  } catch {
    // A failed/expired request is never automatically resubmitted.
    return withBridge(error(503, "UNAVAILABLE", contactUnavailableMessage), cookies, current);
  }
}
