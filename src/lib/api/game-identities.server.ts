import "server-only";

import { cache } from "react";

import { apiBaseUrl, isRecord } from "@/lib/api/client.server";
import { fetchInternalLeaderboard, getLeaderboard } from "@/lib/api/games.server";
import type { InternalLeaderboard } from "@/lib/api/games.server";
import { normalizeMember } from "@/lib/api/members";
import { publicMemberHref, publicNickname } from "@/lib/api/public-member";
import { isValidNickname } from "@/lib/games";
import type { GameId, LeaderboardEntry, LeaderboardResult, LeaderboardRow, VerifiedPlayerAccount } from "@/lib/games";

// Verified game identities (docs/verified-game-identities.md). The internal,
// authenticated Game API route vouches for the Anope services account behind a
// leaderboard row; Laravel maps
// that account to the member bound to the same NickCore
// (user_profiles.irc_account_uniqueid). Nickname equality never counts, and the
// account names stay on this server.
export const IDENTITY_PATH = "/api/internal/games/verified-members";
export const IDENTITY_KEY_HEADER = "X-Chatnet-Games-Identity-Key";
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 2500;
const MIN_KEY_LENGTH = 32;

/**
 * Off unless operators enable it. When off, neither the internal Game API nor
 * Laravel is called. It also needs INTERNAL_GAME_API_TOKEN to find any account.
 */
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

const sameRow = (a: LeaderboardEntry, b: LeaderboardEntry) =>
  a.rank === b.rank && a.nickname === b.nickname && a.points === b.points && a.gamesPlayed === b.gamesPlayed && a.wins === b.wins;

/**
 * Per public row, the account the internal leaderboard vouches for, or null.
 * The two boards are separate requests, so a score landing in between can
 * shift rows: an account is only kept for a row whose rank, nickname and stats
 * are identical on both. Anything else stays unverified rather than guessed.
 */
export function alignAccounts(publicEntries: readonly LeaderboardEntry[], internal: InternalLeaderboard | null): (string | null)[] {
  return publicEntries.map((entry, index) => {
    const twin = internal?.entries[index];
    return twin && sameRow(entry, twin) ? internal.accounts[index] ?? null : null;
  });
}

export type VerifiedLeaderboardResult = Exclude<LeaderboardResult, { status: "available" }> | { status: "available"; game: GameId; entries: LeaderboardRow[] };

/**
 * The public leaderboard with verified member accounts attached. Rows, ranks
 * and stats are exactly getLeaderboard's; accounts come only from the
 * authenticated internal Game API. A disabled flag, a missing or refused token,
 * or a failing, slow or malformed internal API or resolver only leaves every
 * row on its initial-letter avatar.
 */
export const getVerifiedLeaderboard = cache(async (game: GameId): Promise<VerifiedLeaderboardResult> => {
  const key = identityResolverKey();
  const [board, internal] = await Promise.all([getLeaderboard(game), key ? fetchInternalLeaderboard(game) : null]);
  if (board.status !== "available") return board;
  const entries: LeaderboardRow[] = board.entries.map((entry) => ({ ...entry }));
  if (!key || !internal) return { status: "available", game, entries };

  const rowAccounts = alignAccounts(board.entries, internal);
  const unique = new Map<string, string>();
  for (const account of rowAccounts) if (account && !unique.has(accountKey(account))) unique.set(accountKey(account), account);
  const accounts = [...unique.values()];
  if (!accounts.length) return { status: "available", game, entries };

  try {
    const verified = await resolveAccounts(accounts, key);
    rowAccounts.forEach((account, index) => {
      const match = account && verified.get(accountKey(account));
      if (match) entries[index].account = match;
    });
  } catch (error) {
    logResolverFailure(error);
  }
  return { status: "available", game, entries };
});
