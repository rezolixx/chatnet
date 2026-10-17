import type { Metadata } from "next";
import Link from "next/link";
import { GameCatalogueCard } from "@/components/games/GameCatalogueCard";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { LeaderboardTable } from "@/components/games/LeaderboardTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icons";
import { getLeaderboard, isQuizOpen } from "@/lib/api/games.server";
import { gameCatalogue } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export const metadata: Metadata = pageMetadata("Jeux en ligne entre membres", "Quiz de culture générale en direct dans le salon #quiz, classement des joueurs et prochains jeux Chatnet : Motus et Défis du jour.", "/jeux");

const steps = [
  { title: "Ouvrez le chat", text: "Depuis Chatnet en quelques secondes, ou avec votre client IRC habituel : c’est le même réseau." },
  { title: "Rejoignez le salon du jeu", text: "Chaque jeu a son salon dédié. Le Quiz se joue dans #quiz, sans rien installer." },
  { title: "Marquez des points", text: "Vos points, parties et victoires sont enregistrés par le robot du jeu et publiés dans le classement du site." },
];

export default async function GamesPage() {
  const quizOpen = isQuizOpen();
  const leaderboard = await getLeaderboard("quiz");
  return <>
    <section className="games-hero"><div className="container games-hero-inner"><div className="games-hero-copy"><span className="eyebrow">Les jeux Chatnet</span><h1>Jouez en direct avec la communauté.</h1><p>Des parties rapides dans les salons de discussion, des points pour chaque bonne réponse et un classement commun. Les jeux Chatnet se jouent sur notre réseau IRC, directement depuis le chat.</p><div className="games-hero-actions"><Link href="/jeux/quiz" className="button button-primary button-large">Découvrir le Quiz <Icon name="arrow" size={17} /></Link><Link href="/jeux/classement" className="button button-ghost button-large">Voir le classement</Link></div></div><ul className="games-hero-channels" aria-label="Salons de jeu">{gameCatalogue.map((game) => <li key={game.id} className={game.implemented ? "is-ready" : undefined}><span className="games-hero-channel">{game.channel}</span><span>{game.name}</span><small>{game.implemented ? (quizOpen ? "Disponible" : "Ouverture prochaine") : "En préparation"}</small></li>)}</ul></div></section>
    <section className="section games-catalogue-section"><div className="container"><SectionHeading eyebrow="Catalogue" title="Choisissez votre jeu." description={quizOpen ? "Le Quiz est ouvert dans le salon #quiz. Motus et les Défis du jour sont en préparation et ne sont pas encore jouables." : "Le Quiz ouvrira en premier dans le salon #quiz. Motus et les Défis du jour sont en préparation et ne sont pas encore jouables."} /><div className="game-tile-grid">{gameCatalogue.map((game) => <GameCatalogueCard key={game.id} game={game} quizOpen={quizOpen} />)}</div></div></section>
    <section className="section games-how-section"><div className="container"><SectionHeading eyebrow="Jeux connectés à IRC" title="Un réseau, des parties partagées." description="Les jeux Chatnet vivent dans les salons IRC du réseau. Que vous arriviez par le site ou par un client IRC, vous jouez dans le même salon, avec les mêmes règles et le même classement." /><ol className="games-steps">{steps.map((step, index) => <li key={step.title}><span className="games-step-number" aria-hidden="true">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol><p className="games-how-note"><Icon name="shield" size={18} /> Le site affiche les scores en lecture seule : les parties se jouent pour l’instant uniquement dans les salons IRC.</p></div></section>
    <section className="section games-ranking-section"><div className="container"><SectionHeading eyebrow="Classement" title="Les meilleurs joueurs du Quiz." action={<Link href="/jeux/classement" className="text-link">Classement complet <Icon name="arrow" size={17} /></Link>} />{leaderboard.status === "available" ? leaderboard.entries.length ? <LeaderboardTable entries={leaderboard.entries.slice(0, 5)} caption="Cinq premiers joueurs du Quiz" /> : <GameDataNotice kind="empty" /> : <GameDataNotice kind={leaderboard.status} />}</div></section>
  </>;
}
