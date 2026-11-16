import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChatJoinForm } from "@/components/chat/ChatJoinForm";
import { gameStatus } from "@/components/games/GameCatalogueCard";
import { DefisLeaderboard } from "@/components/games/DefisLeaderboard";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icons";
import {
  defisGameStatus,
  getDefisCurrent,
  getDefisLeaderboard,
  getDefisStatus,
  type DefisLeaderboardResult,
  type DefisPeriod,
  type DefisStatusResult,
} from "@/lib/api/defis.server";
import { formatCount, getGameInfo } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

// Availability comes from the bot's verified heartbeat: re-read every 30 seconds.
export const revalidate = 30;

export const metadata: Metadata = pageMetadata(
  "Défis du jour : énigmes et logique entre membres",
  "Un défi chaque jour dans #defis : énigmes, logique, anagrammes et mots mystères. Répondez en privé à DefisBot et grimpez aux classements du jour, du mois et de tous les temps.",
  "/jeux/defis",
);

const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", hour: "2-digit", minute: "2-digit" });
const dayTimeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const at = (iso: string) => timeFormat.format(new Date(iso)).replace(":", "h");
const when = (iso: string) => dayTimeFormat.format(new Date(iso)).replace(":", "h");

const DIFFICULTY_LABELS = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" } as const;

const rules = [
  "Un défi du jour est publié dans #defis le matin et reste ouvert jusqu’au soir ; un défi éclair (anagramme) peut suivre en soirée. Les heures sont celles de Tunis.",
  "Les réponses se donnent uniquement en conversation privée avec DefisBot. Une réponse écrite dans le salon n’est jamais comptée et gâcherait le défi des autres.",
  "Pour marquer des points, votre pseudo doit être enregistré et identifié auprès de NickServ, et vous devez être présent dans #defis.",
  "Le nombre d’essais est limité pour chaque défi. Majuscules, accents, ponctuation et article initial (le, la, un…) ne comptent pas.",
  "Une seule récompense par défi et par compte : changer de pseudo ne permet ni de rejouer ni de récupérer des essais.",
  "Les indices se demandent en privé avec !indice ; chacun réduit les points gagnés. La réponse est révélée dans le salon à la clôture du défi.",
];

const commands = [
  { where: "Privé", command: "votre réponse", effect: "Proposer une réponse au défi en cours." },
  { where: "Privé", command: "!indice", effect: "Recevoir l’indice suivant (moins de points)." },
  { where: "Privé", command: "!score", effect: "Vos points du jour, du mois et au total." },
  { where: "Salon ou privé", command: "!defi", effect: "Afficher le défi en cours ou l’heure du prochain." },
  { where: "Salon ou privé", command: "!classement jour | mois | total", effect: "Afficher un classement." },
  { where: "Salon ou privé", command: "!regles · !aide", effect: "Rappeler les règles et les commandes." },
];

const PERIODS: { period: DefisPeriod; title: string; empty: string }[] = [
  { period: "day", title: "Aujourd’hui", empty: "Personne n’a encore relevé le défi aujourd’hui." },
  { period: "month", title: "Ce mois-ci", empty: "Aucun point ce mois-ci pour l’instant." },
  { period: "all", title: "Depuis le début", empty: "Le classement se remplira avec les premiers défis relevés." },
];

function availabilityText(status: DefisStatusResult): string {
  if (status.status === "not-configured") return "Les Défis du jour ouvrent bientôt : le salon #defis est déjà accessible.";
  if (status.status === "unavailable") return "L’état de DefisBot ne peut pas être vérifié pour le moment. Réessayez dans quelques instants.";
  switch (status.availability) {
    case "available": return "DefisBot est connecté au salon #defis et accepte vos réponses en privé.";
    case "paused": return "Le jeu est en pause : DefisBot n’accepte pas de réponse pour l’instant.";
    default: return "DefisBot n’est pas disponible pour le moment. Les réponses envoyées maintenant ne seraient pas comptées.";
  }
}

