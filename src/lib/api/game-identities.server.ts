import "server-only";

import { cache } from "react";

import { apiBaseUrl, isRecord } from "@/lib/api/client.server";
import { fetchLeaderboard } from "@/lib/api/games.server";
import { normalizeMember } from "@/lib/api/members";
import { publicMemberHref, publicNickname } from "@/lib/api/public-member";
import { isValidNickname } from "@/lib/games";
import type { GameId, LeaderboardResult, LeaderboardRow, VerifiedPlayerAccount } from "@/lib/games";

// Verified game identities (docs/verified-game-identities.md). The Game API
// vouches for the Anope services account behind a leaderboard row; Laravel maps
// that account to the member bound to the same NickCore
// (user_profiles.irc_account_uniqueid). Nickname equality never counts, and the
// account names stay on this server.
export const IDENTITY_PATH = "/api/internal/games/verified-members";
export const IDENTITY_KEY_HEADER = "X-Chatnet-Games-Identity-Key";
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 2500;
const MIN_KEY_LENGTH = 32;

/** Off unless operators enable it once GameBot and Laravel ship their halves. */
export function identityResolverKey(): string | null {
  if (process.env.GAMES_VERIFIED_AVATARS?.trim().toLowerCase() !== "true") return null;
  const key = process.env.GAMES_IDENTITY_KEY?.trim();
  return key && key.length >= MIN_KEY_LENGTH ? key : null;
}

// Anope compares account names case-insensitively.
const accountKey = (account: string) => account.toLowerCase();

function logResolverFailure(error: unknown): void {
  const reason = error instanceof Error ? error.message : "Unknown error";
  console.warn(`[Chatnet game identities] unavailable: ${reason}`);
}

/**
 * Laravel's answer, keyed by requested account. A member is kept only for an
 * account that was asked for and appears once; anything else is dropped, never
 * guessed. Avatar rules match the /communaute projection.
 */
export function projectVerifiedMembers(value: unknown, requested: readonly string[]): Map<string, VerifiedPlayerAccount> {
  const verified = new Map<string, VerifiedPlayerAccount>();
  if (!isRecord(value) || !Array.isArray(value.members)) throw new Error("Invalid verified members");
  const asked = new Set(requested.map(accountKey));
  const seen = new Set<string>();
  for (const raw of value.members) {
    if (!isRecord(raw) || !isValidNickname(raw.account)) continue;
    const key = accountKey(raw.account);
    if (!asked.has(key)) continue;
    if (seen.has(key)) {
      verified.delete(key);
      continue;
    }
    seen.add(key);
    const member = normalizeMember(raw);
    const nickname = member && publicNickname(member.nickname);
    const profileHref = nickname && publicMemberHref(nickname);
    if (!member || !nickname || !profileHref) continue;
    let avatar = member.avatar;
    if (avatar) {
      const url = new URL(avatar);
      if (avatar.length > 2048 || url.username || url.password) avatar = null;
    }
    verified.set(key, { verified: true, nickname, avatar, profileHref });
  }
  return verified;
}

async function resolveAccounts(accounts: readonly string[], key: string): Promise<Map<string, VerifiedPlayerAccount>> {
  const response = await fetch(`${apiBaseUrl()}${IDENTITY_PATH}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", [IDENTITY_KEY_HEADER]: key },
    body: JSON.stringify({ accounts }),
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return projectVerifiedMembers(await response.json(), accounts);
}

export type VerifiedLeaderboardResult = Exclude<LeaderboardResult, { status: "available" }> | { status: "available"; game: GameId; entries: LeaderboardRow[] };

/**
 * The leaderboard with verified member accounts attached. Rows, ranks and
 * stats are exactly getLeaderboard's; a disabled, failing or slow resolver
 * only leaves every row on its initial-letter avatar.
 */
export const getVerifiedLeaderboard = cache(async (game: GameId): Promise<VerifiedLeaderboardResult> => {
  const board = await fetchLeaderboard(game);
  if (board.status !== "available") return board;
  const entries: LeaderboardRow[] = board.entries.map((entry) => ({ ...entry }));
  const key = identityResolverKey();
  const unique = new Map<string, string>();
  for (const account of board.accounts) if (account && !unique.has(accountKey(account))) unique.set(accountKey(account), account);
  const accounts = [...unique.values()];
  if (!key || !accounts.length) return { status: "available", game, entries };

  try {
    const verified = await resolveAccounts(accounts, key);
    board.accounts.forEach((account, index) => {
      const match = account && verified.get(accountKey(account));
      if (match) entries[index].account = match;
    });
  } catch (error) {
    logResolverFailure(error);
  }
  return { status: "available", game, entries };
});
