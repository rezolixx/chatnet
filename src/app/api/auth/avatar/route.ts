import { NextRequest, NextResponse } from "next/server";
import { AVATAR_MAX_REQUEST_BYTES, avatarValidationError, projectUploadedAvatar } from "@/lib/auth/avatar";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED", "Session expirée. Reconnectez-vous.");
  clearBridgeCookies(response);
  return response;
}

async function readAvatar(request: NextRequest): Promise<File | null> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) return null;
  if (Number(request.headers.get("content-length")) > AVATAR_MAX_REQUEST_BYTES) throw new RangeError("Upload too large");
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AVATAR_MAX_REQUEST_BYTES) throw new RangeError("Upload too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": contentType }, body: bytes.buffer }).formData();
  if ([...form.keys()].some((key) => key !== "avatar") || form.getAll("avatar").length !== 1) return null;
  const avatar = form.get("avatar");
  return avatar instanceof File ? avatar : null;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();

  try {
    const verified = await laravelMe(cookies);
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok || !projectSafeUser(await verified.response.json())) return error(503, "UNAVAILABLE", "Envoi temporairement indisponible.");

    let avatar: File | null;
    try { avatar = await readAvatar(request); }
    catch (cause) {
      return cause instanceof RangeError
        ? error(413, "FILE_TOO_LARGE", "L’image doit faire au maximum 4 Mo.")
        : error(400, "INVALID_INPUT", "Fichier invalide.");
    }
    const validation = avatarValidationError(avatar);
    if (validation) return error(422, "VALIDATION_ERROR", validation);

    const refreshed = await csrfCookies(verified.cookies);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return error(503, "UNAVAILABLE", "Envoi temporairement indisponible.");
    const body = new FormData();
    body.set("avatar", avatar!);
    const upstream = await fetchLaravel("/api/upload-avatar", {
      method: "POST",
      headers: { Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    if (upstream.status === 422) return error(422, "VALIDATION_ERROR", "L’image doit être au format JPEG, PNG, GIF ou WebP et faire au maximum 4 Mo.");
    if (upstream.status === 429) return error(429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard.");
    if (!upstream.ok) return error(503, "UNAVAILABLE", "Envoi temporairement indisponible.");
    const avatarUrl = projectUploadedAvatar(await upstream.json());
    if (!avatarUrl) return error(503, "UNAVAILABLE", "Envoi temporairement indisponible.");
    const response = NextResponse.json({ avatar: avatarUrl }, { headers: noStore });
    const updated = completeUpstreamCookies(mergeUpstreamCookies(refreshed, upstream.headers));
    if (updated && (updated.session !== cookies.session || updated.xsrf !== cookies.xsrf)) setBridgeCookies(response, updated);
    return response;
  } catch {
    return error(503, "UNAVAILABLE", "Envoi temporairement indisponible.");
  }
}
