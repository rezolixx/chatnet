// Chat Identity V2: a one-time handoff code, issued through the Chatnet BFF
// and redeemed by a top-level form POST that opens the 24-hour chat session.
export const CHAT_HANDOFF_REDEEM_URL = "https://laravel.discut.org/api/chat/identity/handoff/redeem";
export const DEFAULT_CHAT_ROOM = "Accueil";
export const MAX_HANDOFF_EXPIRES_IN = 120;

const handoffCode = /^dch1_[A-Za-z0-9_-]{43}$/;

export function isChatHandoffCode(value: unknown): value is string {
  return typeof value === "string" && handoffCode.test(value);
}

// V2 statuses for which the legacy /api/auth/chat/prepare flow is tried:
// account, disabled feature, unbound IRC account, refused destination,
// rate limit and server errors. Never 401/419 nor an invalid success.
export function allowsLegacyChatFallback(status: number): boolean {
  return status === 403 || status === 404 || status === 409 || status === 422 || status === 429 || (status >= 500 && status <= 599);
}
