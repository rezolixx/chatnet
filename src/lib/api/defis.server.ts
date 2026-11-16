import "server-only";

import { cache } from "react";

import { isRecord } from "@/lib/api/client.server";
import { gameApiBase } from "@/lib/api/games.server";
import { isValidNickname } from "@/lib/games";

/**
 * Défis du jour (DefisBot, #defis): public Game API routes only (chatnet-game-system
 * docs/api.md § Défis). Server-side: the Game API host never reaches the browser. Nothing here
 * is ever inferred: a missing, failing or malformed answer is "unavailable", never "online".
 */

const REVALIDATE_SECONDS = 30;
const TIMEOUT_MS = 4000;
export const DEFIS_LEADERBOARD_LIMIT = 10;
export const DEFIS_PERIODS = ["day", "month", "all"] as const;
export type DefisPeriod = (typeof DEFIS_PERIODS)[number];

export type DefisAvailability = "available" | "paused" | "stopped" | "degraded" | "offline";

export type DefisStatusResult =
  | { status: "not-configured" }
  | { status: "unavailable" }
  | { status: "known"; availability: DefisAvailability; available: boolean; nextOpensAt: string | null };

export interface DefisChallengeView {
  kindLabel: string;
  difficulty: "facile" | "moyen" | "difficile";
  title: string | null;
  prompt: string;
  opensAt: string;
  closesAt: string;
  solves: number;
}

export type DefisCurrentResult =
  | { status: "not-configured" }
  | { status: "unavailable" }
  | { status: "known"; challenge: DefisChallengeView | null; nextOpensAt: string | null };

export interface DefisLeaderboardEntry {
  rank: number;
  nickname: string;
  points: number;
  solves: number;
}

export type DefisLeaderboardResult =
  | { status: "not-configured" }
  | { status: "unavailable" }
  | { status: "available"; period: DefisPeriod; entries: DefisLeaderboardEntry[] };

const AVAILABILITIES: readonly DefisAvailability[] = ["available", "paused", "stopped", "degraded", "offline"];
const DIFFICULTIES = ["facile", "moyen", "difficile"] as const;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isInstant = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
const isLine = (value: unknown, max: number): value is string => typeof value === "string" && value.trim() !== "" && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

async function getJson(path: string): Promise<unknown> {
  const base = gameApiBase();
  if (base.status !== "configured") throw new Error(base.status);
  const response = await fetch(`${base.url}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

function failure(dataset: string, error: unknown): { status: "not-configured" } | { status: "unavailable" } {
  if (error instanceof Error && error.message === "not-configured") return { status: "not-configured" };
  console.warn(`[Chatnet Game API] Défis ${dataset} unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
  return { status: "unavailable" };
}

export function normalizeDefisStatus(value: unknown): DefisStatusResult | null {
  if (!isRecord(value) || value.game !== "defis" || typeof value.available !== "boolean" || !AVAILABILITIES.includes(value.status as DefisAvailability)) return null;
  // "available" must agree with the status: anything inconsistent is not trusted.
  if (value.available !== (value.status === "available")) return null;
  return {
    status: "known",
    availability: value.status as DefisAvailability,
    available: value.available,
    nextOpensAt: isInstant(value.nextOpensAt) ? value.nextOpensAt : null,
  };
}

export function normalizeDefisCurrent(value: unknown): DefisCurrentResult | null {
  if (!isRecord(value) || value.game !== "defis") return null;
  const raw = value.challenge;
  let challenge: DefisChallengeView | null = null;
  if (raw !== null) {
    if (!isRecord(raw) || !isLine(raw.kindLabel, 40) || !DIFFICULTIES.includes(raw.difficulty as (typeof DIFFICULTIES)[number]) ||
        !isLine(raw.prompt, 400) || !(raw.title === null || isLine(raw.title, 80)) || !isInstant(raw.opensAt) || !isInstant(raw.closesAt) || !isCount(raw.solves)) {
      return null;
    }
    challenge = {
      kindLabel: raw.kindLabel, difficulty: raw.difficulty as DefisChallengeView["difficulty"], title: raw.title as string | null,
      prompt: raw.prompt, opensAt: raw.opensAt, closesAt: raw.closesAt, solves: raw.solves,
    };
  }
  return { status: "known", challenge, nextOpensAt: isInstant(value.nextOpensAt) ? value.nextOpensAt : null };
}

export function normalizeDefisLeaderboard(value: unknown, period: DefisPeriod): DefisLeaderboardEntry[] | null {
  if (!isRecord(value) || value.game !== "defis" || value.period !== period || !Array.isArray(value.entries)) return null;
  const entries: DefisLeaderboardEntry[] = [];
  for (const raw of value.entries) {
    if (!isRecord(raw) || raw.rank !== entries.length + 1 || !isValidNickname(raw.nickname) || !isCount(raw.points) || !isCount(raw.solves)) return null;
    entries.push({ rank: raw.rank, nickname: raw.nickname, points: raw.points, solves: raw.solves });
  }
  return entries;
}

export const getDefisStatus = cache(async (): Promise<DefisStatusResult> => {
  try {
    const status = normalizeDefisStatus(await getJson("/api/defis/status"));
    if (!status) throw new Error("Invalid status");
    return status;
  } catch (error) {
    return failure("status", error);
  }
});

export const getDefisCurrent = cache(async (): Promise<DefisCurrentResult> => {
  try {
    const current = normalizeDefisCurrent(await getJson("/api/defis/current"));
    if (!current) throw new Error("Invalid current challenge");
    return current;
  } catch (error) {
    return failure("current", error);
  }
});

export const getDefisLeaderboard = cache(async (period: DefisPeriod): Promise<DefisLeaderboardResult> => {
  try {
    const entries = normalizeDefisLeaderboard(await getJson(`/api/defis/leaderboards/${period}?limit=${DEFIS_LEADERBOARD_LIMIT}`), period);
    if (!entries) throw new Error("Invalid leaderboard");
    return { status: "available", period, entries };
  } catch (error) {
    return failure(`leaderboard ${period}`, error);
  }
});

/** The card and page status: "Disponible dans le chat" only on a verified live bot. */
export function defisGameStatus(result: DefisStatusResult): { label: string; tone: "live" | "soon" | "planned" } {
  if (result.status === "not-configured") return { label: "Ouverture prochaine", tone: "soon" };
  if (result.status === "unavailable") return { label: "Momentanément indisponible", tone: "planned" };
  switch (result.availability) {
    case "available": return { label: "Disponible dans le chat", tone: "live" };
    case "paused": return { label: "En pause", tone: "soon" };
    default: return { label: "Momentanément indisponible", tone: "planned" };
  }
}
