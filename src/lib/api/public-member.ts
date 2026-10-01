import { normalizeMember } from "./members.ts";
import type { PublicMember } from "./types";

export type PublicMemberProfile = PublicMember & { age: number | null; gender: string | null; pays: string | null };

// This is a bounded public lookup segment, not a new registration rule.
// Preserve legacy names/case; Laravel trims and matches case-insensitively.
export function publicNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const nickname = value.trim();
  if (!nickname || Array.from(nickname).length > 50 || nickname === "." || nickname === ".." || /[\p{Cc}\p{Cf}\p{Cs}/\\%?#]/u.test(nickname)) return null;
  return nickname;
}

export function publicMemberHref(value: unknown): string | null {
  const nickname = publicNickname(value);
  return nickname ? `/membre/${encodeURIComponent(nickname)}` : null;
}

function publicText(value: unknown, limit: number): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= limit && !/[\p{Cc}\p{Cf}]/u.test(value) ? value.trim() : null;
}

function publicAge(value: unknown, now: Date): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== value || !Number.isFinite(now.getTime())) return null;
  const month = birth.getUTCMonth();
  // Like Discut's dayjs.diff(..., 'year'), clamp Feb 29 to Feb 28 in non-leap years.
  const anniversaryDay = Math.min(birth.getUTCDate(), new Date(Date.UTC(now.getUTCFullYear(), month + 1, 0)).getUTCDate());
  const age = now.getUTCFullYear() - birth.getUTCFullYear() - (now.getUTCMonth() < month || (now.getUTCMonth() === month && now.getUTCDate() < anniversaryDay) ? 1 : 0);
  return age >= 0 ? age : null;
}

export function projectPublicMember(value: unknown, requestedNickname: string, now = new Date()): PublicMemberProfile | null {
  const requested = publicNickname(requestedNickname);
  const member = normalizeMember(value);
  const nickname = member && publicNickname(member.nickname);
  if (!requested || !member || !nickname || nickname.toLowerCase() !== requested.toLowerCase()) return null;
  const raw = value as Record<string, unknown>;
  let avatar = member.avatar;
  if (avatar) {
    const url = new URL(avatar);
    if (avatar.length > 2048 || url.username || url.password) avatar = null;
  }
  return { nickname, avatar, age: publicAge(raw.birthdate, now), gender: publicText(raw.gender, 50), pays: publicText(raw.pays, 100) };
}
