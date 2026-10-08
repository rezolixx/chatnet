"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FORGOT_PASSWORD_URL, forgotPasswordMessages, forgotPasswordOutcome, validateResetEmail } from "@/lib/auth/forgot-password";

export function ForgotPasswordForm() {
  const pending = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setFormError("");
    const checked = validateResetEmail(email);
    setFieldError(checked.error ?? "");
    if (!checked.email) { emailInput.current?.focus(); return; }
    pending.current = true;
    setSubmitting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(FORGOT_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: checked.email }),
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      const outcome = forgotPasswordOutcome(response.status);
      if (outcome === "sent") { setEmail(""); setSent(true); return; }
      if (outcome === "invalid") { setFieldError(forgotPasswordMessages.invalid); return; }
      setFormError(outcome === "rate_limited" ? forgotPasswordMessages.rateLimited : forgotPasswordMessages.unavailable);
    } catch { setFormError(forgotPasswordMessages.unavailable); }
    finally { clearTimeout(timeout); pending.current = false; setSubmitting(false); }
  }

  if (sent) return <div className="auth-card">
    <span className="eyebrow">Demande envoyée</span>
    <h2>Consultez votre boîte mail.</h2>
    <p className="auth-success" role="status">{forgotPasswordMessages.sent}</p>
    <p>{forgotPasswordMessages.sender}</p>
    <Link className="button button-primary auth-submit" href="/connexion">Retour à la connexion</Link>
  </div>;

  return <div className="auth-card">
    <span className="eyebrow">Mot de passe oublié</span>
    <h2>Réinitialisez votre mot de passe.</h2>
    <p>Indiquez l’adresse e-mail de votre compte Chatnet. Vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <form onSubmit={submit} noValidate aria-busy={submitting}>
      <div className="chat-join-field"><label htmlFor="forgot-email">Adresse e-mail</label><input ref={emailInput} id="forgot-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "forgot-email-error" : undefined} required />{fieldError && <span id="forgot-email-error" className="field-error" role="alert">{fieldError}</span>}</div>
      {formError && <p className="chat-join-error" role="alert">{formError}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? "Envoi…" : "Envoyer le lien"}</button>
    </form>
    <p className="auth-footnote"><Link href="/connexion">Retour à la connexion</Link></p>
  </div>;
}
