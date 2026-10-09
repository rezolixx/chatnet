"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { accountDeletionMessages, deletionFieldErrors, deletionMessageForCode, DELETION_CONFIRMATION_WORD, isDeletionConfirmed, validateDeletionInput, type AccountDeletionErrors } from "@/lib/auth/account-deletion";

export function AccountDeletionForm({ nickname }: { nickname: string }) {
  const { refreshUser } = useAuth();
  const pending = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AccountDeletionErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // One request at a time: a second click or Enter waits for Laravel's answer.
    if (pending.current) return;
    setError("");
    setFieldErrors({});
    const checked = validateDeletionInput({ password, confirmation });
    if (!checked.input) { setFieldErrors(checked.errors); return; }
    pending.current = true;
    setSubmitting(true);
    let leaving = false;
    try {
      const response = await fetch("/api/auth/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Chatnet-Profile-Nickname": nickname },
        body: JSON.stringify(checked.input),
        credentials: "same-origin",
        cache: "no-store",
      });
      const result: { deleted?: unknown; irc?: unknown; code?: unknown; errors?: unknown } = await response.json().catch(() => ({}));
      if (response.ok && result.deleted === true) {
        leaving = true;
        const irc = result.irc === "removed" || result.irc === "skipped" || result.irc === "uncertain" ? result.irc : "absent";
        // A full reload discards the deleted member from the auth provider.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A full reload discards the deleted member's auth provider state.
        window.location.assign(`/profil/compte-supprime?irc=${irc}`);
        return;
      }
      if (response.status === 401) {
        setError(accountDeletionMessages.expired);
        await refreshUser(true);
        return;
      }
      const message = deletionMessageForCode(result.code);
      if (result.code === "WRONG_PASSWORD") setFieldErrors({ password: message });
      else if (response.status === 422) setFieldErrors(deletionFieldErrors(result.errors));
      else setError(message);
    } catch { setError(accountDeletionMessages.unconfirmed); }
    finally {
      if (!leaving) {
        setPassword("");
        pending.current = false;
        setSubmitting(false);
      }
    }
  }

  const describedBy = (field: keyof AccountDeletionErrors) => [fieldErrors[field] && `delete-${field}-error`, error && "account-deletion-error"].filter(Boolean).join(" ") || undefined;

  return <section className="profile-edit-panel profile-danger-panel" aria-labelledby="account-deletion-heading">
    <h3 id="account-deletion-heading">Supprimer mon compte</h3>
    <button type="button" className="button button-outline profile-edit-close" aria-expanded={expanded} aria-controls="account-deletion-form" onClick={() => setExpanded((current) => !current)} disabled={submitting}>{expanded ? "Fermer" : "Supprimer mon compte"}</button>
    {expanded && <>
    <p>{accountDeletionMessages.warning}</p>
    <form id="account-deletion-form" onSubmit={submit} aria-busy={submitting} noValidate>
      <div className="profile-edit-grid">
        <div className="chat-join-field"><label htmlFor="delete-password">Mot de passe actuel</label><input id="delete-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={describedBy("password")} />{fieldErrors.password && <span id="delete-password-error" className="field-error" role="alert">{fieldErrors.password}</span>}</div>
        <div className="chat-join-field"><label htmlFor="delete-confirmation">Pour confirmer, tapez {DELETION_CONFIRMATION_WORD}</label><input id="delete-confirmation" name="confirmation" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={submitting} aria-invalid={Boolean(fieldErrors.confirmation)} aria-describedby={describedBy("confirmation")} />{fieldErrors.confirmation && <span id="delete-confirmation-error" className="field-error" role="alert">{fieldErrors.confirmation}</span>}</div>
        <button type="submit" className="button button-danger" disabled={submitting || !password || !isDeletionConfirmed(confirmation)}>{submitting ? "Suppression…" : "Supprimer définitivement"}</button>
      </div>
    </form>
    </>}
    {error && <p id="account-deletion-error" className="chat-join-error" role="alert">{error}</p>}
  </section>;
}
