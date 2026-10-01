"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { validatePasswordInput } from "@/lib/auth/password";

export function PasswordChangeForm({ nickname }: { nickname: string }) {
  const { refreshUser } = useAuth();
  const pending = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    setSuccess("");
    const checked = validatePasswordInput({ new_password: password });
    if (!checked.input) { setError(checked.errors.new_password || "Vérifiez le nouveau mot de passe."); return; }
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
      if (!response.ok) {
        setError(response.status === 422 ? "Vérifiez le nouveau mot de passe (6 caractères minimum)." : response.status === 429 ? "Trop de tentatives. Réessayez plus tard." : response.status === 409 ? "La session a changé. Rechargez le profil." : "Modification non confirmée. Vérifiez vos accès avant de réessayer.");
        return;
      }
      const result: { changed?: boolean; session?: string } = await response.json();
      if (result.changed !== true) throw new Error("Invalid response");
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
      pending.current = false;
      setSubmitting(false);
    }
  }

  return <section className="profile-edit-panel" aria-labelledby="password-change-heading">
    <h3 id="password-change-heading">Sécurité du compte</h3>
    <p>Choisissez un nouveau mot de passe d’au moins 6 caractères pour votre compte.</p>
    <form onSubmit={submit} aria-busy={submitting}>
      <div className="profile-edit-grid">
        <div className="chat-join-field"><label htmlFor="new-password">Nouveau mot de passe</label><input id="new-password" name="new_password" type="password" autoComplete="new-password" required minLength={6} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? "password-change-error" : undefined} /></div>
        <div className="chat-join-field"><label htmlFor="confirm-new-password">Confirmer le nouveau mot de passe</label><input id="confirm-new-password" name="confirmation" type="password" autoComplete="new-password" required maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={submitting} aria-describedby={error ? "password-change-error" : undefined} /></div>
        <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Modification…" : "Modifier le mot de passe"}</button>
      </div>
    </form>
    {error && <p id="password-change-error" className="chat-join-error" role="alert">{error}</p>}
    {success && <p className="profile-avatar-success" role="status">{success}</p>}
  </section>;
}
