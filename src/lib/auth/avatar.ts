export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const AVATAR_MAX_REQUEST_BYTES = AVATAR_MAX_BYTES + 64 * 1024;

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function avatarValidationError(file: { size: number; type: string } | null): string | null {
  if (!file || !acceptedTypes.has(file.type)) return "Choisissez une image JPEG, PNG, GIF ou WebP.";
  if (file.size === 0 || file.size > AVATAR_MAX_BYTES) return "L’image doit faire au maximum 4 Mo.";
  return null;
}

export function projectUploadedAvatar(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const avatar = (value as Record<string, unknown>).avatar;
  if (typeof avatar !== "string" || !avatar || avatar.length > 2048) return null;
  try {
    const url = new URL(avatar);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}
