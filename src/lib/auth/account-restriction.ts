// Member Ban / Suspension refusals, as decided by the Laravel API (the only
// authority) and relayed by the BFF routes. Shared by the server routes and
// the browser; no React, no network.
//
// - 403 ACCOUNT_SUSPENDED / ACCOUNT_BANNED: the account is restricted; the
//   API has ended its session. Public metadata only: kind, public reason,
//   end date.
// - 503 ACCOUNT_RESTRICTION_UNAVAILABLE: the API could not read the
//   restriction state and refuses the member flow (fail closed).
//
// Nothing here is ever stored (no cookie, no localStorage): the site shows
// the refusal it has just received, and the API decides again at the next
// sign-in. Admin ids, internal notes and audit data are never read, even if
// a response carried them.

export const ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";
export const ACCOUNT_BANNED = "ACCOUNT_BANNED";
export const ACCOUNT_RESTRICTION_UNAVAILABLE = "ACCOUNT_RESTRICTION_UNAVAILABLE";

export type RestrictionKind = "temporary_suspension" | "temporary_ban" | "permanent_ban" | "ban";

export type AccountRestriction = {
  code: typeof ACCOUNT_SUSPENDED | typeof ACCOUNT_BANNED;
  kind: RestrictionKind;
  reason: string;
  // ISO 8601 (UTC), null when permanent or unknown.
  expiresAt: string | null;
};

export type AccountRefusal = AccountRestriction | { code: typeof ACCOUNT_RESTRICTION_UNAVAILABLE };

const KINDS = new Set<string>(["temporary_suspension", "temporary_ban", "permanent_ban"]);
const REASON_MAX = 500;

function publicReason(value: unknown): string {
  if (typeof value !== "string") return "";
  // Rendered as text by React (escaped); control characters are dropped.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, REASON_MAX);
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/**
 * The refusal carried by a response (HTTP status and JSON body), or null.
 * A 403 with a restriction code stays a refusal even when its metadata is
 * missing or invalid: it is never read as a wrong password or a guest.
 */
export function accountRefusalFrom(status: number, body: unknown): AccountRefusal | null {
  const fields = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const code = fields.code;
  if (status === 503 && code === ACCOUNT_RESTRICTION_UNAVAILABLE) return { code };
  if (status !== 403 || (code !== ACCOUNT_SUSPENDED && code !== ACCOUNT_BANNED)) return null;

  const raw = fields.restriction && typeof fields.restriction === "object" && !Array.isArray(fields.restriction)
    ? fields.restriction as Record<string, unknown>
    : {};
  let kind: RestrictionKind | null = typeof raw.kind === "string" && KINDS.has(raw.kind) ? raw.kind as RestrictionKind : null;
  // The code wins over a contradictory kind.
  if (code === ACCOUNT_SUSPENDED) kind = "temporary_suspension";
  if (code === ACCOUNT_BANNED && (kind === "temporary_suspension" || kind === null)) kind = "ban";
  return {
    code,
    kind: kind ?? "ban",
    reason: publicReason(raw.reason),
    expiresAt: kind === "permanent_ban" ? null : isoDate(raw.expires_at),
  };
}

export function isAccountRestriction(refusal: AccountRefusal | null | undefined): refusal is AccountRestriction {
  return refusal?.code === ACCOUNT_SUSPENDED || refusal?.code === ACCOUNT_BANNED;
}

/** The refusal of a fetch response (read from a clone), or null. */
export async function readAccountRefusal(response: Response): Promise<AccountRefusal | null> {
  if (response.status !== 403 && response.status !== 503) return null;
  const body: unknown = await response.clone().json().catch(() => null);
  return accountRefusalFrom(response.status, body);
}

/** HTTP status and public JSON body the BFF answers with: nothing else is relayed. */
export function accountRefusalStatus(refusal: AccountRefusal): 403 | 503 {
  return isAccountRestriction(refusal) ? 403 : 503;
}

export function accountRefusalBody(refusal: AccountRefusal) {
  if (!isAccountRestriction(refusal)) return { code: refusal.code };
  return { code: refusal.code, restriction: { kind: refusal.kind, reason: refusal.reason, expires_at: refusal.expiresAt } };
}

/** "22 octobre 2026 à 12:00 UTC+2", in the visitor's time zone (or `timeZone`). */
export function formatRestrictionDate(iso: string, { timeZone }: { timeZone?: string } = {}): string {
  const text = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
  return text.replace(/^(\d{1,2} \S+ \d{4}),? (?:à )?/, "$1 à ");
}

export type AccountRefusalView = { title: string; message: string; reason: string; temporary: boolean; retry: boolean };

/** French texts of the notice, as on discut.org and the WebChat. */
export function accountRefusalView(refusal: AccountRefusal, options: { timeZone?: string } = {}): AccountRefusalView {
  if (!isAccountRestriction(refusal)) {
    return {
      title: "Service momentanément indisponible",
      message: "La vérification de votre compte est momentanément indisponible. Réessayez dans quelques minutes.",
      reason: "",
      temporary: false,
      retry: true,
    };
  }
  const end = refusal.expiresAt ? formatRestrictionDate(refusal.expiresAt, options) : null;
  const view = { reason: refusal.reason, temporary: Boolean(end), retry: false };
  if (refusal.kind === "temporary_suspension") {
    return { ...view, title: "Compte suspendu", message: end ? `Votre compte est suspendu temporairement, jusqu’au ${end}.` : "Votre compte est suspendu temporairement." };
  }
  if (refusal.kind === "permanent_ban") {
    return { ...view, title: "Compte banni définitivement", message: "Votre compte est banni définitivement.", temporary: false };
  }
  if (refusal.kind === "temporary_ban") {
    return { ...view, title: "Compte banni temporairement", message: end ? `Votre compte est banni temporairement, jusqu’au ${end}.` : "Votre compte est banni temporairement." };
  }
  return { ...view, title: "Compte banni", message: end ? `Votre compte est banni jusqu’au ${end}.` : "Votre compte est banni." };
}

/** One-line text (title, sentence, reason) for an inline error message. */
export function accountRefusalText(refusal: AccountRefusal, options: { timeZone?: string } = {}): string {
  const view = accountRefusalView(refusal, options);
  return [`${view.title}.`, view.message, view.reason ? `Motif : ${view.reason}` : ""].filter(Boolean).join(" ");
}

/** A refused sign-in or member request, for the code that awaits it. */
export class AccountRefusalError extends Error {
  readonly refusal: AccountRefusal;

  constructor(refusal: AccountRefusal) {
    super(accountRefusalView(refusal).title);
    this.name = "AccountRefusalError";
    this.refusal = refusal;
  }
}
