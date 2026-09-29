import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, readBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 403, headers: noStore });
  const current = readBridgeCookies(request);
  let upstreamUnavailable = false;

  if (current) {
    try {
      const refreshed = await csrfCookies(current);
      const xsrf = refreshed && xsrfHeader(refreshed);
      if (!refreshed || !xsrf) upstreamUnavailable = true;
      else {
        const result = await fetchLaravel("/api/logout", {
          method: "POST",
          headers: { Cookie: upstreamCookieHeader(refreshed), "X-XSRF-TOKEN": xsrf },
        });
        if (!result.ok && result.status !== 401 && result.status !== 419) upstreamUnavailable = true;
      }
    } catch { upstreamUnavailable = true; }
  }

  const response = upstreamUnavailable
    ? NextResponse.json({ code: "UNAVAILABLE", message: "Déconnexion temporairement indisponible." }, { status: 503, headers: noStore })
    : NextResponse.json({ success: true }, { headers: noStore });
  clearBridgeCookies(response);
  return response;
}
