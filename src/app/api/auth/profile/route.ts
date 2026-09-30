import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, completeUpstreamCookies, mergeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { fetchLaravel, laravelMe, projectSafeUser } from "@/lib/auth/laravel.server";
import { projectOwnProfile } from "@/lib/auth/own-profile";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

function unauthenticated() {
  const response = NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 401, headers: noStore });
  clearBridgeCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const cookies = readBridgeCookies(request);
  if (!cookies) return unauthenticated();
  try {
    const verified = await laravelMe(cookies);
    if (verified.response.status === 401 || verified.response.status === 419) return unauthenticated();
    if (!verified.response.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const me: unknown = await verified.response.json();
    const user = projectSafeUser(me);
    if (!user) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });

    // /api/me is authoritative; the request never supplies a member identity.
    const member = await fetchLaravel(`/api/members/${encodeURIComponent(user.nickname)}`, {
      headers: { Cookie: upstreamCookieHeader(verified.cookies) },
    });
    if (member.status === 401 || member.status === 419) return unauthenticated();
    if (!member.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const profile = projectOwnProfile(me, await member.json(), user.nickname);
    if (!profile) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const response = NextResponse.json({ profile }, { headers: noStore });
    const updated = completeUpstreamCookies(mergeUpstreamCookies(verified.cookies, member.headers));
    if (updated && (updated.session !== cookies.session || updated.xsrf !== cookies.xsrf)) setBridgeCookies(response, updated);
    return response;
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
