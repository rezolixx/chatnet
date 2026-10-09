// Voluntary account deletion: same Laravel contract as discut.org
// (DELETE /api/delete-account, chatnet-api docs/account-deletion.md). The
// member confirms with their current password and the word SUPPRIMER. Only
// Laravel's 200 "deleted" and 202 "irc_pending" mean the account is gone;
// every other answer, or none, means it was not (or not confirmed).

export const DELETION_CONFIRMATION_WORD = "SUPPRIMER";

export type AccountDeletionInput = { password: string; confirmation: string };
export type AccountDeletionErrors = { password?: string; confirmation?: string };
export type DeletedIrc = "removed" | "absent" | "skipped" | "uncertain";

export const accountDeletionMessages = {
  warning: "Cette action est irréversible. Votre compte, votre pseudo IRC (NickServ) et vos commentaires seront supprimés, sur chatnet.fr comme sur discut.org, qui utilisent le même compte.",
  passwordRequired: "Entrez votre mot de passe actuel.",
  confirmationRequired: `Tapez ${DELETION_CONFIRMATION_WORD} pour confirmer la suppression définitive.`,
  wrongPassword: "Mot de passe incorrect.",
  expired: "Session expirée. Reconnectez-vous.",
  stale: "La session a changé. Rechargez le profil.",
  busy: "Une suppression de ce compte est déjà en cours. Patientez quelques instants.",
  protectedAccount: "Ce compte ne peut pas être supprimé depuis le site. Contactez l'équipe. Rien n'a été supprimé.",
  tooMany: "Trop de tentatives. Réessayez dans une minute.",
  incomplete: "La suppression n'a pas pu être terminée. Votre compte est bloqué en attendant : réessayez dans quelques minutes.",
  ircRefused: "Le service IRC a refusé la suppression de votre pseudo. Rien n'a été supprimé : réessayez plus tard.",
  ircUnavailable: "Le service IRC ne répond pas. Rien n'a été supprimé : réessayez dans quelques minutes.",
  unavailable: "La suppression est temporairement indisponible. Rien n'a été supprimé.",
  unconfirmed: "La suppression n'a pas pu être confirmée. Rechargez la page pour vérifier l'état de votre compte avant de réessayer.",
  deleted: "Votre compte a été supprimé définitivement.",
  deletedWithIrc: "Votre compte et votre pseudo IRC ont été supprimés définitivement.",
  deletedIrcKept: "Votre compte a été supprimé définitivement. Votre pseudo IRC n'était pas relié à votre compte et n'a pas été supprimé : il expirera après 365 jours sans connexion au chat.",
  ircPending: "Votre compte a été supprimé. La suppression de votre pseudo IRC est en cours de vérification et sera terminée automatiquement.",
} as const;

const PASSWORD_MAX_LENGTH = 255;

/** The typed word confirms (case and surrounding spaces ignored, like Laravel). */
export function isDeletionConfirmed(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === DELETION_CONFIRMATION_WORD;
}

/**
 * Exactly { password, confirmation }. errors is empty when the shape itself
 * is wrong (400); otherwise it names the field to fix (422).
 */
export function validateDeletionInput(value: unknown): { input?: AccountDeletionInput; errors: AccountDeletionErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: {} };
  const fields = value as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (keys.length !== 2 || !Object.hasOwn(fields, "password") || !Object.hasOwn(fields, "confirmation")) return { errors: {} };
  const { password, confirmation } = fields;
  if (typeof password !== "string" || typeof confirmation !== "string") return { errors: {} };
  if (password === "" || password.length > PASSWORD_MAX_LENGTH) return { errors: { password: accountDeletionMessages.passwordRequired } };
  if (!isDeletionConfirmed(confirmation)) return { errors: { confirmation: accountDeletionMessages.confirmationRequired } };
  return { input: { password, confirmation }, errors: {} };
}

export type DeletionOutcome =
  | { deleted: true; pending: boolean; irc: DeletedIrc }
  | { deleted: false; status: number; code: string; message: string; field?: keyof AccountDeletionErrors };

function refusal(status: number, code: string, message: string, field?: keyof AccountDeletionErrors): DeletionOutcome {
  return { deleted: false, status, code, message, ...(field ? { field } : {}) };
}

