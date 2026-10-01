export type PasswordErrors = { new_password?: string };

export const passwordValidationMessage = "Le nouveau mot de passe doit contenir au moins 6 caractères.";

// Laravel trims new_password (unlike password) before applying min:6.
export function validatePasswordInput(value: unknown): { input?: { new_password: string }; errors: PasswordErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: {} };
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, "new_password")) return { errors: {} };
  const password = fields.new_password;
  // The upper bound is a Chatnet transport limit, not a Laravel password rule.
  if (typeof password === "string" && password.length > 1024) return { errors: { new_password: "Le nouveau mot de passe est trop long." } };
  // Match PHP trim's default ASCII characters; Unicode whitespace is not trimmed by Laravel here.
  const trimmed = typeof password === "string" ? password.replace(/^[\u0000\t\n\r\v ]+|[\u0000\t\n\r\v ]+$/g, "") : "";
  if (typeof password !== "string" || Array.from(trimmed).length < 6) {
    return { errors: { new_password: passwordValidationMessage } };
  }
  return { input: { new_password: password }, errors: {} };
}

export function safePasswordErrors(value: unknown): PasswordErrors {
  // Never copy upstream strings: a validation message could contain a submitted secret.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const errors = (value as Record<string, unknown>).errors;
    if (errors && typeof errors === "object" && Object.hasOwn(errors, "new_password")) {
      return { new_password: passwordValidationMessage };
    }
  }
  return { new_password: "Vérifiez le nouveau mot de passe." };
}
