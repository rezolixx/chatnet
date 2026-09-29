import type { GamePreview } from "@/lib/games";

export function GameCard({ game }: { game: GamePreview }) {
  return <article className="game-card"><span className="game-mark" aria-hidden="true">{game.mark}</span><div><span className="game-kind">{game.kind}</span><h3>{game.title}</h3><p>{game.description}</p></div><span className="coming-soon">En préparation</span></article>;
}
