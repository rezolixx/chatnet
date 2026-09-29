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

function ageFromBirthdate(value: unknown, now = new Date()): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const age = now.getUTCFullYear() - year - (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day) ? 1 : 0);
  return age >= 16 && age <= 120 ? age : null;
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
  if (age === null || !gender || !pays) return null;
  return { nickname, avatar: safeAvatar(raw.avatar), age, gender, pays };
}