/**
 * Laravel's answer, as the bridge returns it: fixed codes and messages only,
 * never Laravel's own text.
 */
export function deletionOutcomeFromUpstream(status: number, body: unknown): DeletionOutcome {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const state = raw.status;
  const code = raw.code;
  const irc = raw.irc === "removed" || raw.irc === "absent" || raw.irc === "skipped" ? raw.irc : "absent";

  if (status === 200 && state === "deleted") return { deleted: true, pending: false, irc };
  if (status === 202 && state === "irc_pending") return { deleted: true, pending: true, irc: "uncertain" };
  if (status === 401 || status === 419) return refusal(401, "AUTH_REQUIRED", accountDeletionMessages.expired);
  if (status === 403 && code === "REAUTH_FAILED") return refusal(403, "WRONG_PASSWORD", accountDeletionMessages.wrongPassword, "password");
  if (status === 403 && code === "ACCOUNT_PROTECTED") return refusal(403, "ACCOUNT_PROTECTED", accountDeletionMessages.protectedAccount);
  if (status === 409) return refusal(409, "IN_PROGRESS", accountDeletionMessages.busy);
  if (status === 422 && code === "CONFIRMATION_REQUIRED") return refusal(422, "VALIDATION_ERROR", accountDeletionMessages.confirmationRequired, "confirmation");
  if (status === 422) return refusal(422, "VALIDATION_ERROR", accountDeletionMessages.passwordRequired, "password");
  if (status === 429) return refusal(429, "RATE_LIMITED", accountDeletionMessages.tooMany);
  if (status === 500 && state === "website_pending") return refusal(503, "INCOMPLETE", accountDeletionMessages.incomplete);
  if (status === 502 && code === "IRC_REFUSED") return refusal(502, "IRC_REFUSED", accountDeletionMessages.ircRefused);
  if (status === 503 && code === "IRC_UNAVAILABLE") return refusal(503, "IRC_UNAVAILABLE", accountDeletionMessages.ircUnavailable);
  if (status === 503 && (code === "ACCOUNT_DELETION_UNAVAILABLE" || code === "ACCOUNT_DELETION_DISABLED")) return refusal(503, "UNAVAILABLE", accountDeletionMessages.unavailable);
  // Anything else, a 200 without "deleted" included: never a deletion.
  return refusal(503, "UNCONFIRMED", accountDeletionMessages.unconfirmed);
}

const messageByCode: Record<string, string> = {
  AUTH_REQUIRED: accountDeletionMessages.expired,
  WRONG_PASSWORD: accountDeletionMessages.wrongPassword,
  ACCOUNT_PROTECTED: accountDeletionMessages.protectedAccount,
  IN_PROGRESS: accountDeletionMessages.busy,
  STALE_PROFILE: accountDeletionMessages.stale,
  RATE_LIMITED: accountDeletionMessages.tooMany,
  INCOMPLETE: accountDeletionMessages.incomplete,
  IRC_REFUSED: accountDeletionMessages.ircRefused,
  IRC_UNAVAILABLE: accountDeletionMessages.ircUnavailable,
  UNAVAILABLE: accountDeletionMessages.unavailable,
};

/** The page's text for a bridge error code; unknown codes are never "deleted". */
export function deletionMessageForCode(code: unknown): string {
  return typeof code === "string" && Object.hasOwn(messageByCode, code) ? messageByCode[code] : accountDeletionMessages.unconfirmed;
}

/** The field to fix after a 422, with our own text for it. */
export function deletionFieldErrors(errors: unknown): AccountDeletionErrors {
  const named = errors && typeof errors === "object" && !Array.isArray(errors) && Object.hasOwn(errors, "confirmation");
  return named ? { confirmation: accountDeletionMessages.confirmationRequired } : { password: accountDeletionMessages.passwordRequired };
}

/** Message of the confirmation page, from its ?irc= parameter. */
export function deletedMessage(irc: unknown): string {
  if (irc === "removed") return accountDeletionMessages.deletedWithIrc;
  if (irc === "skipped") return accountDeletionMessages.deletedIrcKept;
  if (irc === "uncertain") return accountDeletionMessages.ircPending;
  return accountDeletionMessages.deleted;
}
