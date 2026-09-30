export type RegistrationInput = {
  nickname: string;
  email: string;
  birthdate: string;
  gender: "Homme" | "Femme";
  pays: string;
  password: string;
};

export type RegistrationField = keyof RegistrationInput | "confirmPassword";
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

function isAtLeast16(value: string, now = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 16, now.getUTCMonth(), now.getUTCDate()));
  return date <= cutoff;
}

export function validateRegistration(value: unknown, confirmPassword?: string, now = new Date()): { input?: RegistrationInput; errors: RegistrationErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: { nickname: "Formulaire invalide." } };
  const raw = value as Record<string, unknown>;
  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const birthdate = typeof raw.birthdate === "string" ? raw.birthdate : "";
  const gender = raw.gender;
  const pays = typeof raw.pays === "string" ? raw.pays.trim() : "";
  const password = raw.password;
  const errors: RegistrationErrors = {};
  // These public rules match the existing Discut form. Laravel remains authoritative.
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(nickname)) errors.nickname = "Utilisez 4 à 20 lettres, chiffres ou _.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) errors.email = "Entrez une adresse e-mail valide.";
  if (!isAtLeast16(birthdate, now)) errors.birthdate = "Vous devez avoir au moins 16 ans.";
  if (gender !== "Homme" && gender !== "Femme") errors.gender = "Choisissez un genre.";
  if (!pays || pays.length > 100) errors.pays = "Indiquez votre pays.";
  if (typeof password !== "string" || password.length < 6 || password.length > 1024) errors.password = "Utilisez au moins 6 caractères.";
  if (confirmPassword !== undefined && password !== confirmPassword) errors.confirmPassword = "Les mots de passe ne correspondent pas.";
  if (Object.keys(errors).length) return { errors };
  return { input: { nickname, email, birthdate, gender: gender as RegistrationInput["gender"], pays, password: password as string }, errors };
}

const fieldMessages: Partial<Record<RegistrationField, string>> = {
  nickname: "Ce pseudo est invalide ou indisponible.",
  email: "Cette adresse e-mail est invalide ou indisponible.",
  birthdate: "Vérifiez votre date de naissance.",
  gender: "Vérifiez le genre choisi.",
  pays: "Vérifiez votre pays.",
  password: "Vérifiez votre mot de passe.",
};

export function upstreamRegistrationErrors(value: unknown): RegistrationErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const errors = (value as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  const result: RegistrationErrors = {};
  for (const key of Object.keys(fieldMessages) as RegistrationField[]) {
    if (Object.hasOwn(errors, key)) result[key] = fieldMessages[key];
  }
  return result;
}

export function upstreamRegistrationConflict(value: unknown): RegistrationErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const message = (value as Record<string, unknown>).message;
  if (typeof message !== "string") return {};
  if (/^Cet email est déjà utilisé\.$/.test(message)) return { email: "Cette adresse e-mail est déjà utilisée." };
  if (/^Ce pseudo (existe déjà|est déjà enregistré sur IRC)/.test(message)) return { nickname: "Ce pseudo est déjà utilisé." };
  return {};
}

export function registrationFailure(status: number, body?: unknown): { status: number; code: string; message: string; errors?: RegistrationErrors } {
  if (status === 422) return { status, code: "VALIDATION_ERROR", message: "Vérifiez les champs du formulaire.", errors: upstreamRegistrationErrors(body) };
  if (status === 409) return { status, code: "CONFLICT", message: "Ce pseudo ou cet e-mail est déjà utilisé.", errors: upstreamRegistrationConflict(body) };
  if (status === 429) return { status, code: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." };
  if (status === 419) return { status, code: "SESSION_EXPIRED", message: "Session expirée. Réessayez." };
  return { status: 503, code: "UNAVAILABLE", message: "Inscription temporairement indisponible." };
}
