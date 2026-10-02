export type ContactInput = { subject: string; message: string };
export type ContactErrors = { subject?: string; message?: string };

export const contactValidationMessages = {
  subject: "Le sujet doit contenir au maximum 255 caractères.",
  message: "Le message est obligatoire et doit contenir au maximum 5 000 caractères.",
};
export const contactUnavailableMessage = "L’envoi n’a pas pu être confirmé. Veuillez réessayer plus tard.";
export const contactSuccessMessage = "Votre message a été envoyé à l’équipe Chatnet.";

export function validateContactInput(value: unknown): { input?: ContactInput; errors: ContactErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: {} };
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length !== 2 || !Object.hasOwn(fields, "subject") || !Object.hasOwn(fields, "message")) return { errors: {} };
  const errors: ContactErrors = {};
  if (typeof fields.subject !== "string" || Array.from(fields.subject).length > 255) errors.subject = contactValidationMessages.subject;
  if (typeof fields.message !== "string" || !fields.message.trim() || Array.from(fields.message).length > 5000) errors.message = contactValidationMessages.message;
  if (Object.keys(errors).length) return { errors };
  return { input: { subject: fields.subject as string, message: fields.message as string }, errors };
}

// Used only on the server. Never accept identity from the Assistance caller.
export function contactIdentity(value: unknown): { name: string; email: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.nickname !== "string" || !raw.nickname.trim() || Array.from(raw.nickname).length > 255) return null;
  if (typeof raw.email !== "string" || raw.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) return null;
  return { name: raw.nickname, email: raw.email };
}

export function safeContactErrors(value: unknown): ContactErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const errors = (value as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  // Allow known field names only; upstream messages may contain private values.
  const safe: ContactErrors = {};
  if (Object.hasOwn(errors, "subject")) safe.subject = contactValidationMessages.subject;
  if (Object.hasOwn(errors, "message")) safe.message = contactValidationMessages.message;
  return safe;
}
