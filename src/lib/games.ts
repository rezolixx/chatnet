export interface GamePreview {
  title: string;
  description: string;
  kind: string;
  mark: string;
}

// Editorial preview only. No scores or rankings are represented as live data.
export const games: GamePreview[] = [
  { title: "Quiz entre amis", description: "Des questions pour lancer la conversation et jouer ensemble.", kind: "Culture & découverte", mark: "?" },
  { title: "Défis du jour", description: "De petites occasions de se retrouver autour d’un même objectif.", kind: "Défis", mark: "↗" },
  { title: "Jeux de mots", description: "Des idées de jeu pour celles et ceux qui aiment les mots.", kind: "Langue & réflexion", mark: "Aa" },
];

// Game System B3: identifiers, names and channels mirror game-system
// packages/shared/src/games.ts. Only the Quiz has a game engine today.
export const GAME_IDS = ["quiz", "motus", "defis"] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface GameInfo {
  id: GameId;
  name: string;
  channel: string;
  kind: string;
  mark: string;
  tagline: string;
  description: string;
  /** Detail page; null while the game has no engine (no thin placeholder pages). */
  href: string | null;
  implemented: boolean;
  /** Official illustration (public/), shown instead of the text mark. */
  artwork?: GameArtwork;
}

export interface GameArtwork {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Wider crop of the same artwork for the catalogue card banner, keeping the face prominent. */
  card?: { src: string; width: number; height: number };
}

export const gameCatalogue: readonly GameInfo[] = [
  { id: "quiz", name: "Quiz", channel: "#quiz", kind: "Culture générale", mark: "?", tagline: "Questions en direct, première bonne réponse gagnante.", description: "Histoire, géographie, sciences, cinéma, musique, sport : répondez le plus vite possible dans le salon #quiz et marquez des points pour le classement.", href: "/jeux/quiz", implemented: true, artwork: { src: "/games/quizbot.webp", width: 1792, height: 1024, alt: "QuizBot, le robot du Quiz Chatnet", card: { src: "/games/quizbot-card.webp", width: 1792, height: 660 } } },
  { id: "motus", name: "Motus", channel: "#motus", kind: "Jeu de mots", mark: "Aa", tagline: "Retrouver le mot caché, lettre après lettre.", description: "Un jeu de lettres à partager avec la communauté. Motus est en préparation : il n’est pas encore jouable.", href: null, implemented: false },
  { id: "defis", name: "Défis du jour", channel: "#defis", kind: "Défis", mark: "↗", tagline: "Un rendez-vous quotidien à relever ensemble.", description: "Un nouveau défi chaque jour pour se retrouver autour d’un même objectif. Les Défis du jour sont en préparation : ils ne sont pas encore jouables.", href: null, implemented: false },
];

export function getGameInfo(id: GameId): GameInfo {
  return gameCatalogue.find((game) => game.id === id)!;
}

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}

export interface GameStats {
  points: number;
  gamesPlayed: number;
  wins: number;
}

export interface LeaderboardEntry extends GameStats {
  rank: number;
  nickname: string;
}

/**
 * A Chatnet member account whose ownership of an IRC game nickname has been
 * verified server-side: the services account the Game API recorded for the
 * player is bound to that member (user_profiles.irc_account_uniqueid = NickCore).
 * Never inferred from nickname equality. Only public fields: no account name or id.
 */
export interface VerifiedPlayerAccount {
  verified: true;
  /** Public member nickname, which may differ from the IRC game nickname. */
  nickname: string;
  /** Same public avatar URL as /communaute; null keeps the initial. */
  avatar: string | null;
  profileHref: string;
}

/**
 * The Chatnet member who currently owns the registered NickServ nickname shown
 * on a row (Laravel nickname-owners, docs/verified-game-identities.md). It
 * proves nothing about who scored the points: they may predate the
 * registration, or come from a previous owner. Only public fields.
 */
export interface CurrentNicknameOwner {
  verified: false;
  association: "registered_nickname_current";
  /** Public member nickname, which may differ from the IRC game nickname. */
  nickname: string;
  avatar: string | null;
  profileHref: string;
}

// The wording for a current nickname owner: never "verified player", never authorship of the points.
export const NICKNAME_OWNER_LABEL = "Profil actuellement associé à ce pseudo de chat";
export const NICKNAME_OWNER_CAVEAT = "Ce membre n’a pas forcément marqué les points affichés : ils peuvent dater d’avant son enregistrement du pseudo.";

/** Who a game nickname points to. A verified account always wins over a current nickname owner. */
export type PlayerIdentity = { account: VerifiedPlayerAccount; nicknameOwner?: never } | { account?: never; nicknameOwner: CurrentNicknameOwner } | { account?: never; nicknameOwner?: never };

export type LeaderboardRow = LeaderboardEntry & PlayerIdentity;

/** The photo of whichever member a row points to, or null for the initial. */
export function identityAvatar(identity: PlayerIdentity): string | null {
  return identity.account?.avatar ?? identity.nicknameOwner?.avatar ?? null;
}

export type LeaderboardResult =
  | { status: "not-configured" }
  | { status: "unavailable" }
  | { status: "available"; game: GameId; entries: LeaderboardEntry[] };

export interface PlayerGameStats extends GameStats {
  /** Position when the player appears in the published top of that leaderboard. */
  rank: number | null;
}

export interface PlayerProfile {
  nickname: string;
  scores: Record<GameId, PlayerGameStats>;
}

export type PlayerProfileResult =
  | { status: "not-configured" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "found"; player: PlayerProfile };

// IRC nicknames as accepted by the Game API (RFC 2812, 30 characters max).
export const NICKNAME_MAX_LENGTH = 30;
const NICKNAME_PATTERN = /^[A-Za-z[\]\\`_^{|}][A-Za-z0-9[\]\\`_^{|}-]*$/;

export function isValidNickname(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= NICKNAME_MAX_LENGTH && NICKNAME_PATTERN.test(value);
}

export function normalizePlayerRouteParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Next 16 hands the encoded segment to page code: decode exactly once (see rooms.ts).
  try {
    const nickname = decodeURIComponent(value);
    return isValidNickname(nickname) ? nickname : null;
  } catch {
    return null;
  }
}

export function playerHref(nickname: unknown): string {
  return isValidNickname(nickname) ? `/jeux/joueurs/${encodeURIComponent(nickname)}` : "/jeux/classement";
}

export function sameNickname(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

const numberFormat = new Intl.NumberFormat("fr-FR");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count > 1 ? plural : singular}`;
}
