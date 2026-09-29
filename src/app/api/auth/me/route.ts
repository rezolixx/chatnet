import { NextRequest, NextResponse } from "next/server";
import { clearBridgeCookies, readBridgeCookies, setBridgeCookies } from "@/lib/auth/cookies.server";
import { laravelMe, projectSafeUser } from "@/lib/auth/laravel.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const cookies = readBridgeCookies(request);
  if (!cookies) return NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 401, headers: noStore });

  try {
    const upstream = await laravelMe(cookies);
    if (upstream.response.status === 401 || upstream.response.status === 419) {
      const response = NextResponse.json({ code: "AUTH_REQUIRED" }, { status: 401, headers: noStore });
      clearBridgeCookies(response);
      return response;
    }
    if (!upstream.response.ok) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const user = projectSafeUser(await upstream.response.json());
    if (!user) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
    const response = NextResponse.json({ user }, { headers: noStore });
    if (upstream.cookies.session !== cookies.session || upstream.cookies.xsrf !== cookies.xsrf) setBridgeCookies(response, upstream.cookies);
    return response;
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
