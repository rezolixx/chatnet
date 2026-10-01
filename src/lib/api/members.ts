import type { PublicMember } from "./types";

function normalizeAvatar(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Shared projection used by the public community and member page.
export function normalizeMember(value: unknown): PublicMember | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.nickname !== "string" || !raw.nickname.trim()) return null;
  return { nickname: raw.nickname.trim(), avatar: normalizeAvatar(raw.avatar) };
}
