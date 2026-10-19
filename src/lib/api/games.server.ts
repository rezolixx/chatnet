import "server-only";

import { cache } from "react";

import { isRecord } from "@/lib/api/client.server";
import { GAME_IDS, isValidNickname, normalizePlayerRouteParam, sameNickname } from "@/lib/games";
import type { GameId, GameStats, LeaderboardEntry, LeaderboardResult, PlayerGameStats, PlayerProfileResult } from "@/lib/games";

// Read-only Game API (game-system apps/api). Called server-side only: the API has
// no CORS and its host must never reach the browser.
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 4000;
export const LEADERBOARD_LIMIT = 50;

type GameApiBase = { status: "configured"; url: string } | { status: "not-configured" } | { status: "invalid" };

export function gameApiBase(): GameApiBase {
  const configured = process.env.GAME_API_BASE_URL?.trim();
  if (!configured) return { status: "not-configured" };
  try {
    const url = new URL(configured);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !local) || url.username || url.password || url.search || url.hash) return { status: "invalid" };
    return { status: "configured", url: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
  } catch {
    return { status: "invalid" };
  }
}

/** Set by operators once GameBot runs in #quiz on the production network. */
export function isQuizOpen(): boolean {
  return process.env.GAMES_QUIZ_OPEN?.trim().toLowerCase() === "true";
}

class GameApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function fetchGameApi(base: string, path: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json", ...headers },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new GameApiError(response.status);
  return response.json() as Promise<unknown>;
}

