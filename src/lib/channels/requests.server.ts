import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { accountRefusalResponse } from "@/lib/auth/account-restriction.server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { projectChannelRequestAck, projectOwnChannelRequests, safeChannelRequestErrors, validateChannelRequestInput, validChannelRequestId } from "@/lib/channels/requests";

type RequestMethod = "GET" | "POST" | "PUT";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 4096;
const unavailable = "Le service de demande de salon est momentanément indisponible.";

function error(status: number, code: string, message: string, errors?: ReturnType<typeof safeChannelRequestErrors>) {
  return NextResponse.json({ code, message, ...(errors && Object.keys(errors).length ? { errors } : {}) }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED", "Connectez-vous pour demander un salon.");
  clearBridgeCookies(response);
  return response;
}

function withBridge(response: NextResponse, previous: UpstreamCookies, current: UpstreamCookies) {
  if (current.session !== previous.session || current.xsrf !== previous.xsrf) setBridgeCookies(response, current);
  return response;
}

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("Too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined));
}

export async function handleChannelRequests(request: NextRequest, method: RequestMethod, id?: string): Promise<NextResponse> {
  if (method !== "GET" && !hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  if (method === "PUT" && (!id || !validChannelRequestId(id))) return error(404, "NOT_FOUND", "Demande introuvable.");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();

  let input: ReturnType<typeof validateChannelRequestInput>["input"];
  if (method !== "GET") {
    let value: unknown;
    try { value = await readLimitedJson(request); }
    catch { return error(400, "INVALID_INPUT", "Formulaire invalide."); }
    const checked = validateChannelRequestInput(value);
    if (!checked.input) return error(Object.keys(checked.errors).length ? 422 : 400, "INVALID_INPUT", "Vérifiez les champs du formulaire.", checked.errors);
    input = checked.input;
  }

  let current = cookies;
  try {
    const verified = await laravelMe(cookies, request);
    current = verified.cookies;
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    const verifiedRefusal = await accountRefusalResponse(verified.response);
    if (verifiedRefusal) return verifiedRefusal;
    if (!verified.response.ok || !projectSafeUser(await verified.response.json().catch(() => null))) {
      return withBridge(error(503, "UNAVAILABLE", unavailable), cookies, current);
    }

    let headers: HeadersInit = { Cookie: upstreamCookieHeader(current) };
    if (method !== "GET") {
      const refreshed = await csrfCookies(current, request);
      const xsrf = refreshed && xsrfHeader(refreshed);
      if (!refreshed || !xsrf) return withBridge(error(503, "UNAVAILABLE", unavailable), cookies, current);
      current = refreshed;
      headers = { Cookie: upstreamCookieHeader(current), "Content-Type": "application/json", "X-XSRF-TOKEN": xsrf };
    }
    const path = method === "PUT" ? `/api/channel-requests/${id}` : "/api/channel-requests";
    const upstream = await fetchLaravel(path, {
      method,
      headers,
      ...(input ? { body: JSON.stringify(input) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    }, request);
    current = completeUpstreamCookies(mergeUpstreamCookies(current, upstream.headers)) ?? current;
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    const refusal = await accountRefusalResponse(upstream);
    if (refusal) return refusal;
    if (upstream.status === 404) return withBridge(method === "PUT"
      ? error(404, "NOT_FOUND", "Demande introuvable ou plus modifiable.")
      : error(404, "FEATURE_UNAVAILABLE", "Les demandes de salons ne sont pas encore ouvertes."), cookies, current);
    if (upstream.status === 403) return withBridge(error(403, "IDENTITY_REQUIRED", "Un compte NickServ vérifié et lié à votre profil est nécessaire."), cookies, current);
    if (upstream.status === 409) return withBridge(error(409, "CONFLICT", "Le nom est déjà pris, ou cette demande ne peut plus être modifiée."), cookies, current);
    if (upstream.status === 422) {
      const errors = safeChannelRequestErrors(await upstream.json().catch(() => null));
      return withBridge(error(422, "VALIDATION_ERROR", "Vérifiez les informations de votre demande.", errors), cookies, current);
    }
    if (upstream.status === 429) return withBridge(error(429, "RATE_LIMITED", "Deux demandes en cours maximum par membre. Réessayez plus tard."), cookies, current);

    if (method === "GET") {
      if (upstream.status !== 200) return withBridge(error(503, "UNAVAILABLE", unavailable), cookies, current);
      const requests = projectOwnChannelRequests(await upstream.json().catch(() => null));
      return withBridge(requests === null ? error(503, "UNAVAILABLE", unavailable) : NextResponse.json({ requests }, { headers: noStore }), cookies, current);
    }

    if (upstream.status !== (method === "POST" ? 201 : 200)) return withBridge(error(503, "UNAVAILABLE", unavailable), cookies, current);
    const acknowledgement = projectChannelRequestAck(await upstream.json().catch(() => null));
    if (!acknowledgement) return withBridge(error(503, "UNAVAILABLE", "Envoi non confirmé. Consultez vos demandes avant de réessayer."), cookies, current);
    return withBridge(NextResponse.json(acknowledgement, { status: method === "POST" ? 201 : 200, headers: noStore }), cookies, current);
  } catch {
    return withBridge(error(503, "UNAVAILABLE", "Opération non confirmée. Consultez vos demandes avant de réessayer."), cookies, current);
  }
}
