import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { projectOwnProfile } from "@/lib/auth/own-profile";
import { profileUpdateField, safeUpstreamProfileErrors, validateProfileUpdate, type ProfileUpdateErrors } from "@/lib/auth/profile-update";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 2048;

function error(status: number, code: string, message: string, errors?: ProfileUpdateErrors) {
  return NextResponse.json({ code, message, ...(errors ? { errors } : {}) }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED", "Session expirée. Reconnectez-vous.");
  clearBridgeCookies(response);
  return response;
}

function withBridge(response: NextResponse, original: UpstreamCookies, current: UpstreamCookies): NextResponse {
  if (current.session !== original.session || current.xsrf !== original.xsrf) setBridgeCookies(response, current);
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

export async function PUT(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();
  let saved = false;
  let currentCookies = cookies;

  try {
    const verified = await laravelMe(cookies);
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return error(503, "UNAVAILABLE", "Profil temporairement indisponible.");
    const user = projectSafeUser(await verified.response.json());
    if (!user) return error(503, "UNAVAILABLE", "Profil temporairement indisponible.");
    if (request.headers.get("x-chatnet-profile-nickname") !== user.nickname) {
      return withBridge(error(409, "STALE_PROFILE", "La session a changé. Rechargez le profil."), cookies, verified.cookies);
    }

    let value: unknown;
    try { value = await readLimitedJson(request); }
    catch { return error(400, "INVALID_INPUT", "Requête invalide."); }
    const { input, errors } = validateProfileUpdate(value);
    if (!input) return error(422, "VALIDATION_ERROR", "Vérifiez le champ à modifier.", errors);
    const field = profileUpdateField(input);

    const refreshed = await csrfCookies(verified.cookies);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return error(503, "UNAVAILABLE", "Mise à jour temporairement indisponible.");
    const upstream = await fetchLaravel(field === "birthdate" ? "/api/update-birthdate" : "/api/update-pays", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20000),
    });
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    const updated = completeUpstreamCookies(mergeUpstreamCookies(refreshed, upstream.headers)) ?? refreshed;
    currentCookies = updated;
    if (upstream.status === 422) {
      const raw: unknown = await upstream.json().catch(() => null);
      return withBridge(error(422, "VALIDATION_ERROR", "Vérifiez le champ à modifier.", safeUpstreamProfileErrors(raw, field)), cookies, updated);
    }
    if (upstream.status === 429) return withBridge(error(429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard."), cookies, updated);
    if (!upstream.ok) return withBridge(error(503, "UNAVAILABLE", "Mise à jour temporairement indisponible."), cookies, updated);
    saved = true;

    const latest = await laravelMe(updated);
    currentCookies = latest.cookies;
    if (latest.response.status === 401 || latest.response.status === 419) return unauthenticated();
    if (!latest.response.ok) return withBridge(error(503, "REFRESH_UNAVAILABLE", "Modification enregistrée. Rechargez le profil pour voir le résultat."), cookies, updated);
    const me: unknown = await latest.response.json();
    const currentUser = projectSafeUser(me);
    if (!currentUser || currentUser.nickname !== user.nickname) return error(503, "UNAVAILABLE", "Profil temporairement indisponible.");
    const member = await fetchLaravel(`/api/members/${encodeURIComponent(user.nickname)}`, {
      headers: { Cookie: upstreamCookieHeader(latest.cookies) },
    });
    if (member.status === 401 || member.status === 419) return unauthenticated();
    if (!member.ok) return withBridge(error(503, "REFRESH_UNAVAILABLE", "Modification enregistrée. Rechargez le profil pour voir le résultat."), cookies, latest.cookies);
    const profile = projectOwnProfile(me, await member.json(), user.nickname);
    const expected = "birthdate" in input ? input.birthdate : input.pays;
    if (!profile || profile[field] !== expected) return withBridge(error(503, "REFRESH_UNAVAILABLE", "Modification enregistrée. Rechargez le profil pour voir le résultat."), cookies, latest.cookies);
    const response = NextResponse.json({ profile }, { headers: noStore });
    const finalCookies = completeUpstreamCookies(mergeUpstreamCookies(latest.cookies, member.headers)) ?? latest.cookies;
    return withBridge(response, cookies, finalCookies);
  } catch {
    return saved
      ? withBridge(error(503, "REFRESH_UNAVAILABLE", "Modification enregistrée. Rechargez le profil pour voir le résultat."), cookies, currentCookies)
      : error(503, "UNAVAILABLE", "Mise à jour temporairement indisponible.");
  }
}
