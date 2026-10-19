import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { publicMemberModules } from "./helpers/public-member.mjs";

const jsx = React.createElement;
const markup = (tree) => renderToStaticMarkup(tree);
const plain = (value) => JSON.parse(JSON.stringify(value));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const GAME_API = "https://jeux-api.test";
const LARAVEL = "https://laravel.chatnet.test";
const KEY = "k".repeat(40);
const TOKEN = "t0ken".repeat(13);
const BASE_ENV = { GAME_API_BASE_URL: GAME_API, API_BASE_URL: LARAVEL };
const OWNERS = { ...BASE_ENV, GAMES_CURRENT_NICKNAME_AVATARS: "true", GAMES_IDENTITY_KEY: KEY };
const BOTH = { ...OWNERS, GAMES_VERIFIED_AVATARS: "true", INTERNAL_GAME_API_TOKEN: TOKEN };
const AVATAR = "https://laravel.chatnet.test/storage/avatars/aymen.webp";
const OTHER_AVATAR = "https://laravel.chatnet.test/storage/avatars/other.webp";

const stats = (rank, nickname, extra = {}) => ({ rank, nickname, points: 100 - rank, gamesPlayed: 5, wins: 1, ...extra });
const board = (entries) => ({ game: "quiz", name: "Quiz", limit: 50, entries });
const owner = (nickname, memberNickname = nickname, avatar = AVATAR) => ({ nickname, member: { nickname: memberNickname, avatar }, association: "registered_nickname_current" });
const owners = (...entries) => json({ nicknames: entries });
const scores = (nickname, quiz) => ({ nickname, scores: { quiz, motus: { points: 0, gamesPlayed: 0, wins: 0 }, defis: { points: 0, gamesPlayed: 0, wins: 0 } } });
const withoutAccount = ({ ircAccount, ...entry }) => (void ircAccount, entry);
const stripIdentity = ({ account, nicknameOwner, ...entry }) => (void account, void nicknameOwner, entry);

// Today's production state: aYmen's points are historical, so the internal board says ircAccount: null.
const HISTORICAL = [stats(1, "aYmen", { ircAccount: null }), stats(2, "Lea", { ircAccount: null })];

// Real modules; the Game API (public, internal, scores) and both Laravel resolvers sit behind one fetch stub.
function harness({ entries = HISTORICAL, nicknameOwners = () => owners(), verifiedMembers = () => json({ members: [] }), env = OWNERS, player = null } = {}) {
  const calls = [];
  const logs = [];
  const capture = (...args) => logs.push(args.map(String).join(" "));
  const reply = (handler, ...args) => {
    const response = handler(...args);
    if (response instanceof Error) throw response;
    return response;
  };
  const modules = publicMemberModules(async (url, init) => {
    calls.push({ url, init });
    const { origin, pathname } = new URL(url);
    if (origin === GAME_API && pathname === "/api/leaderboards/quiz") return json(board(entries.map(withoutAccount)));
    if (origin === GAME_API && pathname === "/internal/leaderboards/quiz") return init.headers.Authorization === `Bearer ${TOKEN}` ? json(board(entries.map((entry) => ({ ircAccount: null, ...entry })))) : json({}, 401);
    if (origin === GAME_API && pathname.startsWith("/api/leaderboards/")) return json(board([]));
    if (origin === GAME_API && pathname.startsWith("/api/scores/") && player) return json(player);
    if (origin === LARAVEL && pathname === "/api/internal/games/nickname-owners") return reply(nicknameOwners, JSON.parse(init.body), init);
    if (origin === LARAVEL && pathname === "/api/internal/games/verified-members") return reply(verifiedMembers, JSON.parse(init.body), init);
    throw new Error(`Unexpected request ${url}`);
  }, env, { console: { warn: capture, error: capture, log: capture, info: capture } });
  const ownerCalls = () => calls.filter((call) => call.url === `${LARAVEL}/api/internal/games/nickname-owners`);
  const verifiedCalls = () => calls.filter((call) => call.url === `${LARAVEL}/api/internal/games/verified-members`);
  const internalCalls = () => calls.filter((call) => call.url.startsWith(`${GAME_API}/internal/`));
  const leaderboard = async () => plain(await modules.load("lib/api/game-identities.server.ts").getVerifiedLeaderboard("quiz"));
  const playerPage = async (pseudo) => markup(await modules.load("app/jeux/joueurs/[pseudo]/page.tsx").default({ params: Promise.resolve({ pseudo }) }));
  return { modules, calls, logs, ownerCalls, verifiedCalls, internalCalls, leaderboard, playerPage };
}

