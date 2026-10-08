import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { passwordPolicyError, safePasswordErrors, validatePasswordInput, type PasswordErrors } from "@/lib/auth/password";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 8192;

function error(status: number, code: string, message: string, errors?: PasswordErrors) {
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
  const checked = validatePasswordInput(value);
  if (!checked.input) {
    const invalidFields = Object.keys(checked.errors).length === 0;
    return error(invalidFields ? 400 : 422, invalidFields ? "INVALID_INPUT" : "VALIDATION_ERROR", "Vérifiez les champs du formulaire.", checked.errors);
  }

  let currentCookies = cookies;
  let saved = false;
  let submitted = false;
  try {
    const verified = await laravelMe(cookies);
    currentCookies = verified.cookies;
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return withBridge(error(503, "UNAVAILABLE", "Modification temporairement indisponible."), cookies, currentCookies);
    const user = projectSafeUser(await verified.response.json());
    if (!user) return error(503, "UNAVAILABLE", "Modification temporairement indisponible.");
    if (request.headers.get("x-chatnet-profile-nickname") !== user.nickname) {
      return withBridge(error(409, "STALE_PROFILE", "La session a changé. Rechargez le profil."), cookies, currentCookies);
    }
    const nicknameError = passwordPolicyError(checked.input.new_password, user.nickname);
    if (nicknameError) return withBridge(error(422, "VALIDATION_ERROR", "Vérifiez le nouveau mot de passe.", { new_password: nicknameError }), cookies, currentCookies);

    const refreshed = await csrfCookies(currentCookies);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return withBridge(error(503, "UNAVAILABLE", "Modification temporairement indisponible."), cookies, currentCookies);
    currentCookies = refreshed;
    submitted = true;
    const upstream = await fetchLaravel("/api/update-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify(checked.input),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    currentCookies = completeUpstreamCookies(mergeUpstreamCookies(refreshed, upstream.headers)) ?? refreshed;
    if (upstream.status === 422) {
      const raw: unknown = await upstream.json().catch(() => null);
      return withBridge(error(422, "VALIDATION_ERROR", "Vérifiez le nouveau mot de passe.", safePasswordErrors(raw)), cookies, currentCookies);
    }
    if (upstream.status === 429) return withBridge(error(429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard."), cookies, currentCookies);
    if (upstream.status !== 200) return withBridge(error(503, "UNAVAILABLE", "Modification non confirmée. Vérifiez vos accès avant de réessayer."), cookies, currentCookies);
    // The audited contract confirms success with HTTP 200; never expose its body.
    saved = true;

    const latest = await laravelMe(currentCookies);
    currentCookies = latest.cookies;
    if (latest.response.status === 401 || latest.response.status === 419) {
      const response = NextResponse.json({ changed: true, session: "expired" }, { headers: noStore });
      clearBridgeCookies(response);
      return response;
    }
    const active = latest.response.ok && projectSafeUser(await latest.response.json().catch(() => null))?.nickname === user.nickname;
    return withBridge(NextResponse.json({ changed: true, session: active ? "active" : "unverified" }, { headers: noStore }), cookies, currentCookies);
  } catch {
    if (saved) return withBridge(NextResponse.json({ changed: true, session: "unverified" }, { headers: noStore }), cookies, currentCookies);
    return withBridge(error(503, "UNAVAILABLE", submitted ? "Modification non confirmée. Vérifiez vos accès avant de réessayer." : "Modification temporairement indisponible."), cookies, currentCookies);
  }
}
