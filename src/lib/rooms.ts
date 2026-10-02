export function normalizeRoomName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  const name = value.trim().replace(/^#/, "");
  if (!name || name.startsWith("#") || name === "." || name === ".." || /[\s,/:\\]/.test(name)) return null;
  try { encodeURIComponent(name); } catch { return null; }
  return name;
}

export function normalizeRoomRouteParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Installed Next 16.3.6 encodes the value passed to server page user code
  // (getDynamicParam/getParamValue). Decode exactly once, never recursively.
  try { return normalizeRoomName(decodeURIComponent(value)); } catch { return null; }
}

export function sameRoomName(left: unknown, right: unknown): boolean {
  const a = normalizeRoomName(left);
  const b = normalizeRoomName(right);
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

export function publicRoomHref(value: unknown): string {
  const name = normalizeRoomName(value);
  return name ? `/salons/${encodeURIComponent(name)}` : "/salons";
}

export function roomJoinName(value: unknown): string | null {
  const name = normalizeRoomName(value);
  if (!name) return null;
  const url = new URL("https://chat.discut.org/chat");
  url.hash = name;
  // Existing WebChat sends location.hash directly to IRC without decoding it.
  // Refuse names transformed by URL serialization rather than join another name.
  return url.hash === `#${name}` ? name : null;
}
