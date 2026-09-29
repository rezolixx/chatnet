import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { GameCard } from "@/components/games/GameCard";
import { Icon } from "@/components/ui/Icons";
import { games } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("Jeux communautaires", "Découvrez les jeux et défis communautaires prévus pour Chatnet.", "/jeux");

export default function GamesPage() {
  return <><PageIntro eyebrow="Les jeux Chatnet" title="Se retrouver autour du jeu." description="Quiz, défis et jeux de mots : voici les espaces que nous préparons pour jouer ensemble. Les fonctionnalités de jeu ne sont pas encore ouvertes." /><section className="section games-page-section"><div className="container"><div className="games-page-heading"><div><span className="eyebrow">À découvrir</span><h2>Les jeux en préparation</h2></div><span className="preview-badge">Aperçu</span></div><div className="game-page-grid">{games.map((game) => <GameCard game={game} key={game.title} />)}</div><div className="score-preview-grid"><div className="score-panel"><div className="score-panel-head"><Icon name="users" size={22} /><h3>Classement de la communauté</h3></div><p>Les classements apparaîtront ici lorsque les jeux seront disponibles. Aucun rang ou score n’est affiché avant le lancement.</p><span className="score-placeholder">Classement à venir</span></div><div className="score-panel"><div className="score-panel-head"><Icon name="spark" size={22} /><h3>Scores et défis récents</h3></div><p>Suivez les résultats et les défis partagés par la communauté après l’ouverture des jeux.</p><span className="score-placeholder">Résultats à venir</span></div></div></div></section></>;
}
