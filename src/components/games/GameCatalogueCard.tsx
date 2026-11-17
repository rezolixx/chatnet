import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import type { GameInfo } from "@/lib/games";

export type GameStatus = { label: string; tone: "live" | "soon" | "planned" };

/** Défis: the verified bot status (lib/api/defis.server.ts) is passed in; never assumed. */
export function gameStatus(game: GameInfo, quizOpen: boolean, motusOpen = false, defisStatus?: GameStatus): GameStatus {
  if (!game.implemented) return { label: "En préparation", tone: "planned" };
  if (game.id === "defis") return defisStatus ?? { label: "Ouverture prochaine", tone: "soon" };
  const available = game.id === "motus" ? motusOpen : quizOpen;
  return available ? { label: "Disponible dans le chat", tone: "live" } : { label: "Ouverture prochaine", tone: "soon" };
}

export function GameCatalogueCard({ game, quizOpen, motusOpen = false, defisStatus }: { game: GameInfo; quizOpen: boolean; motusOpen?: boolean; defisStatus?: GameStatus }) {
  const status = gameStatus(game, quizOpen, motusOpen, defisStatus);
  // The illustration repeats the title link for pointer users; keyboard users keep the two text links.
  const art = game.artwork && game.href ? { ...game.artwork, ...game.artwork.card } : null;
  const visual = art && game.href ? <Link href={game.href} className="game-tile-art" tabIndex={-1}><Image src={art.src} alt={art.alt}width={art.width} height={art.height} sizes="(max-width: 920px) calc(100vw - 40px), 400px" /></Link> : <span className="game-tile-mark" aria-hidden="true">{game.mark}</span>;
  return <article className={`game-tile game-tile-${game.id}${game.implemented ? "" : " game-tile-planned"}`}><div className={art ? "game-tile-top game-tile-top-art" : "game-tile-top"}>{visual}<span className={`game-status game-status-${status.tone}`}>{status.label}</span></div><span className="game-kind">{game.kind}</span><h3>{game.href ? <Link href={game.href}>{game.name}</Link> : game.name}</h3><p className="game-tile-tagline">{game.tagline}</p><p>{game.description}</p><div className="game-tile-foot"><span className="game-channel" aria-label={`Salon ${game.channel}`}>{game.channel}</span>{game.href ? <Link href={game.href} className="text-link" aria-label={`Découvrir le jeu ${game.name}`}>Découvrir <Icon name="arrow" size={16} /></Link> : <span className="game-tile-muted">Pas encore jouable</span>}</div></article>;
}
