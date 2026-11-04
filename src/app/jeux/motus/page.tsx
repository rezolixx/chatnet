import type { Metadata } from "next";
import Link from "next/link";
import { gameStatus } from "@/components/games/GameCatalogueCard";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { LeaderboardTable } from "@/components/games/LeaderboardTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icons";
import { getVerifiedLeaderboard } from "@/lib/api/game-identities.server";
import { isMotusOpen } from "@/lib/api/games.server";
import { getGameInfo } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";
import { joinHref } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const motusOpen = isMotusOpen();
  return {
    ...pageMetadata(
      "Motus : jeu de lettres entre membres",
      "Règles du Motus Chatnet, commandes du salon #motus et classement des joueurs.",
      "/jeux/motus",
    ),
    ...(motusOpen ? {} : { robots: { index: false, follow: true } }),
  };
}

const rules = [
  "Une personne présente dans #motus lance la manche avec !motus. Une seule manche peut être active à la fois.",
  "Le robot choisit un mot français de six lettres et dévoile sa première lettre.",
  "Chacun propose des mots français de six lettres directement dans le salon, sans commande supplémentaire. Les mots inconnus ne consomment aucun essai.",
  "🟩 : lettre à la bonne place. 🟨 : lettre présente ailleurs. ⬛ : lettre absente. Les lettres répétées sont prises en compte.",
  "Six propositions différentes au maximum pour tout le salon, dont deux par joueur. Les répétitions ne comptent pas.",
  "La manche dure 90 secondes. Le mot est révélé si personne ne le trouve à temps. Un délai de 20 secondes sépare deux manches.",
];

const commands = [
  { command: "!motus", effect: "Lancer une manche collective." },
  { command: "!status", effect: "Afficher la première lettre du mot et les essais utilisés." },
  { command: "!score [pseudo]", effect: "Afficher les points, parties et victoires enregistrés." },
  { command: "!stop", effect: "Arrêter la manche (lanceur ou un joueur si le lanceur est parti)." },
  { command: "!help", effect: "Afficher les commandes du jeu." },
];

export default async function MotusPage() {
  const motusOpen = isMotusOpen();
  const status = gameStatus(getGameInfo("motus"), false, motusOpen);
  const leaderboard = motusOpen ? await getVerifiedLeaderboard("motus") : null;

  return <>
    <section className="games-hero games-hero-compact">
      <div className="container">
        <GamesBreadcrumb items={[{ label: "Jeux", href: "/jeux" }, { label: "Motus", href: "/jeux/motus" }]} />
        <div className="games-hero-copy">
          <span className={`game-status game-status-${status.tone}`}>{status.label}</span>
          <h1>Le Motus Chatnet</h1>
          <p>Un mot à deviner ensemble dans #motus, des indices colorés à chaque proposition et des points pour la première bonne réponse.</p>
          <div className="games-hero-actions">
            <a className="button button-primary button-large" href="#participer">Comment participer <Icon name="arrow" size={17} /></a>
            <Link href="/jeux/classement" className="button button-ghost button-large">Voir les classements</Link>
          </div>
        </div>
      </div>
    </section>

    <section id="participer" className="section quiz-join-section">
      <div className="container quiz-join-grid">
        <div>
          <SectionHeading eyebrow="Participer" title="Trois étapes pour trouver le mot." />
          <ol className="games-steps games-steps-stacked">
            <li><span className="games-step-number" aria-hidden="true">1</span><h3>Entrez dans #motus</h3><p>Rejoignez le salon de jeu depuis le chat Chatnet.</p></li>
            <li><span className="games-step-number" aria-hidden="true">2</span><h3>Lancez la manche</h3><p>Écrivez <code>!motus</code> si aucune partie n’est en cours.</p></li>
            <li><span className="games-step-number" aria-hidden="true">3</span><h3>Proposez des mots</h3><p>Écrivez votre proposition. Les indices affichent les lettres bien placées et celles à déplacer.</p></li>
          </ol>
        </div>
        <aside className="quiz-access" aria-labelledby="motus-access-title">
          <h2 id="motus-access-title">{motusOpen ? "Rejoindre #motus" : "Motus arrive bientôt"}</h2>
          <p>{motusOpen
            ? "Les manches se jouent dans le salon #motus. Ouvrez le chat pour retrouver les autres joueurs."
            : "Le moteur est en préparation et les parties ne sont pas encore ouvertes au public. Revenez bientôt pour participer."}</p>
          <Link href={joinHref} className="button button-primary">Rejoindre le chat <Icon name="arrow" size={16} /></Link>
        </aside>
      </div>
    </section>

    <section className="section quiz-rules-section">
      <div className="container quiz-rules-grid">
        <div>
          <SectionHeading eyebrow="Règles" title="Comment fonctionne Motus ?" />
          <ul className="quiz-rule-list">{rules.map((rule) => <li key={rule}><Icon name="spark" size={17} />{rule}</li>)}</ul>
        </div>
        <div>
          <SectionHeading eyebrow="Points" title="Le barème des manches." />
          <table className="quiz-table">
            <caption className="sr-only">Points et victoires de Motus</caption>
            <thead><tr><th scope="col">Événement</th><th scope="col">Résultat</th></tr></thead>
            <tbody>
              <tr><th scope="row">Première réponse exacte</th><td>+10 points</td></tr>
              <tr><th scope="row">Proposition incorrecte ou temps écoulé</th><td>0 point</td></tr>
              <tr><th scope="row">Au moins une proposition valide dans une manche terminée</th><td>+1 partie jouée</td></tr>
              <tr><th scope="row">Réponse exacte enregistrée</th><td>+1 victoire</td></tr>
            </tbody>
          </table>
          <p className="quiz-note">Le classement utilise les résultats effectivement enregistrés par le moteur de jeu. Les scores ne peuvent pas être modifiés depuis ce site.</p>
        </div>
      </div>
    </section>

    <section className="section quiz-commands-section">
      <div className="container">
        <SectionHeading eyebrow="Commandes" title="Les commandes de #motus." />
        <div className="leaderboard-scroll" role="region" aria-label="Commandes de Motus" tabIndex={0}>
          <table className="quiz-table quiz-commands">
            <caption className="sr-only">Commandes de Motus</caption>
            <thead><tr><th scope="col">Commande</th><th scope="col">Action</th></tr></thead>
            <tbody>{commands.map((row) => <tr key={row.command}><th scope="row"><code>{row.command}</code></th><td>{row.effect}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="section games-ranking-section">
      <div className="container">
        <SectionHeading eyebrow="Classement" title="Les meilleurs joueurs de Motus." action={<Link href="/jeux/classement" className="text-link">Classement complet <Icon name="arrow" size={17} /></Link>} />
        {!motusOpen
          ? <GameDataNotice kind="empty" />
          : leaderboard?.status === "available"
            ? leaderboard.entries.length
              ? <LeaderboardTable entries={leaderboard.entries.slice(0, 5)} caption="Cinq premiers joueurs de Motus" />
              : <GameDataNotice kind="empty" />
            : <GameDataNotice kind={leaderboard?.status ?? "unavailable"} />}
      </div>
    </section>
  </>;
}
