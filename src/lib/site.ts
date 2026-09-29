export const site = {
  name: "Chatnet",
  url: "https://chatnet.fr",
  description:
    "Chatnet est un chat en ligne francophone pour découvrir des salons de discussion, rencontrer la communauté et échanger autour d’intérêts partagés.",
  nav: [
    { label: "Accueil", href: "/" },
    { label: "Salons", href: "/salons" },
    { label: "Communauté", href: "/communaute" },
    { label: "Jeux", href: "/jeux" },
    { label: "À propos", href: "/a-propos" },
  ],
} as const;

function configuredDestination(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const loginUrl = configuredDestination(process.env.NEXT_PUBLIC_LOGIN_URL);
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;
export const joinHref = "/#rejoindre";
export const loginHref = loginUrl || "/connexion";

export function roomHref(): string {
  return joinHref;
}
