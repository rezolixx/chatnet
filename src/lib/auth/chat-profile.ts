import { ageFromBirthdate, birthdateRefusal, isAllowedAge } from "./age-policy.ts";

export type ChatProfile = {
  nickname: string;
  avatar: string | null;
  age: number;
  gender: "Homme" | "Femme";
  pays: string;
};

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

/**
 * Whether the member's own profile has a birthdate the age policy refuses
 * (outside 16-120, impossible or future date): chat entry then waits for
 * the member to correct it, never a legacy fallback. A missing birthdate is
 * an incomplete profile instead.
 */
export function hasRefusedBirthdate(value: unknown, authenticatedNickname: string, now = new Date()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (raw.nickname !== authenticatedNickname) return false;
  const refusal = birthdateRefusal(raw.birthdate, now);
  return refusal !== null && refusal !== "missing";
}

/**
 * Whether the member's own profile, birthdate within the age policy, lacks a
 * usable gender or country: chat entry then waits for the member to complete
 * it, never a legacy fallback.
 */
export function hasIncompleteChatFields(value: unknown, authenticatedNickname: string, now = new Date()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (raw.nickname !== authenticatedNickname || !text(raw.nickname, 80)) return false;
  if (!isAllowedAge(ageFromBirthdate(raw.birthdate, now))) return false;
  return !genderFrom(raw.gender) || !text(raw.pays, 120);
}

function genderFrom(value: unknown): ChatProfile["gender"] | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "m": case "male": case "homme": case "masculin": return "Homme";
    case "f": case "female": case "femme": case "féminin": case "feminin": return "Femme";
    default: return null;
  }
}

function safeAvatar(value: unknown): string | null {
  const avatar = text(value, 2048);
  if (!avatar) return null;
  try {
    const url = new URL(avatar);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function projectChatProfile(value: unknown, authenticatedNickname: string, now = new Date()): ChatProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.nickname !== authenticatedNickname) return null;
  const nickname = text(raw.nickname, 80);
  if (!nickname) return null;
  const age = ageFromBirthdate(raw.birthdate, now);
  const gender = genderFrom(raw.gender);
  const pays = text(raw.pays, 120);
  if (!isAllowedAge(age) || !gender || !pays) return null;
  return { nickname, avatar: safeAvatar(raw.avatar), age, gender, pays };
}
