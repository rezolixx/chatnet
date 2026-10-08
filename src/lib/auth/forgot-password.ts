// Same public, CSRF-exempt endpoint and JSON body as Discut's forgot-password page.
// Called from the browser so Laravel's throttle:5,1 stays per visitor IP; a
// Chatnet server proxy would put every visitor in one shared bucket.
export const FORGOT_PASSWORD_URL = "https://laravel.discut.org/api/forgot-password";

export const forgotPasswordMessages = {
  required: "Entrez votre adresse e-mail.",
  invalid: "Entrez une adresse e-mail valide.",
  sent: "Si un compte Chatnet correspond à cette adresse, un e-mail de réinitialisation vient de lui être envoyé. Le lien est valable 1 heure.",
  sender: "Cet e-mail est envoyé par Discut.org, qui héberge les comptes Chatnet : son lien ouvre la page sécurisée où choisir votre nouveau mot de passe. Revenez ensuite sur Chatnet pour vous connecter. Pensez à vérifier vos courriers indésirables.",
  rateLimited: "Trop de demandes. Patientez une minute avant de réessayer.",
  unavailable: "La demande n’a pas pu être envoyée. Réessayez dans quelques instants.",
};

export type ForgotPasswordOutcome = "sent" | "invalid" | "rate_limited" | "unavailable";

// Laravel lowercases and trims the address and applies its `email` rule; this is a
// lighter pre-check, so Laravel stays authoritative.
export function validateResetEmail(value: unknown): { email?: string; error?: string } {
  const email = typeof value === "string" ? value.trim() : "";
  if (!email) return { error: forgotPasswordMessages.required };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: forgotPasswordMessages.invalid };
  return { email };
}

// Only the status is used; the body is never read. Laravel answers 404 for an
// unknown address, so 200 and 404 are deliberately the same outcome.
export function forgotPasswordOutcome(status: number): ForgotPasswordOutcome {
  if (status === 200 || status === 404) return "sent";
  if (status === 422) return "invalid";
  if (status === 429) return "rate_limited";
  return "unavailable";
}
