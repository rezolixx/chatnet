import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { PROFILE_BIRTHDATE_INVALID } from "@/lib/auth/age-policy";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function unauthenticated() {
  const response = NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 401, headers: noStore });
  clearBridgeCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 403, headers: noStore });
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();

  try {
    const verified = await laravelMe(cookies);
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const user = projectSafeUser(await verified.response.json());
    if (!user) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });

    const refreshed = await csrfCookies(verified.cookies);
    const xsrf = refreshed && xsrfHeader(refreshed);
    if (!refreshed || !xsrf) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const prepared = await fetchLaravel("/api/chat/prepare", {
      method: "POST",
      headers: { Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
    });
    if (prepared.status === 401 || prepared.status === 419) return unauthenticated();
    // Age policy refusal: only Laravel's fixed code is forwarded, never its body.
    if (prepared.status === 422) {
      const refusal: unknown = await prepared.json().catch(() => null);
      if (refusal && typeof refusal === "object" && (refusal as Record<string, unknown>).code === PROFILE_BIRTHDATE_INVALID) {
        return NextResponse.json({ code: PROFILE_BIRTHDATE_INVALID }, { status: 422, headers: noStore });
      }
    }
    if (!prepared.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const raw: unknown = await prepared.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const data = raw as Record<string, unknown>;
    if (typeof data.token !== "string" || !data.token.trim() || (data.nickname !== undefined && data.nickname !== user.nickname)) {
      return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    }
    const result: { token: string; nickname: string; ticket?: string; expires_in?: number } = { token: data.token, nickname: user.nickname };
    if (typeof data.ticket === "string" && data.ticket.trim()) result.ticket = data.ticket;
    if (typeof data.expires_in === "number" && Number.isFinite(data.expires_in) && data.expires_in > 0) result.expires_in = data.expires_in;
    const response = NextResponse.json(result, { headers: noStore });
    const updated = completeUpstreamCookies(mergeUpstreamCookies(refreshed, prepared.headers));
    if (updated && (updated.session !== cookies.session || updated.xsrf !== cookies.xsrf)) setBridgeCookies(response, updated);
    return response;
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