const aymenOwner = { verified: false, association: "registered_nickname_current", nickname: "aYmen", avatar: AVATAR, profileHref: "/membre/aYmen" };

test("flag off by default: Laravel's nickname-owners endpoint is never called and rows keep their initial", async () => {
  for (const env of [
    BASE_ENV,
    { ...BASE_ENV, GAMES_IDENTITY_KEY: KEY },
    { ...OWNERS, GAMES_CURRENT_NICKNAME_AVATARS: "false" },
    { ...OWNERS, GAMES_CURRENT_NICKNAME_AVATARS: "1" },
    { ...OWNERS, GAMES_IDENTITY_KEY: "" },
    { ...OWNERS, GAMES_IDENTITY_KEY: "too-short" },
    // GAMES_VERIFIED_AVATARS is a separate flag: it never turns this one on.
    { ...BOTH, GAMES_CURRENT_NICKNAME_AVATARS: undefined },
  ]) {
    const h = harness({ env, nicknameOwners: () => { throw new Error("must not be called"); } });
    const result = await h.leaderboard();
    assert.deepEqual(result.entries, HISTORICAL.map(withoutAccount));
    assert.equal(h.ownerCalls().length, 0);
  }
});

test("historical aYmen (ircAccount: null) shows the current registered owner's avatar, never as a verified player", async () => {
  const h = harness({ nicknameOwners: () => owners(owner("aYmen")) });
  const [aymen, lea] = (await h.leaderboard()).entries;
  assert.deepEqual(aymen, { ...stats(1, "aYmen"), nicknameOwner: aymenOwner });
  assert.equal(aymen.account, undefined);
  assert.deepEqual(lea, stats(2, "Lea"));
  // The verified chain is off here: no internal Game API or verified-members call.
  assert.equal(h.internalCalls().length, 0);
  assert.equal(h.verifiedCalls().length, 0);
});

test("request: one server-side POST with the identity key and only the shown nicknames, no visitor data", async () => {
  const h = harness({ entries: [stats(1, "aYmen"), stats(2, "Lea"), stats(3, "AYMEN"), stats(4, "[Rezo]")], nicknameOwners: () => owners(owner("aYmen")) });
  const result = await h.leaderboard();
  const [call] = h.ownerCalls();
  assert.equal(h.ownerCalls().length, 1);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers["X-Chatnet-Games-Identity-Key"], KEY);
  assert.equal(call.init.headers["Content-Type"], "application/json");
  // ASCII case-insensitive deduplication keeps the first spelling, as Laravel does.
  assert.deepEqual(JSON.parse(call.init.body), { nicknames: ["aYmen", "Lea", "[Rezo]"] });
  assert.doesNotMatch(JSON.stringify(call.init.headers), /cookie|authorization/i);
  assert.ok(call.init.signal);
  // The same registered nickname, whatever its case, points to the same owner.
  assert.equal(result.entries[2].nicknameOwner.nickname, "aYmen");
});

test("rows, ranks, points and wins are never changed, merged or reassigned", async () => {
  const entries = [stats(1, "aYmen", { points: 900, wins: 30 }), stats(2, "aYmen_", { points: 10 }), stats(3, "Lea")];
  const h = harness({ entries, nicknameOwners: () => owners(owner("aYmen"), owner("aYmen_", "aYmen")) });
  const result = await h.leaderboard();
  assert.deepEqual(result.entries.map(stripIdentity), entries);
  // Two nicknames registered by the same member stay two rows with their own points.
  assert.equal(result.entries.length, 3);
  assert.equal(result.entries[0].nicknameOwner.profileHref, "/membre/aYmen");
  assert.equal(result.entries[1].nicknameOwner.profileHref, "/membre/aYmen");
});

