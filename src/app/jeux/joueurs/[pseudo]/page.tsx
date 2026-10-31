import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameDataNotice } from "@/components/games/GameDataNotice";
import { GamesBreadcrumb } from "@/components/games/GamesBreadcrumb";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { Icon } from "@/components/ui/Icons";
import { getPlayerIdentity } from "@/lib/api/game-identities.server";
import { getPlayerProfile, LEADERBOARD_LIMIT } from "@/lib/api/games.server";
import { formatCount, gameCatalogue, NICKNAME_OWNER_CAVEAT, NICKNAME_OWNER_LABEL, normalizePlayerRouteParam, playerHref } from "@/lib/games";
import { pageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ pseudo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pseudo } = await params;
  const result = await getPlayerProfile(pseudo);
  const nickname = result.status === "found" ? result.player.nickname : null;
  return {
    ...pageMetadata(nickname ? `Statistiques de ${nickname}` : "Statistiques de joueur", nickname ? `Points, parties jouées et victoires de ${nickname} aux jeux Chatnet.` : "Statistiques publiques des joueurs Chatnet.", playerHref(nickname ?? normalizePlayerRouteParam(pseudo))),
    // One page per nickname would be thin, auto-generated content: keep them out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function PlayerPage({ params }: Props) {
  const result = await getPlayerProfile((await params).pseudo);
  if (result.status === "not-found") notFound();
  if (result.status !== "found") return <>
    <section className="games-hero games-hero-compact"><div className="container"><div className="games-hero-copy"><span className="eyebrow">Joueur</span><h1>Statistiques indisponibles.</h1><p>Les statistiques des joueurs ne peuvent pas être affichées pour le moment.</p></div></div></section>
    <section className="section rankings-section"><div className="container"><GameDataNotice kind={result.status} heading="h2" {...(result.status === "not-configured" ? { title: "Statistiques bientôt disponibles", text: "Les statistiques des joueurs seront publiées dès l’ouverture du service de jeux." } : { title: "Statistiques momentanément indisponibles", text: "Les statistiques ne peuvent pas être chargées pour le moment. Réessayez dans quelques instants." })}><Link href="/jeux/classement" className="button button-outline">Retour au classement</Link></GameDataNotice></div></section>
  </>;

  const { player } = result;
  // Only the photo and the wording change: scores, ranks and wins stay the Game API's, whoever the member is.
  const identity = await getPlayerIdentity(player.nickname);
  return <>
    <section className="games-hero games-hero-compact"><div className="container"><GamesBreadcrumb schema={false} items={[{ label: "Jeux", href: "/jeux" }, { label: "Classement", href: "/jeux/classement" }, { label: player.nickname, href: playerHref(player.nickname) }]} /><div className="player-head"><PlayerAvatar nickname={player.nickname} identity={identity} size={92} /><div className="games-hero-copy"><span className="eyebrow">Joueur Chatnet</span><h1>{player.nickname}</h1><p>Statistiques publiques enregistrées par les jeux du réseau Chatnet.</p></div></div></div></section>
    <section className="section rankings-section"><div className="container"><div className="player-games">{gameCatalogue.map((game) => {
      const stats = player.scores[game.id];
      return <article className={`player-game${game.implemented ? "" : " player-game-planned"}`} key={game.id}><div className="player-game-head"><span className="game-tile-mark" aria-hidden="true">{game.artwork ? <Image src={game.artwork.src} alt="" width={50} height={50} /> : game.mark}</span><h2>{game.name}</h2>{game.implemented && stats.rank !== null && <span className="player-rank">{stats.rank === 1 ? "1er" : `${stats.rank}e`}<span className="sr-only"> au classement</span></span>}</div>{game.implemented ? <><dl className="player-stats"><div><dt>Points</dt><dd>{formatCount(stats.points)}</dd></div><div><dt>Parties jouées</dt><dd>{formatCount(stats.gamesPlayed)}</dd></div><div><dt>Victoires</dt><dd>{formatCount(stats.wins)}</dd></div></dl><p className="player-game-note">{stats.rank !== null ? `Classé ${stats.rank === 1 ? "1er" : `${stats.rank}e`} du ${game.name}.` : stats.gamesPlayed > 0 || stats.points > 0 ? `Hors du top ${LEADERBOARD_LIMIT} publié.` : "Aucune partie jouée pour le moment."}</p></> : <p className="player-game-note">Jeu en préparation : aucune statistique pour le moment.</p>}</article>;
    })}</div>{identity.account
      ? <p className="player-disclaimer player-disclaimer-verified"><Icon name="shield" size={18} /> <span>Compte membre vérifié : <strong>{identity.account.nickname}</strong>. Les points du Quiz de ce pseudo ont été marqués avec le compte de chat vérifié de ce membre.</span></p>
      : identity.nicknameOwner
        ? <p className="player-disclaimer player-disclaimer-owner"><Icon name="shield" size={18} /> <span>{NICKNAME_OWNER_LABEL} : <strong>{identity.nicknameOwner.nickname}</strong>. {NICKNAME_OWNER_CAVEAT}</span></p>
        : <p className="player-disclaimer"><Icon name="shield" size={18} /> Ce pseudo est utilisé dans les salons de jeu. Il n’est pas forcément associé à un compte membre Chatnet du même nom.</p>}
    <div className="player-actions">{identity.account && <Link href={identity.account.profileHref} className="button button-primary">Profil membre<span className="sr-only"> de {identity.account.nickname}</span></Link>}{identity.nicknameOwner && <Link href={identity.nicknameOwner.profileHref} className="button button-primary">Profil associé<span className="sr-only"> au pseudo : {identity.nicknameOwner.nickname}</span></Link>}<Link href="/jeux/classement" className="button button-outline">Retour au classement</Link></div></div></section>
  </>;
}
