export interface GamePreview {
  title: string;
  description: string;
  kind: string;
  mark: string;
}

// Editorial preview only. No scores or rankings are represented as live data.
export const games: GamePreview[] = [
  { title: "Quiz entre amis", description: "Des questions pour lancer la conversation et jouer ensemble.", kind: "Culture & découverte", mark: "?" },
  { title: "Défis du jour", description: "De petites occasions de se retrouver autour d’un même objectif.", kind: "Défis", mark: "↗" },
  { title: "Jeux de mots", description: "Des idées de jeu pour celles et ceux qui aiment les mots.", kind: "Langue & réflexion", mark: "Aa" },
];
