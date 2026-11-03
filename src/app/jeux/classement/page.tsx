import type { Metadata } from "next";
import Link from "next/link";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { LeaderboardTable } from "@/components/games/LeaderboardTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getVerifiedLeaderboard } from "@/lib/api/game-identities.server";
import { isMotusOpen, LEADERBOARD_LIMIT } from "@/lib/api/games.server";
import { gameCatalogue } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const quiz = await getVerifiedLeaderboard("quiz");
  const motus = isMotusOpen() ? await getVerifiedLeaderboard("motus") : null;
  const populated = (quiz.status === "available" && quiz.entries.length > 0) || (motus?.status === "available" && motus.entries.length > 0);
  return {
    ...pageMetadata("Classement des joueurs", "Classements des joueurs Chatnet : Quiz et Motus, points, parties jouées et victoires issus des parties dans les salons de jeu.", "/jeux/classement"),
    // An empty or unavailable ranking is not useful search content.
    ...(populated ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function RankingsPage() {
  const motusOpen = isMotusOpen();
  const [leaderboard, motusLeaderboard] = await Promise.all([
    getVerifiedLeaderboard("quiz"),
    motusOpen ? getVerifiedLeaderboard("motus") : Promise.resolve(null),
  ]);
  const upcoming = gameCatalogue.filter((game) => !game.implemented || (game.id === "motus" && !motusOpen));
  return <>
    <section className="games-hero games-hero-compact"><div className="container"><GamesBreadcrumb items={[{ label: "Jeux", href: "/jeux" }, { label: "Classement", href: "/jeux/classement" }]} /><div className="games-hero-copy"><span className="eyebrow">Classement</span><h1>Les meilleurs joueurs.</h1><p>Points, parties jouées et victoires issus des parties dans les salons #quiz et #motus, selon leur disponibilité.</p></div></div></section>
    <section className="section rankings-section"><div className="container"><SectionHeading eyebrow="Quiz" title={`Top ${LEADERBOARD_LIMIT} du Quiz`} description="Classement par points, puis par victoires, puis par ordre alphabétique. Les scores sont mis à jour en continu ; cette page est actualisée environ chaque minute." action={<Link href="/jeux/quiz" className="text-link">Règles du Quiz</Link>} />{leaderboard.status === "available" ? leaderboard.entries.length ? <LeaderboardTable entries={leaderboard.entries} caption={`Classement du Quiz, ${leaderboard.entries.length} premiers joueurs`} /> : <GameDataNotice kind="empty" /> : <GameDataNotice kind={leaderboard.status} />}
      {motusOpen && motusLeaderboard && <div className="mt-12"><SectionHeading eyebrow="Motus" title={`Top ${LEADERBOARD_LIMIT} de Motus`} description="Points, parties et victoires enregistrés dans le salon #motus." action={<Link href="/jeux/motus" className="text-link">Règles de Motus</Link>} />{motusLeaderboard.status === "available" ? motusLeaderboard.entries.length ? <LeaderboardTable entries={motusLeaderboard.entries} caption={`Classement de Motus, ${motusLeaderboard.entries.length} premiers joueurs`} /> : <GameDataNotice kind="empty" /> : <GameDataNotice kind={motusLeaderboard.status} />}</div>}
      <div className="rankings-upcoming">{upcoming.map((game) => <div className="rankings-upcoming-card" key={game.id}><span className="game-tile-mark" aria-hidden="true">{game.mark}</span><div><h2>{game.name}</h2><p>Le classement {game.id === "motus" ? "de Motus" : "des Défis du jour"} sera publié au lancement du jeu.</p></div></div>)}</div></div></section>
  </>;
}
