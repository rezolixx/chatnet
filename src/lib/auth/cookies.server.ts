import "server-only";

import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "chatnet_upstream_session";
export const XSRF_COOKIE = "chatnet_upstream_xsrf";

export type UpstreamCookies = { session: string; xsrf: string };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function readBridgeCookies(request: NextRequest): UpstreamCookies | null {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const xsrf = request.cookies.get(XSRF_COOKIE)?.value;
  return session && xsrf ? { session, xsrf } : null;
}

export function setBridgeCookies(response: NextResponse, cookies: UpstreamCookies): void {
  response.cookies.set(SESSION_COOKIE, cookies.session, cookieOptions);
  response.cookies.set(XSRF_COOKIE, cookies.xsrf, cookieOptions);
}

export function clearBridgeCookies(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(XSRF_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export function upstreamCookieHeader(cookies: UpstreamCookies): string {
  return `XSRF-TOKEN=${cookies.xsrf}; laravel_session=${cookies.session}`;
}

function setCookieLines(headers: Headers): string[] {
  const multi = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (multi?.length) return multi;
  const combined = headers.get("set-cookie");
  // A comma in Expires is followed by a date, not a cookie name and '='.
  return combined ? combined.split(/,(?=\s*[!#$%&'*+.^_`|~\w-]+=)/) : [];
}

export function mergeUpstreamCookies(current: Partial<UpstreamCookies>, headers: Headers): Partial<UpstreamCookies> {
  const next = { ...current };
  for (const line of setCookieLines(headers)) {
    const match = /^\s*(XSRF-TOKEN|laravel_session)=([^;]*)/.exec(line);
    if (!match) continue;
    if (match[1] === "XSRF-TOKEN") next.xsrf = match[2];
    else next.session = match[2];
  }
  return next;
}

export function completeUpstreamCookies(value: Partial<UpstreamCookies>): UpstreamCookies | null {
  return value.session && value.xsrf ? { session: value.session, xsrf: value.xsrf } : null;
}
