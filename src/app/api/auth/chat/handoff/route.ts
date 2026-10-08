import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { PROFILE_BIRTHDATE_INVALID } from "@/lib/auth/age-policy";
import { hasRefusedBirthdate, projectChatProfile } from "@/lib/auth/chat-profile";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { DEFAULT_CHAT_ROOM, isChatHandoffCode, MAX_HANDOFF_EXPIRES_IN } from "@/lib/chat-handoff";
import { roomJoinName } from "@/lib/rooms";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };
const maxBytes = 1024;
// Laravel refusals kept as-is: the browser then tries the legacy chat entry
// (never for PROFILE_BIRTHDATE_INVALID, handled first).
const refusals = new Map([
  [403, "CHAT_HANDOFF_REFUSED"],
  [404, "CHAT_HANDOFF_UNAVAILABLE"],
  [409, "CHAT_ACCOUNT_UNAVAILABLE"],
  [422, "CHAT_DESTINATION_REFUSED"],
  [429, "RATE_LIMITED"],
]);

function error(status: number, code: string) {
  return NextResponse.json({ code }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED");
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

async function isBirthdateRefusal(response: Response): Promise<boolean> {
  const body: unknown = await response.json().catch(() => null);
  return Boolean(body) && typeof body === "object" && (body as Record<string, unknown>).code === PROFILE_BIRTHDATE_INVALID;
}

function projectHandoff(value: unknown): { handoff: string; expires_in?: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!isChatHandoffCode(data.handoff)) return null;
  if (data.expires_in === undefined) return { handoff: data.handoff };
  const expiresIn = data.expires_in;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > MAX_HANDOFF_EXPIRES_IN) return null;
  return { handoff: data.handoff, expires_in: expiresIn };
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();

  let input: unknown;
  try { input = await readLimitedJson(request); }
  catch { return error(400, "INVALID_INPUT"); }
  // Only the room comes from the browser; age, gender and country are read server-side.
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => key !== "room")) return error(400, "INVALID_INPUT");
  const requested = (input as { room?: unknown }).room;
  const room = requested === undefined ? DEFAULT_CHAT_ROOM : roomJoinName(requested);
  if (!room) return error(400, "INVALID_ROOM");

  let current = cookies;
  try {
    const verified = await laravelMe(cookies);
    current = verified.cookies;
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return withBridge(error(503, "UNAVAILABLE"), cookies, current);
    const user = projectSafeUser(await verified.response.json());
    if (!user) return withBridge(error(503, "UNAVAILABLE"), cookies, current);

    const member = await fetchLaravel(`/api/members/${encodeURIComponent(user.nickname)}`, {
      headers: { Cookie: upstreamCookieHeader(current) },
    });
    if (member.status === 401 || member.status === 419) return unauthenticated();
    current = completeUpstreamCookies(mergeUpstreamCookies(current, member.headers)) ?? current;
    if (!member.ok) return withBridge(error(503, "UNAVAILABLE"), cookies, current);
    const raw: unknown = await member.json();
    const profile = projectChatProfile(raw, user.nickname);
    // Age policy: no handoff and no legacy fallback until the birthdate is corrected.
    if (!profile && hasRefusedBirthdate(raw, user.nickname)) return withBridge(error(422, PROFILE_BIRTHDATE_INVALID), cookies, current);
    if (!profile) return withBridge(error(503, "UNAVAILABLE"), cookies, current);

    const refreshed = await csrfCookies(current);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return withBridge(error(503, "UNAVAILABLE"), cookies, current);
    current = refreshed;
    const upstream = await fetchLaravel("/api/chat/identity/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify({ age: profile.age, sexe: profile.gender === "Homme" ? "M" : "F", ville: profile.pays, room }),
      redirect: "error",
    });
    if (upstream.status === 401 || upstream.status === 419) return unauthenticated();
    current = completeUpstreamCookies(mergeUpstreamCookies(refreshed, upstream.headers)) ?? refreshed;
    // Laravel's own age policy refusal (e.g. the date changed meanwhile): only its fixed code is forwarded.
    if (upstream.status === 422 && await isBirthdateRefusal(upstream)) return withBridge(error(422, PROFILE_BIRTHDATE_INVALID), cookies, current);
    const refusal = refusals.get(upstream.status);
    if (refusal) return withBridge(error(upstream.status, refusal), cookies, current);
    if (upstream.status !== 200) return withBridge(error(503, "UNAVAILABLE"), cookies, current);
    // Only the one-time code and its lifetime reach the browser, never a raw body.
    const handoff = projectHandoff(await upstream.json().catch(() => null));
    if (!handoff) return withBridge(error(502, "UNAVAILABLE"), cookies, current);
    return withBridge(NextResponse.json(handoff, { headers: noStore }), cookies, current);
  } catch {
    return withBridge(error(503, "UNAVAILABLE"), cookies, current);
  }
}
