import "server-only";

import { completeUpstreamCookies, mergeUpstreamCookies, upstreamCookieHeader, type UpstreamCookies } from "./cookies.server";
import type { SafeUser } from "./types";

const BASE_URL = "https://laravel.discut.org";
const upstreamHeaders = {
  Accept: "application/json",
  Origin: "https://chatnet.fr",
  "X-Requested-With": "XMLHttpRequest",
};

export async function fetchLaravel(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(upstreamHeaders)) headers.set(name, value);
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

export async function csrfCookies(current?: UpstreamCookies): Promise<UpstreamCookies | null> {
  const response = await fetchLaravel("/sanctum/csrf-cookie", {
    headers: current ? { Cookie: upstreamCookieHeader(current) } : undefined,
  });
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

export async function laravelMe(cookies: UpstreamCookies): Promise<{ response: Response; cookies: UpstreamCookies }> {
  const response = await fetchLaravel("/api/me", { headers: { Cookie: upstreamCookieHeader(cookies) } });
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
