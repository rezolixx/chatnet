import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import type { GameInfo } from "@/lib/games";

export function gameStatus(game: GameInfo, quizOpen: boolean): { label: string; tone: "live" | "soon" | "planned" } {
  if (!game.implemented) return { label: "En préparation", tone: "planned" };
  return quizOpen ? { label: "Disponible sur IRC", tone: "live" } : { label: "Ouverture prochaine", tone: "soon" };
}

export function GameCatalogueCard({ game, quizOpen }: { game: GameInfo; quizOpen: boolean }) {
  const status = gameStatus(game, quizOpen);
  return <article className={`game-tile game-tile-${game.id}${game.implemented ? "" : " game-tile-planned"}`}><div className="game-tile-top"><span className="game-tile-mark" aria-hidden="true">{game.mark}</span><span className={`game-status game-status-${status.tone}`}>{status.label}</span></div><span className="game-kind">{game.kind}</span><h3>{game.href ? <Link href={game.href}>{game.name}</Link> : game.name}</h3><p className="game-tile-tagline">{game.tagline}</p><p>{game.description}</p><div className="game-tile-foot"><span className="game-channel" aria-label={`Salon IRC ${game.channel}`}>{game.channel}</span>{game.href ? <Link href={game.href} className="text-link" aria-label={`Découvrir le jeu ${game.name}`}>Découvrir <Icon name="arrow" size={16} /></Link> : <span className="game-tile-muted">Pas encore jouable</span>}</div></article>;
}
