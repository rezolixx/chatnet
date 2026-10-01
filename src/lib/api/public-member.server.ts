import "server-only";

import { fetchApi } from "./client.server";
import { projectPublicMember, publicNickname, type PublicMemberProfile } from "./public-member";

export type PublicMemberResult = { status: "found"; member: PublicMemberProfile } | { status: "not-found" | "unavailable" };

export async function getPublicMember(value: unknown): Promise<PublicMemberResult> {
  const nickname = publicNickname(value);
  if (!nickname) return { status: "not-found" };
  try {
    // Public endpoint only: no bridge cookies, tokens, /api/me or session headers.
    const raw = await fetchApi(`/api/members/${encodeURIComponent(nickname)}`, 0);
    const member = projectPublicMember(raw, nickname);
    return member ? { status: "found", member } : { status: "unavailable" };
  } catch (error) {
    return { status: error instanceof Error && error.message === "HTTP 404" ? "not-found" : "unavailable" };
  }
}
