export const channelCategories = ["general", "jeux", "musique", "entraide", "culture", "autre"] as const;
export type ChannelCategory = (typeof channelCategories)[number];

export type ChannelRequestInput = {
  channel: string;
  category: ChannelCategory;
  description: string;
  topic: string;
  accept_rules: true;
};

export type ChannelRequestErrors = Partial<Record<keyof ChannelRequestInput, string>>;
export type ChannelRequestStatus = "pending" | "changes_requested" | "rejected" | "approved_provisioning" | "provisioning_failed" | "active" | "suspended";

export type OwnChannelRequest = {
  id: string;
  channel: string;
  category: ChannelCategory;
  description: string;
  topic: string;
  founder_display: string;
  status: ChannelRequestStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const channelStatusLabels: Record<ChannelRequestStatus, string> = {
  pending: "En attente de validation",
  changes_requested: "Modifications demandées",
  rejected: "Demande refusée",
  approved_provisioning: "Approuvée, activation en préparation",
  provisioning_failed: "Activation en attente de vérification",
  active: "Salon actif",
  suspended: "Salon suspendu",
};

export const channelRequestMessages: Record<keyof ChannelRequestInput, string> = {
  channel: "Utilisez un nom comme #MonSalon (3 à 31 caractères après #, lettres, chiffres, _ ou -).",
  category: "Choisissez une catégorie valide.",
  description: "Décrivez votre salon en 15 à 500 caractères.",
  topic: "Saisissez un sujet de 5 à 300 caractères.",
  accept_rules: "Vous devez accepter les règles du réseau.",
};

const namePattern = /^#[A-Za-z][A-Za-z0-9_-]{2,30}$/;
const controlPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validChannelRequestId(value: string): boolean { return uuidPattern.test(value); }

export function validateChannelRequestInput(value: unknown): { input?: ChannelRequestInput; errors: ChannelRequestErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: {} };
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length !== 5 || !["channel", "category", "description", "topic", "accept_rules"].every((key) => Object.hasOwn(fields, key))) return { errors: {} };
  const errors: ChannelRequestErrors = {};
  const channel = typeof fields.channel === "string" ? fields.channel.trim() : "";
  const description = typeof fields.description === "string" ? fields.description.trim() : "";
  const topic = typeof fields.topic === "string" ? fields.topic.trim() : "";
  if (!namePattern.test(channel)) errors.channel = channelRequestMessages.channel;
  if (!channelCategories.includes(fields.category as ChannelCategory)) errors.category = channelRequestMessages.category;
  if (Array.from(description).length < 15 || Array.from(description).length > 500 || controlPattern.test(description)) errors.description = channelRequestMessages.description;
  if (Array.from(topic).length < 5 || Array.from(topic).length > 300 || controlPattern.test(topic)) errors.topic = channelRequestMessages.topic;
  if (fields.accept_rules !== true) errors.accept_rules = channelRequestMessages.accept_rules;
  if (Object.keys(errors).length) return { errors };
  return { input: { channel, category: fields.category as ChannelCategory, description, topic, accept_rules: true }, errors };
}

export function safeChannelRequestErrors(value: unknown): ChannelRequestErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = (value as Record<string, unknown>).errors;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const errors: ChannelRequestErrors = {};
  for (const key of Object.keys(channelRequestMessages) as (keyof ChannelRequestInput)[]) {
    if (Object.hasOwn(raw, key)) errors[key] = channelRequestMessages[key];
  }
  return errors;
}

function safeText(value: unknown, max: number): string | null {
  return typeof value === "string" && Array.from(value).length <= max ? value : null;
}

export function projectOwnChannelRequests(value: unknown): OwnChannelRequest[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const requests = (value as Record<string, unknown>).requests;
  if (!Array.isArray(requests) || requests.length > 30) return null;
  const projected: OwnChannelRequest[] = [];
  for (const item of requests) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !validChannelRequestId(raw.id)
      || typeof raw.channel !== "string" || !namePattern.test(raw.channel)
      || !channelCategories.includes(raw.category as ChannelCategory)
      || !Object.hasOwn(channelStatusLabels, String(raw.status))) return null;
    const description = safeText(raw.description, 500);
    const topic = safeText(raw.topic, 300);
    const founder = safeText(raw.founder_display, 80);
    const reason = raw.rejection_reason === null ? null : safeText(raw.rejection_reason, 1000);
    const created = safeText(raw.created_at, 48);
    const updated = safeText(raw.updated_at, 48);
    if (description === null || topic === null || founder === null || reason === null && raw.rejection_reason !== null || created === null || updated === null) return null;
    projected.push({
      id: raw.id, channel: raw.channel, category: raw.category as ChannelCategory,
      description, topic, founder_display: founder, status: raw.status as ChannelRequestStatus,
      rejection_reason: reason, created_at: created, updated_at: updated,
    });
  }
  return projected;
}

export function projectChannelRequestAck(value: unknown): { id: string; status: "pending" } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return typeof raw.id === "string" && validChannelRequestId(raw.id) && raw.status === "pending" ? { id: raw.id, status: "pending" } : null;
}
