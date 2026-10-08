import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, mergeUpstreamCookies, completeUpstreamCookies, readBridgeCookies, setBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { PROFILE_BIRTHDATE_INVALID } from "@/lib/auth/age-policy";
import { hasIncompleteChatFields, hasRefusedBirthdate, projectChatProfile } from "@/lib/auth/chat-profile";
import { fetchLaravel, laravelMe, projectSafeUser } from "@/lib/auth/laravel.server";

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
    const user = projectSafeUser(await verified.response.json());
    if (!user) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });

    const member = await fetchLaravel(`/api/members/${encodeURIComponent(user.nickname)}`, {
      headers: { Cookie: upstreamCookieHeader(verified.cookies) },
    });
    if (member.status === 401 || member.status === 419) return unauthenticated();
    if (!member.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const raw: unknown = await member.json();
    const profile = projectChatProfile(raw, user.nickname);
    // Age policy: the member is asked to correct the birthdate, never told the profile is "unavailable".
    if (!profile && hasRefusedBirthdate(raw, user.nickname)) return NextResponse.json({ code: PROFILE_BIRTHDATE_INVALID }, { status: 422, headers: noStore });
    // Gender or country unusable: to complete, not a temporary failure.
    if (!profile && hasIncompleteChatFields(raw, user.nickname)) return NextResponse.json({ code: "PROFILE_INCOMPLETE" }, { status: 422, headers: noStore });
    if (!profile) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });

    const response = NextResponse.json({ profile }, { headers: noStore });
    const updated = completeUpstreamCookies(mergeUpstreamCookies(verified.cookies, member.headers));
    if (updated && (updated.session !== cookies.session || updated.xsrf !== cookies.xsrf)) setBridgeCookies(response, updated);
    return response;
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
