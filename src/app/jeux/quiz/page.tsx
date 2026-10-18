import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChatJoinForm } from "@/components/chat/ChatJoinForm";
import { gameStatus } from "@/components/games/GameCatalogueCard";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { LeaderboardTable } from "@/components/games/LeaderboardTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icons";
import { getVerifiedLeaderboard } from "@/lib/api/game-identities.server";
import { isQuizOpen } from "@/lib/api/games.server";
import { getGameInfo } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";
import { joinHref } from "@/lib/site";

export const revalidate = 60;

export const metadata: Metadata = pageMetadata("Quiz de culture générale en direct", "Jouez au Quiz Chatnet dans le salon IRC #quiz : règles, commandes, catégories, calcul des points et classement des meilleurs joueurs.", "/jeux/quiz");

// Mirrors game-system docs/quiz.md (B2.6). Rules are enforced by the game engine, not by this page.
const categories = ["Culture générale", "Histoire", "Géographie", "Sciences", "Cinéma / musique", "Sport"];

const rules = [
  "Le robot du jeu pose une question dans #quiz. Répondez directement dans le salon, sans commande.",
  "La première bonne réponse remporte la manche. Les réponses suivantes ne comptent pas.",
  "Majuscules, accents, ponctuation et article initial sont ignorés : « la Loire » vaut « Loire ».",
  "Au plus trois réponses différentes par question et par joueur ; une réponse répétée n’est pas évaluée.",
  "Les messages de plus de 120 caractères ne sont pas pris en compte.",
  "Par défaut, une partie compte 10 questions avec 30 secondes pour répondre à chacune.",
  "La partie s’arrête après trois questions de suite sans bonne réponse, ou quand plus aucun joueur n’est présent.",
];

const commands = [
  { command: "!quiz [catégorie]", effect: "Lance une partie, toutes catégories ou une seule. !start fonctionne aussi." },
  { command: "!categories", effect: "Affiche la liste des catégories." },
  { command: "!status", effect: "Indique la question en cours, le temps restant et le meneur." },
  { command: "!score [pseudo]", effect: "Affiche vos scores enregistrés, ou ceux d’un autre joueur." },
  { command: "!stop", effect: "Arrête la partie (réservé à la personne qui l’a lancée tant qu’elle est présente)." },
  { command: "!help", effect: "Affiche l’aide du jeu." },
];

const scoring = [
  { event: "Première bonne réponse d’une manche", value: "+10 points" },
  { event: "Mauvaise réponse ou temps écoulé", value: "0 point" },
  { event: "Fin de partie, pour chaque participant", value: "+1 partie jouée" },
  { event: "Meilleur total de la partie (plus de 0 point)", value: "+1 victoire" },
];