function Ranking({ result, title, empty }: { result: DefisLeaderboardResult; title: string; empty: string }) {
  return <div className="defis-ranking">
    <h3>{title}</h3>
    {result.status === "available"
      ? result.entries.length ? <DefisLeaderboard entries={result.entries} caption={`Classement des Défis du jour — ${title.toLowerCase()}`} /> : <GameDataNotice kind="empty" title="Aucun score" text={empty} />
      : <GameDataNotice kind={result.status} text={result.status === "not-configured" ? "Les classements des Défis seront publiés dès l’ouverture du jeu." : undefined} />}
  </div>;
}

export default async function DefisPage() {
  const defis = getGameInfo("defis");
  const [statusResult, current, ...boards] = await Promise.all([
    getDefisStatus(), getDefisCurrent(), ...PERIODS.map(({ period }) => getDefisLeaderboard(period)),
  ]);
  const status = gameStatus(defis, false, false, defisGameStatus(statusResult));
  const live = statusResult.status === "known" && statusResult.availability === "available";
  const challenge = current.status === "known" ? current.challenge : null;
  const nextOpensAt = statusResult.status === "known" ? statusResult.nextOpensAt : null;

  return <>
    <section className="games-hero games-hero-compact">
      <div className="container">
        <GamesBreadcrumb items={[{ label: "Jeux", href: "/jeux" }, { label: "Défis du jour", href: "/jeux/defis" }]} />
        <div className="games-hero-inner quiz-hero"><div className="games-hero-copy">
          <span className={`game-status game-status-${status.tone}`} role="status">{status.label}</span>
          <h1>Les Défis du jour</h1>
          <p>Chaque jour, une énigme, un problème de logique, une anagramme ou un mot mystère à résoudre dans #defis. Répondez en privé à <strong>DefisBot</strong>, gardez vos indices pour les cas désespérés et grimpez au classement.</p>
          <div className="games-hero-actions">
            <a className="button button-primary button-large" href="#participer">Comment participer <Icon name="arrow" size={17} /></a>
            <a href="#classements" className="button button-ghost button-large">Voir les classements</a>
          </div>
        </div>{defis.artwork && <figure className="quiz-hero-art"><Image src={defis.artwork.src} alt={defis.artwork.alt} width={defis.artwork.width} height={defis.artwork.height} sizes="(max-width: 700px) min(340px, calc(100vw - 40px)), 420px" preload /></figure>}</div>
      </div>
    </section>

    <section className="section defis-current-section" aria-labelledby="defis-current-title">
      <div className="container">
        <SectionHeading eyebrow="Défi en cours" title="Le défi du moment." />
        <div className="defis-current">
          {challenge ? <article className="defis-challenge" aria-labelledby="defis-current-title">
            <p className="defis-challenge-meta"><span className="game-kind">{challenge.kindLabel}</span><span>{DIFFICULTY_LABELS[challenge.difficulty]}</span><span>Ouvert jusqu’à {at(challenge.closesAt)} (heure de Tunis)</span></p>
            <h3 id="defis-current-title">{challenge.title ?? "Défi du jour"}</h3>
            <blockquote className="defis-challenge-prompt">{challenge.prompt}</blockquote>
            <p className="defis-challenge-foot">{challenge.solves === 0 ? "Personne ne l’a encore résolu." : `${formatCount(challenge.solves)} joueur${challenge.solves > 1 ? "s l’ont" : " l’a"} déjà résolu.`} Répondez en privé à DefisBot, jamais dans le salon.</p>
          </article> : <div className="game-notice" id="defis-current-title"><h3>{live ? "Aucun défi ouvert en ce moment" : "Défi indisponible pour le moment"}</h3><p>{nextOpensAt ? `Prochain défi : ${when(nextOpensAt)} (heure de Tunis).` : availabilityText(statusResult)}</p></div>}
          <p className="defis-availability" role="note"><Icon name="shield" size={18} /> {availabilityText(statusResult)}</p>
        </div>
      </div>
    </section>

    <section id="participer" className="section quiz-join-section">
      <div className="container quiz-join-grid">
        <div>
          <SectionHeading eyebrow="Participer" title="Quatre étapes pour relever le défi." />
          <ol className="games-steps games-steps-stacked">
            <li><span className="games-step-number" aria-hidden="true">1</span><h3>Identifiez votre pseudo</h3><p>Seuls les pseudos enregistrés et identifiés auprès de NickServ marquent des points.</p></li>
            <li><span className="games-step-number" aria-hidden="true">2</span><h3>Entrez dans #defis</h3><p>Rejoignez le salon depuis le chat Chatnet : DefisBot y publie le défi du jour.</p></li>
            <li><span className="games-step-number" aria-hidden="true">3</span><h3>Ouvrez la conversation privée</h3><p>Touchez le bouton « Répondre au défi » dans #defis, ou cliquez sur le pseudo DefisBot. Aucune commande à taper.</p></li>
            <li><span className="games-step-number" aria-hidden="true">4</span><h3>Écrivez votre réponse</h3><p>Envoyez simplement votre réponse dans cette conversation. DefisBot vous dit tout de suite si c’est gagné.</p></li>
          </ol>
        </div>
        <aside className="quiz-access" aria-label="Accès au salon des Défis">
          <ChatJoinForm selectedRoom="defis" />
        </aside>
      </div>
    </section>

    <section className="section quiz-rules-section">
      <div className="container quiz-rules-grid">
        <div>
          <SectionHeading eyebrow="Règles" title="Comment fonctionnent les Défis ?" />
          <ul className="quiz-rule-list">{rules.map((rule) => <li key={rule}><Icon name="spark" size={17} />{rule}</li>)}</ul>
        </div>
        <div>
          <SectionHeading eyebrow="Points" title="Le barème habituel." />
          <table className="quiz-table">
            <caption className="sr-only">Points des Défis du jour</caption>
            <thead><tr><th scope="col">Situation</th><th scope="col">Points</th></tr></thead>
            <tbody>
              <tr><th scope="row">Défi facile · moyen · difficile</th><td>10 · 20 · 30 points</td></tr>
              <tr><th scope="row">Chaque indice utilisé</th><td>−25 % des points de base</td></tr>
              <tr><th scope="row">1er, 2e et 3e à trouver</th><td>+5, +3 et +1 point</td></tr>
              <tr><th scope="row">Mauvaise réponse ou essais épuisés</th><td>0 point</td></tr>
            </tbody>
          </table>
          <p className="quiz-note">L’équipe peut ajuster le barème ; DefisBot annonce toujours les points en jeu. Les classements utilisent uniquement les résultats enregistrés par le jeu : ils ne peuvent pas être modifiés depuis ce site.</p>
        </div>
      </div>
    </section>

    <section className="section quiz-commands-section">
      <div className="container">
        <SectionHeading eyebrow="Commandes" title="Les commandes de DefisBot." description="Elles sont facultatives : pour jouer, il suffit d’écrire votre réponse en privé à DefisBot." />
        <div className="leaderboard-scroll" role="region" aria-label="Commandes des Défis du jour" tabIndex={0}>
          <table className="quiz-table quiz-commands">
            <caption className="sr-only">Commandes des Défis du jour</caption>
            <thead><tr><th scope="col">Commande</th><th scope="col">Où</th><th scope="col">Action</th></tr></thead>
            <tbody>{commands.map((row) => <tr key={row.command}><th scope="row"><code>{row.command}</code></th><td>{row.where}</td><td>{row.effect}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="classements" className="section games-ranking-section">
      <div className="container">
        <SectionHeading eyebrow="Classements" title="Les meilleurs joueurs des Défis." description="Jour et mois suivent le calendrier de Tunis." />
        <div className="defis-rankings">{PERIODS.map((item, index) => <Ranking key={item.period} result={boards[index]!} title={item.title} empty={item.empty} />)}</div>
        <p className="games-how-note"><Link href="/jeux/classement" className="text-link">Tous les classements Chatnet <Icon name="arrow" size={17} /></Link></p>
      </div>
    </section>
  </>;
}
