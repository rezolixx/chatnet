"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { passwordHint, passwordPolicyError, validatePasswordInput } from "@/lib/auth/password";

export function PasswordChangeForm({ nickname }: { nickname: string }) {
  const { refreshUser } = useAuth();
  const pending = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  // Feedback starts once the field is left, then follows every keystroke.
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    setSuccess("");
    setTouched(true);
    const checked = validatePasswordInput({ new_password: password }, nickname);
    // The rule broken is shown under the field (liveError), not repeated here.
    if (!checked.input) { if (!password) setError("Entrez un nouveau mot de passe."); return; }
    if (password !== confirmation) { setError("La confirmation ne correspond pas au nouveau mot de passe."); return; }
    pending.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Chatnet-Profile-Nickname": nickname },
        body: JSON.stringify(checked.input),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 419) {
        setError("Session expirée. Reconnectez-vous.");
        await refreshUser(true);
        return;
      }
      if (response.status === 422) {
        // The BFF only returns its own fixed messages, never upstream text.
        const result: { errors?: { new_password?: unknown } } = await response.json().catch(() => ({}));
        setError(typeof result.errors?.new_password === "string" ? result.errors.new_password : "Vérifiez le nouveau mot de passe.");
        return;
      }
      if (!response.ok) {
        setError(response.status === 429 ? "Trop de tentatives. Réessayez plus tard." : response.status === 409 ? "La session a changé. Rechargez le profil." : "Modification non confirmée. Vérifiez vos accès avant de réessayer.");
        return;
      }
      const result: { changed?: boolean; session?: string } = await response.json();
      if (result.changed !== true) throw new Error("Invalid response");
      setExpanded(false);
      if (result.session === "expired") {
        // Reload the auth provider after Laravel expires the session, while keeping
        // the confirmed password outcome visible on a dedicated confirmation page.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A full reload discards the expired auth provider state.
        window.location.assign("/profil/securite/confirme");
        return;
      }
      setSuccess(result.session === "active" ? "Votre mot de passe a été modifié." : "Votre mot de passe a été modifié. La vérification de la session est temporairement indisponible.");
    } catch { setError("Modification non confirmée. Vérifiez vos accès avant de réessayer."); }
    finally {
      setPassword("");
      setConfirmation("");
      setTouched(false);
      pending.current = false;
      setSubmitting(false);
    }
  }

  const liveError = touched && password ? passwordPolicyError(password, nickname) : undefined;

  return <section className="profile-edit-panel" aria-labelledby="password-change-heading">
    <h3 id="password-change-heading">Sécurité du compte</h3>
    <button type="button" className="button button-outline profile-edit-close" aria-expanded={expanded} aria-controls="password-change-form" onClick={() => setExpanded((current) => !current)} disabled={submitting}>{expanded ? "Fermer" : "Modifier le mot de passe"}</button>
    {expanded && <>
    <p>Choisissez un nouveau mot de passe pour votre compte.</p>
    <form id="password-change-form" onSubmit={submit} aria-busy={submitting} noValidate>
      <div className="profile-edit-grid">
        <div className="chat-join-field"><label htmlFor="new-password">Nouveau mot de passe</label><input id="new-password" name="new_password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} onBlur={() => { if (password) setTouched(true); }} disabled={submitting} aria-invalid={Boolean(liveError)} aria-describedby={["new-password-hint", liveError && "new-password-error", error && "password-change-error"].filter(Boolean).join(" ")} /><p id="new-password-hint" className="field-hint">{passwordHint}</p>{liveError && <span id="new-password-error" className="field-error" role="alert">{liveError}</span>}</div>
        <div className="chat-join-field"><label htmlFor="confirm-new-password">Confirmer le nouveau mot de passe</label><input id="confirm-new-password" name="confirmation" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={submitting} aria-describedby={error ? "password-change-error" : undefined} /></div>
        <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Modification…" : "Modifier le mot de passe"}</button>
      </div>
    </form>
    </>}
    {error && <p id="password-change-error" className="chat-join-error" role="alert">{error}</p>}
    {success && <p className="profile-avatar-success" role="status">{success}</p>}
  </section>;
}
