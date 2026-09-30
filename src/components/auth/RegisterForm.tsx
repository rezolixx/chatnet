"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateRegistration, type RegistrationErrors, type RegistrationField } from "@/lib/auth/registration";

type FormValues = { nickname: string; email: string; birthdate: string; gender: string; pays: string; password: string; confirmPassword: string };
const initial: FormValues = { nickname: "", email: "", birthdate: "", gender: "", pays: "", password: "", confirmPassword: "" };
const fields: { key: RegistrationField; label: string; type: string; autoComplete: string }[] = [
  { key: "nickname", label: "Pseudo", type: "text", autoComplete: "username" },
  { key: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { key: "birthdate", label: "Date de naissance", type: "date", autoComplete: "bday" },
  { key: "pays", label: "Pays", type: "text", autoComplete: "country-name" },
  { key: "password", label: "Mot de passe", type: "password", autoComplete: "new-password" },
  { key: "confirmPassword", label: "Confirmation du mot de passe", type: "password", autoComplete: "new-password" },
];

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  function change(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const { input, errors: nextErrors } = validateRegistration(values, values.confirmPassword);
    setErrors(nextErrors);
    setFormError("");
    if (!input) {
      const first = Object.keys(nextErrors)[0];
      document.getElementById(`register-${first}`)?.focus();
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store",
      });
      if (response.ok) {
        router.push("/connexion?registered=1");
        return;
      }
      const result: { message?: string; errors?: RegistrationErrors } = await response.json().catch(() => ({}));
      setErrors(result.errors ?? {});
      setFormError(typeof result.message === "string" ? result.message : "Inscription temporairement indisponible.");
    } catch {
      setFormError("Inscription temporairement indisponible.");
    } finally {
      setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
      setPending(false);
    }
  }

  return <div className="auth-card register-card">
    <span className="eyebrow">Rejoignez Chatnet</span>
    <h2>Créer un compte</h2>
    <p>Votre compte vous donne accès à votre profil membre et au chat connecté.</p>
    <form onSubmit={submit} noValidate>
      {fields.slice(0, 3).map(({ key, label, type, autoComplete }) => <div className="chat-join-field" key={key}>
        <label htmlFor={`register-${key}`}>{label}</label>
        <input id={`register-${key}`} name={key} type={type} autoComplete={autoComplete} value={values[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `register-${key}-error` : undefined} required maxLength={key === "nickname" ? 20 : key === "email" ? 255 : undefined} />
        {errors[key] && <span className="field-error" id={`register-${key}-error`}>{errors[key]}</span>}
      </div>)}
      <div className="chat-join-field">
        <label htmlFor="register-gender">Genre</label>
        <select id="register-gender" name="gender" autoComplete="sex" value={values.gender} onChange={(event) => change("gender", event.target.value)} aria-invalid={Boolean(errors.gender)} aria-describedby={errors.gender ? "register-gender-error" : undefined} required>
          <option value="">Choisissez un genre</option><option value="Homme">Homme</option><option value="Femme">Femme</option>
        </select>
        {errors.gender && <span className="field-error" id="register-gender-error">{errors.gender}</span>}
      </div>
      {fields.slice(3).map(({ key, label, type, autoComplete }) => <div className="chat-join-field" key={key}>
        <label htmlFor={`register-${key}`}>{label}</label>
        <input id={`register-${key}`} name={key} type={type} autoComplete={autoComplete} value={values[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `register-${key}-error` : undefined} required maxLength={key === "pays" ? 100 : undefined} />
        {errors[key] && <span className="field-error" id={`register-${key}-error`}>{errors[key]}</span>}
      </div>)}
      {formError && <p className="chat-join-error" role="alert">{formError}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? "Création du compte…" : "Créer mon compte"}</button>
    </form>
    <p className="auth-footnote">Déjà membre ? <Link href="/connexion">Se connecter</Link></p>
  </div>;
}
