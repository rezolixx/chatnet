import { registrationCountrySet } from "./countries.ts";

export type ProfileUpdateInput = { birthdate: string } | { pays: string };
export type ProfileUpdateField = "birthdate" | "pays";
export type ProfileUpdateErrors = Partial<Record<ProfileUpdateField | "form", string>>;

function validChatBirthdate(value: string, now: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return false;
  const age = now.getUTCFullYear() - year - (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day) ? 1 : 0);
  return age >= 16 && age <= 120;
}

export function validateProfileUpdate(value: unknown, now = new Date()): { input?: ProfileUpdateInput; errors: ProfileUpdateErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: { form: "Requête invalide." } };
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.length !== 1 || (keys[0] !== "birthdate" && keys[0] !== "pays")) return { errors: { form: "Un seul champ autorisé à la fois." } };
  if (keys[0] === "birthdate") {
    if (typeof raw.birthdate !== "string" || !validChatBirthdate(raw.birthdate, now)) {
      return { errors: { birthdate: "Entrez une date valide pour un membre de 16 à 120 ans." } };
    }
    return { input: { birthdate: raw.birthdate }, errors: {} };
  }
  const pays = typeof raw.pays === "string" ? raw.pays.trim() : "";
  // Discut's country selector and Chatnet's chat profile both use these canonical labels.
  if (!pays || pays.length > 255 || !registrationCountrySet.has(pays)) return { errors: { pays: "Choisissez un pays dans la liste." } };
  return { input: { pays }, errors: {} };
}

export function profileUpdateField(input: ProfileUpdateInput): ProfileUpdateField {
  return "birthdate" in input ? "birthdate" : "pays";
}

export function safeUpstreamProfileErrors(value: unknown, field: ProfileUpdateField): ProfileUpdateErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { [field]: "Vérifiez ce champ." };
  const errors = (value as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors) || !Object.hasOwn(errors, field)) return { [field]: "Vérifiez ce champ." };
  return { [field]: field === "birthdate" ? "Date de naissance invalide." : "Pays invalide." };
}
