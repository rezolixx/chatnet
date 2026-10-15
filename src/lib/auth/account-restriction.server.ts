import "server-only";

import { NextResponse } from "next/server";
import { accountRefusalBody, accountRefusalStatus, isAccountRestriction, readAccountRefusal } from "./account-restriction";
import { clearBridgeCookies } from "./cookies.server";

// Laravel's Ban / Suspension refusal of a member request, relayed to the
// browser with its public fields only (code, kind, public reason, end date),
// or null for any other answer. A restriction ends the member session on the
// API side, so the bridge cookies are cleared too; an unreadable restriction
// state (503) refuses this request only and keeps the session.
export async function accountRefusalResponse(upstream: Response): Promise<NextResponse | null> {
  const refusal = await readAccountRefusal(upstream);
  if (!refusal) return null;
  const response = NextResponse.json(accountRefusalBody(refusal), { status: accountRefusalStatus(refusal), headers: { "Cache-Control": "no-store" } });
  if (isAccountRestriction(refusal)) clearBridgeCookies(response);
  return response;
}