test("verified score provenance takes precedence over the current nickname owner", async () => {
  const entries = [stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "Lea", { ircAccount: null })];
  const h = harness({
    env: BOTH,
    entries,
    verifiedMembers: () => json({ members: [{ account: "aYmen", nickname: "aYmen", avatar: AVATAR }] }),
    // The nickname is now registered by someone else: it must not replace the proven identity.
    nicknameOwners: () => owners(owner("aYmen", "NewOwner", OTHER_AVATAR), owner("Lea")),
  });
  const [aymen, lea] = (await h.leaderboard()).entries;
  assert.deepEqual(aymen.account, { verified: true, nickname: "aYmen", avatar: AVATAR, profileHref: "/membre/aYmen" });
  assert.equal(aymen.nicknameOwner, undefined);
  assert.equal(lea.account, undefined);
  assert.equal(lea.nicknameOwner.nickname, "Lea");
  assert.equal(h.verifiedCalls().length, 1);
});

test("strict validation: only requested nicknames, valid public members and registered_nickname_current", async () => {
  const entries = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"].map((nickname, index) => stats(index + 1, nickname));
  const h = harness({ entries, nicknameOwners: () => owners(
    owner("p1"),
    { ...owner("p2"), association: "verified_player" },
    { nickname: "p3", member: { nickname: "p3", avatar: AVATAR } },
    { ...owner("p4"), uniqueid: 4242 },
    { ...owner("p5"), member: { nickname: "p5", avatar: AVATAR, email: "p5@example.test" } },
    owner("p6", "../admin"),
    owner("p7", ""),
    owner("P8"),
    owner("p9"), owner("p9", "Other"),
    owner("p10", "p10", "javascript:alert(1)"),
    { ...owner("p11"), member: "p11" },
    owner("Stranger"),
    "garbage",
    null,
  ) });
  const byNickname = Object.fromEntries((await h.leaderboard()).entries.map((entry) => [entry.nickname, entry.nicknameOwner ?? null]));
  assert.equal(byNickname.p1.nickname, "p1");
  for (const nickname of ["p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p11"]) assert.equal(byNickname[nickname], null, nickname);
  // An unsafe avatar only loses the photo.
  assert.deepEqual(byNickname.p10, { verified: false, association: "registered_nickname_current", nickname: "p10", avatar: null, profileHref: "/membre/p10" });
  assert.ok(!JSON.stringify(byNickname).includes("Stranger"));
});

test("projection never keeps private fields", async () => {
  const h = harness();
  const { projectNicknameOwners } = h.modules.load("lib/api/game-identities.server.ts");
  const projected = plain([...projectNicknameOwners({ nicknames: [owner("aYmen")], uniqueid: 1, debug: "x" }, ["aYmen"]).values()]);
  assert.deepEqual(projected, [aymenOwner]);
  assert.throws(() => projectNicknameOwners({ members: [] }, ["aYmen"]), /Invalid nickname owners/);
  assert.throws(() => projectNicknameOwners([owner("aYmen")], ["aYmen"]), /Invalid nickname owners/);
});

test("401, 404, 429, 503, timeout or malformed data fall back to the existing avatars, without secrets in logs", async () => {
  for (const [nicknameOwners, reason] of [
    [() => json({ message: "Unauthorized" }, 401), "HTTP 401"],
    [() => json({ message: "Not Found" }, 404), "HTTP 404"],
    [() => json({ message: "Too Many Attempts." }, 429), "HTTP 429"],
    [() => json({ message: "Unavailable" }, 503), "HTTP 503"],
    // Errors thrown by this stub come from another realm: the log then says "Unknown error".
    [() => new Error("The operation was aborted due to timeout"), null],
    [() => new Error("fetch failed"), null],
    [() => new Response("<html>", { status: 200 }), null],
    [() => json({ nicknames: "aYmen" }), "Invalid nickname owners"],
    [() => json(null), "Invalid nickname owners"],
  ]) {
    const h = harness({ nicknameOwners });
    const result = await h.leaderboard();
    assert.equal(result.status, "available");
    assert.deepEqual(result.entries, HISTORICAL.map(withoutAccount));
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0], /^\[Chatnet game identities\] nickname owners unavailable: /);
    if (reason) assert.ok(h.logs[0].endsWith(reason), h.logs[0]);
    assert.ok(!h.logs[0].includes(KEY));
    assert.doesNotMatch(h.logs[0], /aYmen|Lea/);
  }
});

