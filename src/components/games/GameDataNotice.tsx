import type { ReactNode } from "react";

type Kind = "not-configured" | "unavailable" | "empty";

const copy: Record<Kind, { title: string; text: string }> = {
  "not-configured": { title: "Classements bientôt en ligne", text: "Les scores du Quiz seront publiés ici dès l’ouverture du service de jeux. Aucun score n’est affiché tant que les données réelles ne sont pas disponibles." },
  unavailable: { title: "Classement momentanément indisponible", text: "Les scores ne peuvent pas être chargés pour le moment. Réessayez dans quelques instants." },
  empty: { title: "Aucun score pour le moment", text: "Le classement se remplira avec les premières parties jouées dans le salon #quiz." },
};

export function GameDataNotice({ kind, title = copy[kind].title, text = copy[kind].text, heading: Heading = "h3", children }: { kind: Kind; title?: string; text?: string; heading?: "h2" | "h3"; children?: ReactNode }) {
  return <div className={`game-notice game-notice-${kind}`} role={kind === "unavailable" ? "alert" : undefined}><Heading>{title}</Heading><p>{text}</p>{children}</div>;
}
