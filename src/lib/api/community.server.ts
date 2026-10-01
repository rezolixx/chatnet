import "server-only";

import { unstable_cache } from "next/cache";
import { apiBaseUrl, fetchApi, isRecord, logApiFailure } from "@/lib/api/client.server";
import type { LaravelMemberPage, PublicOnlineMember } from "@/lib/api/types";
import { normalizeMember } from "./members";

export { normalizeMember } from "./members";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const MEMBER_REVALIDATE_SECONDS = 15;
const MAX_MEMBER_PAGES = 12;
const ONLINE_MEMBERS_PER_PAGE = 15;
export const MAX_CHATNET_PAGE = Math.ceil(MAX_MEMBER_PAGES * 10 / ONLINE_MEMBERS_PER_PAGE);

function isOnline(lastSeen: unknown, now: number): boolean {
  if (typeof lastSeen !== "string" || !lastSeen.trim()) return false;
  // Discut's dayjs.utc(last_seen_at) treats Laravel's timezone-less timestamps as UTC.
  const timestamp = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(lastSeen) ? lastSeen : `${lastSeen.replace(" ", "T")}Z`);
  return Number.isFinite(timestamp) && now - timestamp < ONLINE_THRESHOLD_MS;
}

async function collectOnlineMembers(target: number): Promise<{ members: PublicOnlineMember[]; failed: boolean }> {
  const candidates: { member: PublicOnlineMember; lastSeen: unknown }[] = [];
  const now = Date.now();

  for (let pageNumber = 1; pageNumber <= MAX_MEMBER_PAGES && candidates.length < target; pageNumber++) {
    try {
      const response = await fetchApi(`/api/members?page=${pageNumber}`, 0);
      if (!isRecord(response) || !Array.isArray(response.data)) throw new Error("Invalid member page");

      const page: LaravelMemberPage = { data: response.data, last_page: response.last_page };
      let reachedOffline = false;
      for (const value of page.data) {
        if (!isRecord(value) || !isOnline(value.last_seen_at, now)) {
          reachedOffline = true;
          continue;
        }
        const member = normalizeMember(value);
        if (member) candidates.push({ member: { ...member, online: true }, lastSeen: value.last_seen_at });
        if (candidates.length === target) break;
      }

      // Laravel orders by last_seen_at descending, so later pages cannot be online.
      if (reachedOffline) break;
      if (page.data.length === 0 || (typeof page.last_page === "number" && pageNumber >= page.last_page)) break;
    } catch (error) {
      logApiFailure("members", error);
      return { members: [], failed: true };
    }
  }

  // Recheck after all backend requests in case a candidate aged out during collection.
  const members = candidates.filter(({ lastSeen }) => isOnline(lastSeen, Date.now())).map(({ member }) => member);
  return { members, failed: false };
}

const cachedOnlineMembers = unstable_cache(collectOnlineMembers, ["chatnet-online-members", apiBaseUrl()], { revalidate: MEMBER_REVALIDATE_SECONDS });

export async function getPublicOnlineMembers(limit = 3): Promise<PublicOnlineMember[]> {
  const target = Math.max(0, Math.min(limit, 10));
  if (!target) return [];
  const result = await cachedOnlineMembers(target);
  return result.members;
}

export async function getOnlineMemberPage(pageNumber: number) {
  const start = (pageNumber - 1) * ONLINE_MEMBERS_PER_PAGE;
  const result = await cachedOnlineMembers(start + ONLINE_MEMBERS_PER_PAGE + 1);
  return {
    members: result.members.slice(start, start + ONLINE_MEMBERS_PER_PAGE),
    hasNext: result.members.length > start + ONLINE_MEMBERS_PER_PAGE,
    lastAvailablePage: Math.max(1, Math.ceil(result.members.length / ONLINE_MEMBERS_PER_PAGE)),
    failed: result.failed,
  };
}
