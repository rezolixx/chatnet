import "server-only";

import { cache } from "react";

import { apiBaseUrl, isRecord } from "@/lib/api/client.server";
import { fetchInternalLeaderboard, getLeaderboard } from "@/lib/api/games.server";
import type { InternalLeaderboard } from "@/lib/api/games.server";
import { normalizeMember } from "@/lib/api/members";
import { publicMemberHref, publicNickname } from "@/lib/api/public-member";
import { isValidNickname, sameNickname } from "@/lib/games";
import type { CurrentNicknameOwner, GameId, LeaderboardEntry, LeaderboardResult, LeaderboardRow, PlayerIdentity, VerifiedPlayerAccount } from "@/lib/games";

// Verified game identities (docs/verified-game-identities.md). The internal,
// authenticated Game API route vouches for the Anope services account behind a
// leaderboard row; Laravel maps
// that account to the member bound to the same NickCore
// (user_profiles.irc_account_uniqueid). Nickname equality never counts, and the
// account names stay on this server.
export const IDENTITY_PATH = "/api/internal/games/verified-members";
// Separately, and only as "the profile currently associated with this
// registered IRC nickname", never as the author of its points.
export const NICKNAME_OWNERS_PATH = "/api/internal/games/nickname-owners";
export const IDENTITY_KEY_HEADER = "X-Chatnet-Games-Identity-Key";
export const NICKNAME_OWNER_ASSOCIATION = "registered_nickname_current";
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 2500;
const MIN_KEY_LENGTH = 32;
// Laravel's limit per nickname-owners request; a leaderboard shows at most 50 rows.
const MAX_NICKNAMES = 50;

function identityKey(): string | null {
  const key = process.env.GAMES_IDENTITY_KEY?.trim();
  return key && key.length >= MIN_KEY_LENGTH ? key : null;
}

/**
 * Off unless operators enable it. When off, neither the internal Game API nor
 * Laravel is called. It also needs INTERNAL_GAME_API_TOKEN to find any account.
 */
export function identityResolverKey(): string | null {
  return process.env.GAMES_VERIFIED_AVATARS?.trim().toLowerCase() === "true" ? identityKey() : null;
}

/**
 * GAMES_CURRENT_NICKNAME_AVATARS, separate from GAMES_VERIFIED_AVATARS and off
 * unless operators enable it. When off, Laravel's nickname-owners endpoint is
 * never called. It uses the same GAMES_IDENTITY_KEY.
 */
export function nicknameOwnersKey(): string | null {
  return process.env.GAMES_CURRENT_NICKNAME_AVATARS?.trim().toLowerCase() === "true" ? identityKey() : null;
}

// Anope compares account names case-insensitively.
const accountKey = (account: string) => account.toLowerCase();
// Anope, UnrealIRCd and the Game System fold nicknames with ASCII case
// mapping; valid nicknames are ASCII only.
const nicknameKey = (nickname: string) => nickname.toLowerCase();

// Logs name the failure (HTTP status, timeout), never a key, an account or a nickname.
function logResolverFailure(error: unknown, dataset?: string): void {
  const reason = error instanceof Error ? error.message : "Unknown error";
  console.warn(`[Chatnet game identities] ${dataset ? `${dataset} ` : ""}unavailable: ${reason}`);
}

/** The public part of a Laravel member: nickname, avatar and profile link. Avatar rules match the /communaute projection. */
function projectMemberLink(raw: unknown): { nickname: string; avatar: string | null; profileHref: string } | null {
  const member = normalizeMember(raw);
  const nickname = member && publicNickname(member.nickname);
  const profileHref = nickname && publicMemberHref(nickname);
  if (!member || !nickname || !profileHref) return null;
  let avatar = member.avatar;
  if (avatar) {
    const url = new URL(avatar);
    if (avatar.length > 2048 || url.username || url.password) avatar = null;
  }
  return { nickname, avatar, profileHref };
}

/**
 * Laravel's answer, keyed by requested account. A member is kept only for an
 * account that was asked for and appears once; anything else is dropped, never
 * guessed.
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
    const member = projectMemberLink(raw);
    if (member) verified.set(key, { verified: true, ...member });
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

const ENTRY_KEYS = new Set(["nickname", "member", "association"]);
const MEMBER_KEYS = new Set(["nickname", "avatar"]);
const onlyKeys = (value: Record<string, unknown>, allowed: Set<string>) => Object.keys(value).every((key) => allowed.has(key));

/**
 * Laravel's nickname-owners answer, keyed by requested nickname (ASCII case
 * folded). An entry is kept only when it repeats a spelling that was sent,
 * appears once, says `association: "registered_nickname_current"` and carries
 * nothing but a public member nickname and avatar. Anything else is dropped,
 * never guessed; a malformed envelope throws.
 */
export function projectNicknameOwners(value: unknown, requested: readonly string[]): Map<string, CurrentNicknameOwner> {
  const owners = new Map<string, CurrentNicknameOwner>();
  if (!isRecord(value) || !Array.isArray(value.nicknames)) throw new Error("Invalid nickname owners");
  const asked = new Set(requested);
  const seen = new Set<string>();
  for (const raw of value.nicknames) {
    if (!isRecord(raw) || !isValidNickname(raw.nickname) || !asked.has(raw.nickname)) continue;
    const key = nicknameKey(raw.nickname);
    if (seen.has(key)) {
      owners.delete(key);
      continue;
    }
    seen.add(key);
    if (raw.association !== NICKNAME_OWNER_ASSOCIATION || !onlyKeys(raw, ENTRY_KEYS) || !isRecord(raw.member) || !onlyKeys(raw.member, MEMBER_KEYS)) continue;
    const member = projectMemberLink(raw.member);
    if (member) owners.set(key, { verified: false, association: NICKNAME_OWNER_ASSOCIATION, ...member });
  }
  return owners;
}

