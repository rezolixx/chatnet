import { PROFILE_BIRTHDATE_INVALID } from "./auth/age-policy.ts";

// Chat Identity V2: a one-time handoff code, issued through the Chatnet BFF
// and redeemed by a top-level form POST that opens the 24-hour chat session.
export const CHAT_HANDOFF_REDEEM_URL = "https://laravel.discut.org/api/chat/identity/handoff/redeem";
export const DEFAULT_CHAT_ROOM = "Accueil";
export const MAX_HANDOFF_EXPIRES_IN = 120;

const handoffCode = /^dch1_[A-Za-z0-9_-]{43}$/;

export function isChatHandoffCode(value: unknown): value is string {
  return typeof value === "string" && handoffCode.test(value);
}

// The only V2 answers after which the legacy /api/auth/chat/prepare flow is
// tried, Laravel having the last word (it refuses every profile already
// bound to its Anope account): 409 CHAT_ACCOUNT_UNAVAILABLE (chat account not
// bound yet) and 404 (V2 switched off). Never another refusal, a network
// error or a timeout: the member sees a clear error instead (T21). Never
// for a birthdate outside the age policy either (T20).
export function allowsLegacyChatFallback(status: number, code?: unknown): boolean {
  if (code === PROFILE_BIRTHDATE_INVALID) return false;
  return status === 404 || (status === 409 && code === "CHAT_ACCOUNT_UNAVAILABLE");
}

// Why a chat entry was refused, with the message shown to the member. No
// technical term, nothing from the request or the response.
export const chatEntryMessages = {
  RATE_LIMITED: "Trop de tentatives de connexion au chat. Patientez une minute, puis réessayez.",
  CHAT_UNAVAILABLE: "Impossible de se connecter au chat pour le moment. Veuillez réessayer.",
  ACCOUNT_UNAVAILABLE: "Votre compte ne peut pas accéder au chat pour le moment. Contactez l’assistance.",
  CHAT_IDENTITY_V2_REQUIRED: "Votre compte chat n’a pas pu être vérifié. Réessayez plus tard ou contactez l’assistance.",
  PROFILE_INCOMPLETE: "Votre profil ne contient pas de genre ou de pays valide, nécessaires pour accéder au chat. Vérifiez votre pays dans votre profil ou contactez l’assistance.",
  INVALID_DESTINATION: "Votre profil ou le salon choisi ne peut pas être utilisé pour entrer dans le chat. Vérifiez votre pays dans votre profil ou contactez l’assistance.",
  INVALID_ROOM: "Ce salon ne peut pas être ouvert depuis Chatnet. Entrez dans le chat, puis rejoignez-le depuis la liste des salons.",
} as const;

export type ChatEntryRefusal = keyof typeof chatEntryMessages;

// A chat entry stopped without any fallback; `refusal` selects the message.
export class ChatEntryFailure extends Error {
  readonly refusal: ChatEntryRefusal;

  constructor(refusal: ChatEntryRefusal) {
    super(chatEntryMessages[refusal]);
    this.name = "ChatEntryFailure";
    this.refusal = refusal;
  }
}

// A BFF refusal (handoff or legacy) as a refusal reason. 401/419 and the
// birthdate refusal are handled before: they need their own action.
export function chatEntryRefusal(status: number, code?: unknown): ChatEntryRefusal {
  if (status === 403 && (code === "CHAT_HANDOFF_REFUSED" || code === "ACCOUNT_UNAVAILABLE")) return "ACCOUNT_UNAVAILABLE";
  if (status === 409) return "CHAT_IDENTITY_V2_REQUIRED";
  if (status === 422 && code === "PROFILE_INCOMPLETE") return "PROFILE_INCOMPLETE";
  if (status === 422) return "INVALID_DESTINATION";
  if (status === 400 && code === "INVALID_ROOM") return "INVALID_ROOM";
  if (status === 429) return "RATE_LIMITED";
  return "CHAT_UNAVAILABLE";
}
