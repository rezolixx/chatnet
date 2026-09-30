export type OwnProfile = {
  nickname: string;
  email: string | null;
  avatar: string | null;
  birthdate: string | null;
  gender: string | null;
  pays: string | null;
  description: string | null;
  inscritDepuis: string | null;
};

function optionalText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function safeAvatar(value: unknown): string | null {
  const avatar = optionalText(value, 2048);
  if (!avatar) return null;
  try {
    const url = new URL(avatar);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function projectOwnProfile(me: unknown, member: unknown, authenticatedNickname: string): OwnProfile | null {
  if (!me || typeof me !== "object" || Array.isArray(me) || !member || typeof member !== "object" || Array.isArray(member)) return null;
  const own = me as Record<string, unknown>;
  const details = member as Record<string, unknown>;
  if (own.nickname !== authenticatedNickname || details.nickname !== authenticatedNickname) return null;
  const nickname = optionalText(authenticatedNickname, 80);
  if (!nickname) return null;
  const birthdate = optionalText(own.birthdate, 10);
  return {
    nickname,
    email: optionalText(own.email, 255),
    avatar: safeAvatar(own.avatar),
    birthdate: birthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? birthdate : null,
    gender: optionalText(details.gender, 50),
    pays: optionalText(own.pays, 120),
    description: optionalText(own.description, 2000),
    inscritDepuis: optionalText(own.inscritDepuis, 40),
  };
}
