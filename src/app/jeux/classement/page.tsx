import type { Metadata } from "next";
import Link from "next/link";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { LeaderboardTable } from "@/components/games/LeaderboardTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getVerifiedLeaderboard } from "@/lib/api/game-identities.server";
import { LEADERBOARD_LIMIT } from "@/lib/api/games.server";
import { gameCatalogue } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const leaderboard = await getVerifiedLeaderboard("quiz");
  const populated = leaderboard.status === "available" && leaderboard.entries.length > 0;
  return {
    ...pageMetadata("Classement des joueurs", "Classement des meilleurs joueurs du Quiz Chatnet : points, parties jouées et victoires, mis à jour à partir des parties jouées dans le salon #quiz.", "/jeux/classement"),
    // An empty or unavailable ranking is not useful search content.
    ...(populated ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function RankingsPage() {
  const leaderboard = await getVerifiedLeaderboard("quiz");
  const upcoming = gameCatalogue.filter((game) => !game.implemented);
  return <>
    <section className="games-hero games-hero-compact"><div className="container"><GamesBreadcrumb items={[{ label: "Jeux", href: "/jeux" }, { label: "Classement", href: "/jeux/classement" }]} /><div className="games-hero-copy"><span className="eyebrow">Classement</span><h1>Les meilleurs joueurs.</h1><p>Points, parties jouées et victoires des joueurs du Quiz, à partir des parties réellement jouées dans le salon #quiz.</p></div></div></section>
    <section className="section rankings-section"><div className="container"><SectionHeading eyebrow="Quiz" title={`Top ${LEADERBOARD_LIMIT} du Quiz`} description="Classement par points, puis par victoires, puis par ordre alphabétique. Les scores sont mis à jour en continu ; cette page est actualisée environ chaque minute." action={<Link href="/jeux/quiz" className="text-link">Règles du Quiz</Link>} />{leaderboard.status === "available" ? leaderboard.entries.length ? <LeaderboardTable entries={leaderboard.entries} caption={`Classement du Quiz, ${leaderboard.entries.length} premiers joueurs`} /> : <GameDataNotice kind="empty" /> : <GameDataNotice kind={leaderboard.status} />}<div className="rankings-upcoming">{upcoming.map((game) => <div className="rankings-upcoming-card" key={game.id}><span className="game-tile-mark" aria-hidden="true">{game.mark}</span><div><h2>{game.name}</h2><p>Le classement {game.id === "motus" ? "de Motus" : "des Défis du jour"} sera publié au lancement du jeu.</p></div></div>)}</div></div></section>
  </>;
}