test("the verified avatars keep working when nickname owners fail", async () => {
  const h = harness({
    env: BOTH,
    entries: [stats(1, "aYmen", { ircAccount: "aYmen" })],
    verifiedMembers: () => json({ members: [{ account: "aYmen", nickname: "aYmen", avatar: AVATAR }] }),
    nicknameOwners: () => json({}, 503),
  });
  const [aymen] = (await h.leaderboard()).entries;
  assert.equal(aymen.account.avatar, AVATAR);
});

test("ownership is never cached: no Data Cache options, and each render reflects Laravel's current answer", async () => {
  const answers = [owners(owner("aYmen")), owners(owner("aYmen", "NewOwner", OTHER_AVATAR)), owners()];
  const h = harness({ nicknameOwners: () => answers.shift() });
  const first = (await h.leaderboard()).entries[0];
  const second = (await h.leaderboard()).entries[0];
  const third = (await h.leaderboard()).entries[0];
  assert.equal(first.nicknameOwner.profileHref, "/membre/aYmen");
  // Dropped and re-registered by another member: the new owner, never the old one.
  assert.equal(second.nicknameOwner.profileHref, "/membre/NewOwner");
  assert.equal(second.nicknameOwner.avatar, OTHER_AVATAR);
  // Dropped: back to the initial.
  assert.equal(third.nicknameOwner, undefined);
  assert.equal(h.ownerCalls().length, 3);
  for (const call of h.ownerCalls()) {
    // No `next.revalidate` and no `cache`: at runtime Next does not store the answer (auto no cache).
    assert.equal(call.init.next, undefined);
    assert.equal(call.init.cache, undefined);
  }
  const source = readFileSync(new URL("../src/lib/api/game-identities.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /unstable_cache|"use cache"|force-cache|localStorage|cookies\(/);
});

test("/jeux/classement renders the owner avatar and keeps keys and private data out of the HTML", async () => {
  const h = harness({ nicknameOwners: () => owners(owner("aYmen")) });
  const html = markup(await h.modules.load("app/jeux/classement/page.tsx").default());
  assert.match(html, /data-avatar="nickname-owner"><span>A<\/span><img alt="" [^>]*src="https:\/\/laravel\.chatnet\.test\/storage\/avatars\/aymen\.webp"/);
  assert.equal((html.match(/data-avatar="initial"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-avatar="member"/);
  assert.doesNotMatch(html, /kkkkkkkk|uniqueid|registered_nickname_current|X-Chatnet/i);
});

test("player card: current nickname owner wording, link to the profile, no verified or authorship claim", async () => {
  const h = harness();
  const { PlayerProfileDialog } = h.modules.load("components/games/PlayerProfileDialog.tsx");
  const html = markup(jsx(PlayerProfileDialog, { player: { ...stats(1, "aYmen"), nicknameOwner: { ...aymenOwner, nickname: "Aymen_web" } }, onClose() {} }));
  assert.match(html, /data-avatar="nickname-owner"><span>A<\/span><img alt="" [^>]*width="72"/);
  assert.match(html, /<p class="player-dialog-note player-dialog-owner">.*<span>Profil actuellement associé à ce pseudo IRC : <strong>Aymen_web<\/strong>\. Ce membre n’a pas forcément marqué les points affichés/);
  assert.match(html, /class="button button-outline" href="\/membre\/aYmen">Profil associé<span class="sr-only"> au pseudo : Aymen_web<\/span><\/a>/);
  assert.doesNotMatch(html, /vérifié|Profil membre|a marqué ces points|ses points/);
  // The 99 points stay displayed as the nickname's, unchanged.
  assert.match(html, /<dt>Points<\/dt><dd>99<\/dd>/);
});

test("/jeux/joueurs/[pseudo]: historical aYmen shows the current owner's avatar with the accurate wording", async () => {
  const h = harness({ player: scores("aYmen", { points: 99, gamesPlayed: 5, wins: 1 }), nicknameOwners: () => owners(owner("aYmen")) });
  const html = await h.playerPage("aymen");
  assert.match(html, /class="player-thumb player-thumb-large player-avatar" aria-hidden="true" data-avatar="nickname-owner"><span>A<\/span><img alt="" [^>]*width="92"[^>]*src="https:\/\/laravel\.chatnet\.test\/storage\/avatars\/aymen\.webp"/);
  assert.match(html, /<p class="player-disclaimer player-disclaimer-owner">.*Profil actuellement associé à ce pseudo IRC : <strong>aYmen<\/strong>/);
  assert.match(html, /href="\/membre\/aYmen">Profil associé/);
  assert.match(html, /<dt>Points<\/dt><dd>99<\/dd>/);
  assert.doesNotMatch(html, /Compte membre vérifié|pas forcément associé à un compte membre/);
  assert.doesNotMatch(html, /kkkkkkkk|uniqueid|registered_nickname_current/);
  // Only the canonical nickname of the page is sent.
  assert.deepEqual(h.ownerCalls().map((call) => JSON.parse(call.init.body)), [{ nicknames: ["aYmen"] }]);
});

test("/jeux/joueurs/[pseudo]: verified score provenance wins over the current owner", async () => {
  const h = harness({
    env: BOTH,
    entries: [stats(1, "aYmen", { ircAccount: "aYmen" })],
    player: scores("aYmen", { points: 99, gamesPlayed: 5, wins: 1 }),
    verifiedMembers: () => json({ members: [{ account: "aYmen", nickname: "aYmen", avatar: AVATAR }] }),
    nicknameOwners: () => owners(owner("aYmen", "NewOwner", OTHER_AVATAR)),
  });
  const html = await h.playerPage("aYmen");
  assert.match(html, /data-avatar="member"><span>A<\/span><img alt="" [^>]*src="https:\/\/laravel\.chatnet\.test\/storage\/avatars\/aymen\.webp"/);
  assert.match(html, /<p class="player-disclaimer player-disclaimer-verified">.*Compte membre vérifié : <strong>aYmen<\/strong>/);
  assert.match(html, /href="\/membre\/aYmen">Profil membre/);
  assert.doesNotMatch(html, /NewOwner|other\.webp|Profil actuellement associé/);
});

test("/jeux/joueurs/[pseudo]: flags off or a failing endpoint keep today's page", async () => {
  for (const [env, nicknameOwners] of [[BASE_ENV, () => { throw new Error("must not be called"); }], [OWNERS, () => json({}, 503)], [OWNERS, () => new Error("The operation was aborted due to timeout")], [OWNERS, () => owners()]]) {
    const h = harness({ env, player: scores("aYmen", { points: 99, gamesPlayed: 5, wins: 1 }), nicknameOwners });
    const html = await h.playerPage("aYmen");
    assert.match(html, /data-avatar="initial"><span>A<\/span><\/span>/);
    assert.match(html, /pas forcément associé à un compte membre Chatnet du même nom/);
    assert.doesNotMatch(html, /href="\/membre\/|<img/);
    assert.match(html, /<dt>Points<\/dt><dd>99<\/dd>/);
    assert.equal(h.internalCalls().length, 0);
    assert.equal(h.verifiedCalls().length, 0);
    if (env === BASE_ENV) assert.equal(h.ownerCalls().length, 0);
  }
});

test("the flag and the identity key stay server-side", () => {
  const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const identities = read("lib/api/game-identities.server.ts");
  assert.match(identities, /^import "server-only";/);
  assert.match(identities, /process\.env\.GAMES_CURRENT_NICKNAME_AVATARS/);
  for (const path of ["components/games/LeaderboardTable.tsx", "components/games/PlayerAvatar.tsx", "components/games/PlayerProfileDialog.tsx", "lib/games.ts", "app/jeux/joueurs/[pseudo]/page.tsx", "app/jeux/classement/page.tsx"]) {
    assert.doesNotMatch(read(path), /GAMES_CURRENT_NICKNAME_AVATARS|GAMES_IDENTITY_KEY|api\/internal\/games|process\.env/, path);
  }
  assert.doesNotMatch(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), /GAMES_CURRENT_NICKNAME_AVATARS|GAMES_IDENTITY_KEY/);
  assert.doesNotMatch(readFileSync(new URL("../.env.example", import.meta.url), "utf8"), /NEXT_PUBLIC_GAMES/);
});
