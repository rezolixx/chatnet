import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader, type UpstreamCookies } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { accountDeletionMessages, deletionOutcomeFromUpstream, validateDeletionInput, type AccountDeletionErrors } from "@/lib/auth/account-deletion";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 8192;
// Laravel drops every NickServ alias in turn, each bounded by its XML-RPC timeout.
const deletionTimeoutMs = 90000;

function error(status: number, code: string, message: string, errors?: AccountDeletionErrors) {
  return NextResponse.json({ code, message, ...(errors ? { errors } : {}) }, { status, headers: noStore });
}

function unauthenticated() {
  const response = error(401, "AUTH_REQUIRED", accountDeletionMessages.expired);
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

// The member's own deletion, relayed to Laravel with their session. The
// answer is Laravel's outcome as fixed codes; "deleted" only when Laravel
// confirmed it, and the bridge session ends with the account.
export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();

  let value: unknown;
  try { value = await readLimitedJson(request); }
  catch { return error(400, "INVALID_INPUT", "Requête invalide."); }
  const checked = validateDeletionInput(value);
  if (!checked.input) {
    const invalidShape = Object.keys(checked.errors).length === 0;
    return error(invalidShape ? 400 : 422, invalidShape ? "INVALID_INPUT" : "VALIDATION_ERROR", invalidShape ? "Requête invalide." : "Vérifiez les champs du formulaire.", checked.errors);
  }

  let currentCookies = cookies;
  let submitted = false;
  try {
    const verified = await laravelMe(cookies);
    currentCookies = verified.cookies;
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return withBridge(error(503, "UNAVAILABLE", accountDeletionMessages.unavailable), cookies, currentCookies);
    const user = projectSafeUser(await verified.response.json());
    if (!user) return error(503, "UNAVAILABLE", accountDeletionMessages.unavailable);
    // The account shown on the page must be the session's: never delete another one.
    if (request.headers.get("x-chatnet-profile-nickname") !== user.nickname) {
      return withBridge(error(409, "STALE_PROFILE", accountDeletionMessages.stale), cookies, currentCookies);
    }

    const refreshed = await csrfCookies(currentCookies);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return withBridge(error(503, "UNAVAILABLE", accountDeletionMessages.unavailable), cookies, currentCookies);
    currentCookies = refreshed;
    submitted = true;
    const upstream = await fetchLaravel("/api/delete-account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify(checked.input),
      redirect: "error",
      signal: AbortSignal.timeout(deletionTimeoutMs),
    });
    const outcome = deletionOutcomeFromUpstream(upstream.status, await upstream.json().catch(() => null));
    if (outcome.deleted) {
      // Laravel ended the session together with the account.
      const response = NextResponse.json({ deleted: true, pending: outcome.pending, irc: outcome.irc }, { headers: noStore });
      clearBridgeCookies(response);
      return response;
    }
    if (outcome.status === 401) return unauthenticated();
    currentCookies = completeUpstreamCookies(mergeUpstreamCookies(refreshed, upstream.headers)) ?? refreshed;
    return withBridge(error(outcome.status, outcome.code, outcome.message, outcome.field ? { [outcome.field]: outcome.message } : undefined), cookies, currentCookies);
  } catch {
    // Sent but unanswered (timeout, network): Laravel may have deleted it.
    return withBridge(error(503, submitted ? "UNCONFIRMED" : "UNAVAILABLE", submitted ? accountDeletionMessages.unconfirmed : accountDeletionMessages.unavailable), cookies, currentCookies);
  }
}
