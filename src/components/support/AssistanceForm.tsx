"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { contactSuccessMessage, contactUnavailableMessage, safeContactErrors, validateContactInput, type ContactErrors } from "@/lib/support/contact";

export function AssistanceForm() {
  const { refreshUser } = useAuth();
  const pending = useRef(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setSuccess(false);
    setError("");
    const checked = validateContactInput({ subject, message });
    setErrors(checked.errors);
    if (!checked.input) return;
    pending.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        const safe = safeContactErrors(await response.json().catch(() => null));
        setErrors(safe);
        setError(Object.keys(safe).length ? "Vérifiez les champs du formulaire." : "L’envoi est impossible avec les informations de votre compte. Veuillez réessayer plus tard.");
        return;
      }
      if (response.status === 429) { setError("Trop de tentatives. Réessayez plus tard."); return; }
      if (response.status !== 201) { setError(contactUnavailableMessage); return; }
      const result: { sent?: boolean } = await response.json();
      if (result.sent !== true) throw new Error("Invalid acknowledgement");
      setSubject("");
      setMessage("");
      setSuccess(true);
    } catch { setError(contactUnavailableMessage); }
    finally { pending.current = false; setSubmitting(false); }
  }

  return <form onSubmit={submit} aria-busy={submitting}>
    <div className="chat-join-field"><label htmlFor="assistance-subject">Sujet (facultatif)</label><input id="assistance-subject" name="subject" type="text" maxLength={255} value={subject} onChange={(event) => { setSubject(event.target.value); setSuccess(false); }} disabled={submitting} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "assistance-subject-error" : undefined} />{errors.subject && <p id="assistance-subject-error" className="chat-join-error" role="alert">{errors.subject}</p>}</div>
    <div className="chat-join-field"><label htmlFor="assistance-message">Message</label><textarea id="assistance-message" name="message" rows={7} required maxLength={5000} value={message} onChange={(event) => { setMessage(event.target.value); setSuccess(false); }} disabled={submitting} aria-invalid={!!errors.message} aria-describedby={errors.message ? "assistance-message-error" : undefined} />{errors.message && <p id="assistance-message-error" className="chat-join-error" role="alert">{errors.message}</p>}</div>
    {error && <p className="chat-join-error" role="alert">{error}</p>}
    {success && <p className="auth-success" role="status">{contactSuccessMessage}</p>}
    <button type="submit" className="button button-primary auth-submit" disabled={submitting}>{submitting ? "Envoi…" : "Envoyer le message"}</button>
  </form>;
}