export default async function QuizPage() {
  const quiz = getGameInfo("quiz");
  const quizOpen = isQuizOpen();
  const status = gameStatus(quiz, quizOpen);
  const leaderboard = await getVerifiedLeaderboard("quiz");
  return <>
    <section className="games-hero games-hero-compact"><div className="container"><GamesBreadcrumb items={[{ label: "Jeux", href: "/jeux" }, { label: "Quiz", href: "/jeux/quiz" }]} /><div className="games-hero-inner quiz-hero"><div className="games-hero-copy"><span className={`game-status game-status-${status.tone}`}>{status.label}</span><h1>Le Quiz Chatnet</h1><p>Un quiz de culture générale en direct dans le salon IRC #quiz. Une question, un compte à rebours, et la première bonne réponse empoche les points.</p><div className="games-hero-actions"><a href="#participer" className="button button-primary button-large">Comment participer <Icon name="arrow" size={17} /></a><Link href="/jeux/classement" className="button button-ghost button-large">Voir le classement</Link></div></div>{quiz.artwork && <figure className="quiz-hero-art"><Image src={quiz.artwork.src} alt={quiz.artwork.alt} width={quiz.artwork.width} height={quiz.artwork.height} sizes="(max-width: 700px) min(340px, calc(100vw - 40px)), 420px" preload /></figure>}</div></div></section>
    <section className="section quiz-join-section" id="participer"><div className="container quiz-join-grid"><div><SectionHeading eyebrow="Participer" title="Rejoindre une partie en trois étapes." /><ol className="games-steps games-steps-stacked"><li><span className="games-step-number" aria-hidden="true">1</span><h3>Entrez dans #quiz</h3><p>Ouvrez le chat depuis Chatnet, ou connectez votre client IRC au réseau, puis rejoignez le salon #quiz.</p></li><li><span className="games-step-number" aria-hidden="true">2</span><h3>Lancez une partie</h3><p>Tapez <code>!quiz</code>, ou <code>!quiz histoire</code> pour une seule catégorie, si aucune partie n’est en cours.</p></li><li><span className="games-step-number" aria-hidden="true">3</span><h3>Répondez vite</h3><p>Écrivez votre réponse dans le salon. Les points sont enregistrés immédiatement.</p></li></ol></div><aside className="quiz-access" aria-labelledby="quiz-access-title"><h2 id="quiz-access-title">{quizOpen ? "Ouvrir le salon #quiz" : "Le salon #quiz ouvre bientôt"}</h2>{quizOpen ? <ChatJoinForm selectedRoom="quiz" /> : <><p>Le robot du Quiz n’est pas encore actif sur le réseau. Les parties et le classement démarreront dès son ouverture.</p><p>En attendant, retrouvez la communauté dans les salons de discussion.</p><Link href={joinHref} className="button button-primary">Rejoindre le chat <Icon name="arrow" size={16} /></Link></>}</aside></div></section>
    <section className="section quiz-rules-section"><div className="container quiz-rules-grid"><div><SectionHeading eyebrow="Règles" title="Les règles du jeu." /><ul className="quiz-rule-list">{rules.map((rule) => <li key={rule}><Icon name="spark" size={17} />{rule}</li>)}</ul><h3 className="quiz-subheading">Catégories</h3><ul className="quiz-categories" aria-label="Catégories de questions">{categories.map((category) => <li key={category}>{category}</li>)}</ul></div><div><SectionHeading eyebrow="Points" title="Comment les points sont comptés." /><table className="quiz-table"><caption className="sr-only">Barème des points du Quiz</caption><thead><tr><th scope="col">Événement</th><th scope="col">Résultat</th></tr></thead><tbody>{scoring.map((row) => <tr key={row.event}><th scope="row">{row.event}</th><td>{row.value}</td></tr>)}</tbody></table><p className="quiz-note">Vous participez dès qu’une de vos réponses est évaluée, bonne ou mauvaise. En cas d’égalité au meilleur total, chaque joueur concerné gagne une victoire. Le classement trie les joueurs par points, puis par victoires, puis par ordre alphabétique.</p></div></div></section>
    <section className="section quiz-commands-section"><div className="container"><SectionHeading eyebrow="Commandes" title="Les commandes du salon #quiz." /><div className="leaderboard-scroll" role="region" aria-label="Commandes du Quiz" tabIndex={0}><table className="quiz-table quiz-commands"><caption className="sr-only">Commandes du Quiz</caption><thead><tr><th scope="col">Commande</th><th scope="col">Effet</th></tr></thead><tbody>{commands.map((row) => <tr key={row.command}><th scope="row"><code>{row.command}</code></th><td>{row.effect}</td></tr>)}</tbody></table></div></div></section>
    <section className="section games-ranking-section"><div className="container"><SectionHeading eyebrow="Classement" title="Les meilleurs joueurs du Quiz." action={<Link href="/jeux/classement" className="text-link">Classement complet <Icon name="arrow" size={17} /></Link>} />{leaderboard.status === "available" ? leaderboard.entries.length ? <LeaderboardTable entries={leaderboard.entries.slice(0, 5)} caption="Cinq premiers joueurs du Quiz" /> : <GameDataNotice kind="empty" /> : <GameDataNotice kind={leaderboard.status} />}</div></section>
  </>;
}
