import "server-only";

import { isIP } from "node:net";
import { completeUpstreamCookies, mergeUpstreamCookies, upstreamCookieHeader, type UpstreamCookies } from "./cookies.server";
import type { SafeUser } from "./types";

const BASE_URL = "https://laravel.discut.org";
const upstreamHeaders = {
  Accept: "application/json",
  Origin: "https://chatnet.fr",
  "X-Requested-With": "XMLHttpRequest",
};

// Every bridge request reaches Laravel from this server's single address, so
// Laravel's per-address limits (5 logins a minute) would be shared by every
// visitor. With the shared secret, Laravel keys them on the visitor instead.
const VISITOR_ADDRESS_HEADER = "X-Discut-Client-IP";
const VISITOR_ADDRESS_KEY_HEADER = "X-Discut-Client-IP-Key";

// The Coolify edge proxy replaces any X-Forwarded-For sent by the browser with
// the address it received the connection from (www.chatnet.fr only redirects
// to the apex, so visitors reach the edge directly). The last entry is the one
// the edge wrote, should it ever append instead.
export function visitorAddress(request: Request): string | null {
  const address = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return address && isIP(address) ? address : null;
}

function visitorAddressHeaders(client: Request | undefined): Record<string, string> {
  const secret = process.env.CHATNET_CLIENT_IP_SECRET;
  const address = client ? visitorAddress(client) : null;
  if (!address || !secret || secret.length < 32) return {};
  return { [VISITOR_ADDRESS_HEADER]: address, [VISITOR_ADDRESS_KEY_HEADER]: secret };
}

// `client` is the incoming visitor request, for routes Laravel rate-limits per
// address (sign-in, registration, session check).
export async function fetchLaravel(path: string, init: RequestInit = {}, client?: Request): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.delete(VISITOR_ADDRESS_HEADER);
  headers.delete(VISITOR_ADDRESS_KEY_HEADER);
  for (const [name, value] of Object.entries({ ...upstreamHeaders, ...visitorAddressHeaders(client) })) headers.set(name, value);
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
}

export async function csrfCookies(current?: UpstreamCookies, client?: Request): Promise<UpstreamCookies | null> {
  const response = await fetchLaravel("/sanctum/csrf-cookie", {
    headers: current ? { Cookie: upstreamCookieHeader(current) } : undefined,
  }, client);
  if (response.status !== 204) return null;
  return completeUpstreamCookies(mergeUpstreamCookies(current ?? {}, response.headers));
}

export function xsrfHeader(cookies: UpstreamCookies): string | null {
  try {
    return decodeURIComponent(cookies.xsrf);
  } catch {
    return null;
  }
}

export async function laravelMe(cookies: UpstreamCookies, client?: Request): Promise<{ response: Response; cookies: UpstreamCookies }> {
  const response = await fetchLaravel("/api/me", { headers: { Cookie: upstreamCookieHeader(cookies) } }, client);
  const updated = completeUpstreamCookies(mergeUpstreamCookies(cookies, response.headers));
  return { response, cookies: updated ?? cookies };
}

function optionalText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

export function projectSafeUser(value: unknown): SafeUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const nickname = optionalText(raw.nickname, 80);
  if (!nickname) return null;
  const avatar = optionalText(raw.avatar, 2048);
  let safeAvatar: string | null = null;
  if (avatar) {
    try {
      const url = new URL(avatar);
      if (url.protocol === "https:" || url.protocol === "http:") safeAvatar = url.toString();
    } catch { /* Invalid avatar is omitted. */ }
  }
  return {
    nickname,
    avatar: safeAvatar,
    pays: optionalText(raw.pays, 120),
    description: optionalText(raw.description, 1000),
    inscritDepuis: optionalText(raw.inscritDepuis, 40),
  };
}