/**
 * The members who currently own these registered nicknames, from Laravel's
 * authenticated nickname-owners endpoint. Empty when the flag is off, and on
 * 401, 404, 429, 503, a timeout or a malformed answer.
 *
 * Never cached beyond the current render: the fetch sets no `cache` or
 * `next.revalidate`, so at runtime Next treats it as "auto no cache" (nothing
 * written to the Data Cache, and the ISR page stays static). The only reuse is
 * the rendered page itself, for its revalidate window.
 */
export async function fetchNicknameOwners(nicknames: readonly string[]): Promise<Map<string, CurrentNicknameOwner>> {
  const key = nicknameOwnersKey();
  if (!key) return new Map();
  const unique = new Map<string, string>();
  for (const nickname of nicknames) if (isValidNickname(nickname) && !unique.has(nicknameKey(nickname))) unique.set(nicknameKey(nickname), nickname);
  const requested = [...unique.values()].slice(0, MAX_NICKNAMES);
  if (!requested.length) return new Map();
  try {
    const response = await fetch(`${apiBaseUrl()}${NICKNAME_OWNERS_PATH}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", [IDENTITY_KEY_HEADER]: key },
      body: JSON.stringify({ nicknames: requested }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return projectNicknameOwners(await response.json(), requested);
  } catch (error) {
    logResolverFailure(error, "nickname owners");
    return new Map();
  }
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
 * The public leaderboard plus, per row, the verified member behind its points,
 * or null. Accounts come only from the authenticated internal Game API. A
 * disabled flag, a missing or refused token, or a failing, slow or malformed
 * internal API or resolver leaves every row null.
 */
const verifyRowAccounts = cache(async (game: GameId): Promise<{ board: LeaderboardResult; accounts: (VerifiedPlayerAccount | null)[] }> => {
  const key = identityResolverKey();
  const [board, internal] = await Promise.all([getLeaderboard(game), key ? fetchInternalLeaderboard(game) : null]);
  if (board.status !== "available") return { board, accounts: [] };
  const none = board.entries.map(() => null);
  if (!key || !internal) return { board, accounts: none };

  const rowAccounts = alignAccounts(board.entries, internal);
  const unique = new Map<string, string>();
  for (const account of rowAccounts) if (account && !unique.has(accountKey(account))) unique.set(accountKey(account), account);
  const accounts = [...unique.values()];
  if (!accounts.length) return { board, accounts: none };

  try {
    const verified = await resolveAccounts(accounts, key);
    return { board, accounts: rowAccounts.map((account) => (account && verified.get(accountKey(account))) || null) };
  } catch (error) {
    logResolverFailure(error);
    return { board, accounts: none };
  }
});

/** A verified account always wins; otherwise the current owner of the registered nickname, if any. */
function identityFor(nickname: string, account: VerifiedPlayerAccount | null, owners: ReadonlyMap<string, CurrentNicknameOwner>): PlayerIdentity {
  if (account) return { account };
  const nicknameOwner = owners.get(nicknameKey(nickname));
  return nicknameOwner ? { nicknameOwner } : {};
}

async function boardNicknameOwners(game: GameId): Promise<Map<string, CurrentNicknameOwner>> {
  if (!nicknameOwnersKey()) return new Map();
  const board = await getLeaderboard(game);
  return board.status === "available" ? fetchNicknameOwners(board.entries.map((entry) => entry.nickname)) : new Map();
}

/**
 * The public leaderboard with member identities attached. Rows, ranks and
 * stats are exactly getLeaderboard's and are never changed, merged or
 * reassigned. A row whose points the internal Game API proves (verified score
 * provenance) gets `account`; any other row whose nickname a member currently
 * owns gets `nicknameOwner`, which says nothing about who scored. Every failure
 * only leaves rows on their initial-letter avatar.
 */
export const getVerifiedLeaderboard = cache(async (game: GameId): Promise<VerifiedLeaderboardResult> => {
  // Both lookups run in parallel; precedence is applied per row.
  const [{ board, accounts }, owners] = await Promise.all([verifyRowAccounts(game), boardNicknameOwners(game)]);
  if (board.status !== "available") return board;
  const entries: LeaderboardRow[] = board.entries.map((entry, index) => ({ ...entry, ...identityFor(entry.nickname, accounts[index] ?? null, owners) }));
  return { status: "available", game, entries };
});

/**
 * The identity shown on a player page (`/jeux/joueurs/[pseudo]`), for the
 * nickname the Game API returned. Verified score provenance comes from that
 * player's row on the Quiz leaderboard, the only board with verified accounts;
 * otherwise the current owner of the registered nickname, when that flag is on.
 */
export const getPlayerIdentity = cache(async (nickname: string): Promise<PlayerIdentity> => {
  if (!isValidNickname(nickname)) return {};
  const [verified, owners] = await Promise.all([identityResolverKey() ? verifyRowAccounts("quiz") : null, fetchNicknameOwners([nickname])]);
  const index = verified?.board.status === "available" ? verified.board.entries.findIndex((entry) => sameNickname(entry.nickname, nickname)) : -1;
  return identityFor(nickname, verified?.accounts[index] ?? null, owners);
});
