"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function LoginForm({ registered = false }: { registered?: boolean }) {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ identity?: string; password?: string }>({});
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = {
      identity: identity.trim() ? undefined : "Entrez votre pseudo ou e-mail.",
      password: password ? undefined : "Entrez votre mot de passe.",
    };
    setErrors(nextErrors);
    setFormError("");
    if (nextErrors.identity || nextErrors.password) {
      document.getElementById(nextErrors.identity ? "auth-identity" : "auth-password")?.focus();
      return;
    }
    setPending(true);
    try {
      await login(identity.trim(), password);
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Connexion temporairement indisponible.");
    } finally { setPassword(""); setPending(false); }
  }

  if (loading) return <div className="auth-card" aria-live="polite">Vérification de votre session…</div>;
  if (user) return <div className="auth-card"><span className="eyebrow">Connecté à Chatnet</span><h2>Bonjour {user.nickname}.</h2><p>Votre session est active.</p><Link className="button button-primary" href="/">Retour à l’accueil</Link></div>;

  return <div className="auth-card">
    <span className="eyebrow">Votre espace Chatnet</span>
    <h2>Ravi de vous retrouver.</h2>
    <p>Connectez-vous avec votre compte Chatnet.</p>
    {registered && <p className="auth-success" role="status">Votre compte a bien été créé. Vous pouvez maintenant vous connecter.</p>}
    <form onSubmit={submit} noValidate>
      <div className="chat-join-field"><label htmlFor="auth-identity">Pseudo ou e-mail</label><input id="auth-identity" type="text" autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} aria-invalid={Boolean(errors.identity)} aria-describedby={errors.identity ? "auth-identity-error" : undefined} maxLength={320} required />{errors.identity && <span id="auth-identity-error" className="field-error">{errors.identity}</span>}</div>
      <div className="chat-join-field"><label htmlFor="auth-password">Mot de passe</label><input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "auth-password-error" : undefined} required />{errors.password && <span id="auth-password-error" className="field-error">{errors.password}</span>}<Link className="auth-forgot" href="/mot-de-passe-oublie">Mot de passe oublié ?</Link></div>
      {formError && <p className="chat-join-error" role="alert">{formError}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
    </form>
    <p className="auth-footnote">Pas encore membre ? <Link href="/inscription">Créer un compte</Link></p>
  </div>;
}