function logGameApiFailure(dataset: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : "Unknown error";
  console.warn(`[Chatnet Game API] ${dataset} unavailable: ${reason}`);
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function normalizeStats(value: unknown): GameStats | null {
  if (!isRecord(value) || !isCount(value.points) || !isCount(value.gamesPlayed) || !isCount(value.wins)) return null;
  return { points: value.points, gamesPlayed: value.gamesPlayed, wins: value.wins };
}

export function normalizeLeaderboard(value: unknown, game: GameId): LeaderboardEntry[] | null {
  return normalizeLeaderboardWithAccounts(value, game)?.entries ?? null;
}

/**
 * Entries plus, per row, the Anope services account the Game API vouches for
 * (`ircAccount`, docs/verified-game-identities.md), or null. Only the
 * authenticated internal route is read for accounts; they stay on the server
 * as a resolver input and are never part of a LeaderboardEntry, which reaches
 * the browser.
 */
export function normalizeLeaderboardWithAccounts(value: unknown, game: GameId): { entries: LeaderboardEntry[]; accounts: (string | null)[] } | null {
  if (!isRecord(value) || value.game !== game || !Array.isArray(value.entries)) return null;
  const entries: LeaderboardEntry[] = [];
  const accounts: (string | null)[] = [];
  for (const raw of value.entries) {
    const stats = normalizeStats(raw);
    if (!stats || !isRecord(raw) || !isCount(raw.rank) || raw.rank < 1 || !isValidNickname(raw.nickname)) return null;
    // Ranks are consecutive and unique (docs/api.md); anything else is not a ranking we can show.
    if (raw.rank !== entries.length + 1) return null;
    entries.push({ rank: raw.rank, nickname: raw.nickname, ...stats });
    // An absent or malformed account only loses the photo, never the row.
    accounts.push(isValidNickname(raw.ircAccount) ? raw.ircAccount : null);
  }
  return { entries, accounts };
}

// The public route is the only source of displayed rows, ranks and stats. It
// carries no accounts, and any it might carry are dropped here.
export const getLeaderboard = cache(async (game: GameId): Promise<LeaderboardResult> => {
  const base = gameApiBase();
  if (base.status === "not-configured") return { status: "not-configured" };
  if (base.status === "invalid") {
    logGameApiFailure(`leaderboard ${game}`, new Error("Invalid GAME_API_BASE_URL"));
    return { status: "unavailable" };
  }
  try {
    const entries = normalizeLeaderboard(await fetchGameApi(base.url, `/api/leaderboards/${game}?limit=${LEADERBOARD_LIMIT}`), game);
    if (!entries) throw new Error("Invalid leaderboard");
    return { status: "available", game, entries };
  } catch (error) {
    logGameApiFailure(`leaderboard ${game}`, error);
    return { status: "unavailable" };
  }
});

export const INTERNAL_LEADERBOARD_PATH = "/internal/leaderboards";
// The Game API's own rule (isValidInternalToken): 32 to 512 printable ASCII characters, no spaces.
const INTERNAL_TOKEN_PATTERN = /^[\x21-\x7e]{32,512}$/;

/** INTERNAL_GAME_API_TOKEN. Server-only: sent to the Game API and nowhere else, never logged or rendered. */
export function internalGameApiToken(): string | null {
  const token = process.env.INTERNAL_GAME_API_TOKEN?.trim();
  return token && INTERNAL_TOKEN_PATTERN.test(token) ? token : null;
}

export type InternalLeaderboard = { entries: LeaderboardEntry[]; accounts: (string | null)[] };

/**
 * `GET /internal/leaderboards/:game` with the Bearer token: the same ranking as
 * the public route plus each row's verified `ircAccount` (or null). Null when
 * the token is missing or refused (401/404), the API fails or the answer is
 * malformed; callers then keep the public leaderboard without verified photos.
 */
export const fetchInternalLeaderboard = cache(async (game: GameId): Promise<InternalLeaderboard | null> => {
  const base = gameApiBase();
  if (base.status !== "configured") return null;
  const token = internalGameApiToken();
  if (!token) {
    logGameApiFailure(`internal leaderboard ${game}`, new Error("INTERNAL_GAME_API_TOKEN missing or invalid"));
    return null;
  }
  try {
    // Errors carry only the HTTP status: never the token, the header or the body.
    const board = normalizeLeaderboardWithAccounts(await fetchGameApi(base.url, `${INTERNAL_LEADERBOARD_PATH}/${game}?limit=${LEADERBOARD_LIMIT}`, { Authorization: `Bearer ${token}` }), game);
    if (!board) throw new Error("Invalid internal leaderboard");
    return board;
  } catch (error) {
    logGameApiFailure(`internal leaderboard ${game}`, error);
    return null;
  }
});

export const getPlayerProfile = cache(async (routeParam: string): Promise<PlayerProfileResult> => {
  const nickname = normalizePlayerRouteParam(routeParam);
  if (!nickname) return { status: "not-found" };
  const base = gameApiBase();
  if (base.status === "not-configured") return { status: "not-configured" };
  if (base.status === "invalid") {
    logGameApiFailure("player scores", new Error("Invalid GAME_API_BASE_URL"));
    return { status: "unavailable" };
  }

  let response: unknown;
  try {
    response = await fetchGameApi(base.url, `/api/scores/${encodeURIComponent(nickname)}`);
  } catch (error) {
    if (error instanceof GameApiError && (error.status === 404 || error.status === 400)) return { status: "not-found" };
    logGameApiFailure("player scores", error);
    return { status: "unavailable" };
  }

  if (!isRecord(response) || !isValidNickname(response.nickname) || !sameNickname(response.nickname, nickname) || !isRecord(response.scores)) {
    logGameApiFailure("player scores", new Error("Invalid player scores"));
    return { status: "unavailable" };
  }
  const scores = {} as Record<GameId, PlayerGameStats>;
  for (const game of GAME_IDS) {
    const stats = normalizeStats(response.scores[game]);
    if (!stats) {
      logGameApiFailure("player scores", new Error("Invalid player scores"));
      return { status: "unavailable" };
    }
    scores[game] = { ...stats, rank: null };
  }

  // Ranks come only from the published leaderboard (top LEADERBOARD_LIMIT); never computed here.
  const player = response.nickname;
  await Promise.all(GAME_IDS.filter((game) => scores[game].points > 0 || scores[game].gamesPlayed > 0).map(async (game) => {
    const leaderboard = await getLeaderboard(game);
    if (leaderboard.status !== "available") return;
    scores[game].rank = leaderboard.entries.find((entry) => sameNickname(entry.nickname, player))?.rank ?? null;
  }));
  return { status: "found", player: { nickname: player, scores } };
});
