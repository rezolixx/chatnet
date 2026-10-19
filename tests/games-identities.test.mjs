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
const ENABLED = { GAME_API_BASE_URL: GAME_API, API_BASE_URL: LARAVEL, GAMES_VERIFIED_AVATARS: "true", GAMES_IDENTITY_KEY: KEY, INTERNAL_GAME_API_TOKEN: TOKEN };
const AVATAR = "https://laravel.chatnet.test/storage/avatars/aymen.webp";
const DEFAULT_AVATAR = "https://laravel.chatnet.test/images/avatar.png";

const stats = (rank, nickname, extra = {}) => ({ rank, nickname, points: 100 - rank, gamesPlayed: 5, wins: 1, ...extra });
const board = (entries) => ({ game: "quiz", name: "Quiz", limit: 50, entries });
const member = (account, nickname = account, avatar = AVATAR) => ({ account, nickname, avatar });
const withoutAccount = ({ ircAccount, ...entry }) => (void ircAccount, entry);

// The deployed Game API (64d81487d251): the public route has no ircAccount, the
// internal route requires the Bearer token and adds ircAccount (null by default).
const internalGameApi = (entries) => (init) => init.headers.Authorization === `Bearer ${TOKEN}`
  ? json(board(entries.map((entry) => ({ ircAccount: null, ...entry }))))
  : json({ error: { code: "unauthorized", message: "Authentification requise." } }, 401);

// Real modules; the Game API (public and internal) and the Laravel resolver are fixtures behind one fetch stub.
function harness(entries, resolver = () => json({ members: [] }), env = ENABLED, { internal = internalGameApi(entries), publicEntries = entries.map(withoutAccount) } = {}) {
  const calls = [];
  const logs = [];
  const capture = (...args) => logs.push(args.map(String).join(" "));
  const modules = publicMemberModules(async (url, init) => {
    calls.push({ url, init });
    const { origin, pathname } = new URL(url);
    const reply = (handler, ...args) => {
      const response = handler(...args);
      if (response instanceof Error) throw response;
      return response;
    };
    if (origin === GAME_API && pathname === "/api/leaderboards/quiz") return json(board(publicEntries));
    if (origin === GAME_API && pathname === "/internal/leaderboards/quiz") return reply(internal, init);
    if (origin === LARAVEL && pathname === "/api/internal/games/verified-members") return reply(resolver, JSON.parse(init.body), init);
    throw new Error(`Unexpected request ${url}`);
  }, env, { console: { warn: capture, error: capture, log: capture, info: capture } });
  const resolverCalls = () => calls.filter((call) => call.url.startsWith(LARAVEL));
  const internalCalls = () => calls.filter((call) => call.url.startsWith(`${GAME_API}/internal/`));
  const publicCalls = () => calls.filter((call) => call.url.startsWith(`${GAME_API}/api/`));
  return { modules, calls, logs, resolverCalls, internalCalls, publicCalls, leaderboard: async () => plain(await modules.load("lib/api/game-identities.server.ts").getVerifiedLeaderboard("quiz")) };
}

test("disabled by default: no resolver call, every row keeps its initial, accounts never reach the rows", async () => {
  for (const env of [
    { GAME_API_BASE_URL: GAME_API, API_BASE_URL: LARAVEL },
    { ...ENABLED, GAMES_VERIFIED_AVATARS: "false" },
    { ...ENABLED, GAMES_IDENTITY_KEY: "" },
    { ...ENABLED, GAMES_IDENTITY_KEY: "too-short" },
  ]) {
    const h = harness([stats(1, "aYmen", { ircAccount: "aYmen" })], () => { throw new Error("must not be called"); }, env);
    const result = await h.leaderboard();
    assert.deepEqual(result.entries, [stats(1, "aYmen")]);
    assert.equal(h.resolverCalls().length, 0);
    // GAMES_VERIFIED_AVATARS=false (or no key) never sends the internal token either.
    assert.equal(h.internalCalls().length, 0);
    assert.equal(h.publicCalls().length, 1);
  }
});

test("internal leaderboard: Bearer token only to the internal route, never to the public route or Laravel", async () => {
  const h = harness([stats(1, "aYmen", { ircAccount: "aYmen" })], () => json({ members: [member("aYmen")] }));
  const result = await h.leaderboard();
  assert.equal(result.entries[0].account.profileHref, "/membre/aYmen");
  const [internal] = h.internalCalls();
  assert.equal(h.internalCalls().length, 1);
  assert.equal(internal.url, `${GAME_API}/internal/leaderboards/quiz?limit=50`);
  assert.equal(internal.init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(internal.init.method, undefined);
  assert.deepEqual(plain(internal.init.next), { revalidate: 60 });
  assert.ok(internal.init.signal);
  for (const call of [...h.publicCalls(), ...h.resolverCalls()]) {
    assert.doesNotMatch(JSON.stringify(call.init.headers), /authorization/i);
    assert.ok(!JSON.stringify(call.init).includes(TOKEN), call.url);
  }
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("the public route is never trusted for identities, even if it carried an ircAccount", async () => {
  // A public answer with accounts but an internal route that is refused: nothing is attributed.
  const entries = [stats(1, "aYmen", { ircAccount: "aYmen" })];
  const h = harness(entries, () => json({ members: [member("aYmen")] }), ENABLED, { internal: () => json({}, 401), publicEntries: entries });
  const result = await h.leaderboard();
  assert.deepEqual(result.entries, [stats(1, "aYmen")]);
  assert.equal(h.resolverCalls().length, 0);
  // getLeaderboard alone (player pages, ranks) drops it too.
  const plainBoard = plain(await h.modules.load("lib/api/games.server.ts").getLeaderboard("quiz"));
  assert.deepEqual(plainBoard.entries, [stats(1, "aYmen")]);
});

test("internal API unavailable, refused or malformed: public leaderboard without photos, no secret in logs", async () => {
  const entries = [stats(1, "aYmen", { ircAccount: "SecretServicesAcct" }), stats(2, "Lea")];
  for (const internal of [
    () => json({ error: { code: "unauthorized" } }, 401),
    () => json({ error: { code: "not_found" } }, 404),
    () => json({ error: { code: "service_unavailable" } }, 503),
    () => new Error("The operation was aborted due to timeout"),
    () => new Error("fetch failed"),
    () => new Response("<html>", { status: 200 }),
    () => json({ game: "other", entries: [] }),
    () => json(board([{ ...stats(2, "aYmen"), ircAccount: "SecretServicesAcct" }])),
  ]) {
    const h = harness(entries, () => json({ members: [member("SecretServicesAcct", "aYmen")] }), ENABLED, { internal });
    const result = await h.leaderboard();
    assert.equal(result.status, "available");
    assert.deepEqual(result.entries, [stats(1, "aYmen"), stats(2, "Lea")]);
    assert.equal(h.resolverCalls().length, 0);
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0], /^\[Chatnet Game API\] internal leaderboard quiz unavailable: /);
    assert.ok(!h.logs.join("\n").includes(TOKEN));
    assert.doesNotMatch(h.logs.join("\n"), /SecretServicesAcct|Bearer/);
  }
});

test("a missing or malformed INTERNAL_GAME_API_TOKEN is never sent and keeps the safe behaviour", async () => {
  for (const token of [undefined, "", "short", `${"a".repeat(20)} ${"b".repeat(20)}`, "é".repeat(40), "x".repeat(513)]) {
    const env = { ...ENABLED, INTERNAL_GAME_API_TOKEN: token };
    const h = harness([stats(1, "aYmen", { ircAccount: "aYmen" })], () => { throw new Error("must not be called"); }, env);
    const result = await h.leaderboard();
    assert.deepEqual(result.entries, [stats(1, "aYmen")]);
    assert.equal(h.internalCalls().length, 0);
    assert.equal(h.resolverCalls().length, 0);
    // The variable is named, never its value.
    assert.deepEqual(h.logs, ["[Chatnet Game API] internal leaderboard quiz unavailable: INTERNAL_GAME_API_TOKEN missing or invalid"]);
  }
});

test("historical and unverified scores keep ircAccount null and are never attributed", async () => {
  // Today's production state: every row is historical (ircAccount: null), aYmen included.
  const h = harness([stats(1, "aYmen", { ircAccount: null }), stats(2, "Lea", { ircAccount: null })], () => json({ members: [member("aYmen")] }));
  const result = await h.leaderboard();
  assert.deepEqual(result.entries, [stats(1, "aYmen"), stats(2, "Lea")]);
  assert.equal(h.internalCalls().length, 1);
  // No account, no question to Laravel: the nickname alone never asks for a photo.
  assert.equal(h.resolverCalls().length, 0);
  // Once aYmen's points are all identified, only that row is verified.
  const later = harness([stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "Lea", { ircAccount: null })], () => json({ members: [member("aYmen"), member("Lea")] }));
  const [aymen, lea] = (await later.leaderboard()).entries;
  assert.equal(aymen.account.nickname, "aYmen");
  assert.equal(lea.account, undefined);
  assert.deepEqual(JSON.parse(later.resolverCalls()[0].init.body), { accounts: ["aYmen"] });
});

test("rows that differ between the public and internal boards stay unverified", async () => {
  const publicEntries = [stats(1, "Lea"), stats(2, "aYmen"), stats(3, "Rezo")];
  // A score landed between the two requests: Lea and aYmen swapped, Rezo's points moved.
  const internal = internalGameApi([stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "Lea", { ircAccount: "Lea" }), stats(3, "Rezo", { points: 98, ircAccount: "Rezo" })]);
  const h = harness([], () => { throw new Error("must not be called"); }, ENABLED, { internal, publicEntries });
  const result = await h.leaderboard();
  assert.deepEqual(result.entries, publicEntries);
  assert.equal(h.resolverCalls().length, 0);
  // Nickname case is part of the row check too.
  const cased = harness([], () => json({ members: [member("aYmen")] }), ENABLED, { internal: internalGameApi([stats(1, "AYMEN", { ircAccount: "aYmen" })]), publicEntries: [stats(1, "aYmen")] });
  assert.equal((await cased.leaderboard()).entries[0].account, undefined);
  // A shorter internal board leaves the extra public rows unverified.
  const short = harness([], () => json({ members: [member("aYmen")] }), ENABLED, { internal: internalGameApi([stats(1, "aYmen", { ircAccount: "aYmen" })]), publicEntries: [stats(1, "aYmen"), stats(2, "Lea")] });
  const [first, second] = (await short.leaderboard()).entries;
  assert.equal(first.account.nickname, "aYmen");
  assert.equal(second.account, undefined);
});

test("public leaderboard failures are unchanged by the internal route", async () => {
  const internal = internalGameApi([stats(1, "aYmen", { ircAccount: "aYmen" })]);
  const modules = publicMemberModules(async (url, init) => {
    if (url.includes("/internal/")) return internal(init);
    return json({ error: {} }, 503);
  }, ENABLED, { console: { warn() {} } });
  assert.deepEqual(plain(await modules.load("lib/api/game-identities.server.ts").getVerifiedLeaderboard("quiz")), { status: "unavailable" });
  const unconfigured = harness([stats(1, "aYmen", { ircAccount: "aYmen" })], undefined, { ...ENABLED, GAME_API_BASE_URL: "" });
  assert.deepEqual(await unconfigured.leaderboard(), { status: "not-configured" });
  assert.equal(unconfigured.calls.length, 0);
});

test("the internal token and raw accounts stay in server-only modules", () => {
  const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const games = read("lib/api/games.server.ts");
  assert.match(games, /^import "server-only";/);
  assert.match(read("lib/api/game-identities.server.ts"), /^import "server-only";/);
  // Read only here, never as a NEXT_PUBLIC_ variable, never in a client component.
  assert.match(games, /process\.env\.INTERNAL_GAME_API_TOKEN/);
  for (const path of ["components/games/LeaderboardTable.tsx", "components/games/PlayerAvatar.tsx", "components/games/PlayerProfileDialog.tsx", "lib/games.ts"]) {
    assert.doesNotMatch(read(path), /INTERNAL_GAME_API_TOKEN|ircAccount|games\.server|game-identities\.server/, path);
  }
  assert.doesNotMatch(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), /INTERNAL_GAME_API_TOKEN|GAMES_IDENTITY_KEY/);
});

test("verified account with an avatar gets the /communaute photo and member link, server-side only", async () => {
  const h = harness([stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "Lea"), stats(3, "aYmen_web", { ircAccount: "AYMEN" })], () => json({ members: [member("aymen", "aYmen")] }));
  const result = await h.leaderboard();
  const account = { verified: true, nickname: "aYmen", avatar: AVATAR, profileHref: "/membre/aYmen" };
  assert.deepEqual(result.entries, [{ ...stats(1, "aYmen"), account }, stats(2, "Lea"), { ...stats(3, "aYmen_web"), account }]);
  // One POST, the shared key, case-insensitively deduplicated accounts, nothing else about the visitor.
  const [call] = h.resolverCalls();
  assert.equal(h.resolverCalls().length, 1);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers["X-Chatnet-Games-Identity-Key"], KEY);
  assert.deepEqual(JSON.parse(call.init.body), { accounts: ["aYmen"] });
  assert.doesNotMatch(JSON.stringify(call.init.headers), /cookie|authorization/i);
  // Ranking, order and stats are untouched.
  assert.deepEqual(result.entries.map((entry) => { const copy = { ...entry }; delete copy.account; return copy; }), [stats(1, "aYmen"), stats(2, "Lea"), stats(3, "aYmen_web")]);
});

test("verified account without a custom avatar keeps Laravel's default photo, or the initial when none", async () => {
  const h = harness([stats(1, "Rezo", { ircAccount: "Rezo" }), stats(2, "Nadia", { ircAccount: "Nadia" })], () => json({ members: [member("Rezo", "Rezo", DEFAULT_AVATAR), member("Nadia", "Nadia", null)] }));
  const [rezo, nadia] = (await h.leaderboard()).entries;
  assert.deepEqual(rezo.account, { verified: true, nickname: "Rezo", avatar: DEFAULT_AVATAR, profileHref: "/membre/Rezo" });
  assert.deepEqual(nadia.account, { verified: true, nickname: "Nadia", avatar: null, profileHref: "/membre/Nadia" });
  const { PlayerProfileDialog } = h.modules.load("components/games/PlayerProfileDialog.tsx");
  const html = markup(jsx(PlayerProfileDialog, { player: nadia, onClose() {} }));
  assert.match(html, /data-avatar="initial"><span>N<\/span><\/span>/);
  assert.match(html, /href="\/membre\/Nadia">Profil membre<span class="sr-only"> de Nadia<\/span>/);
});

test("an IRC nickname without a recorded services account stays unverified, even when a member shares it", async () => {
  const h = harness([stats(1, "aYmen"), stats(2, "Rezo", { ircAccount: null }), stats(3, "Lea", { ircAccount: "not a nick!" })], () => json({ members: [member("aYmen")] }));
  const result = await h.leaderboard();
  assert.deepEqual(result.entries, [stats(1, "aYmen"), stats(2, "Rezo"), stats(3, "Lea")]);
  assert.equal(h.resolverCalls().length, 0);
});

test("similar nicknames of unrelated identities never share a photo", async () => {
  // aYmen_ plays under another services account; Laravel answers for aYmen only,
  // and an unrequested account in the answer is ignored.
  const h = harness([stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "aYmen_", { ircAccount: "Imposter" }), stats(3, "Aymen2")], () => json({ members: [member("aYmen"), member("aymen_", "aymen_"), member("Aymen2")] }));
  const [first, second, third] = (await h.leaderboard()).entries;
  assert.equal(first.account?.nickname, "aYmen");
  assert.equal(second.account, undefined);
  assert.equal(third.account, undefined);
  assert.deepEqual(JSON.parse(h.resolverCalls()[0].init.body), { accounts: ["aYmen", "Imposter"] });
});

test("stale or ambiguous associations are dropped, and each render reflects Laravel's current answer", async () => {
  const entries = [stats(1, "aYmen", { ircAccount: "aYmen" })];
  // A dropped and re-registered NickCore no longer matches the binding: Laravel omits it.
  assert.equal((await harness(entries, () => json({ members: [] })).leaderboard()).entries[0].account, undefined);
  // Two members for one account is not an answer we can trust.
  assert.equal((await harness(entries, () => json({ members: [member("aYmen"), member("AYMEN", "Other")] })).leaderboard()).entries[0].account, undefined);
  // Rebound to another member: the new member is shown, never the old one.
  const rebound = (await harness(entries, () => json({ members: [member("aYmen", "NewOwner")] })).leaderboard()).entries[0];
  assert.equal(rebound.account.profileHref, "/membre/NewOwner");
  // The resolver reuses the page's 60-second revalidation, no longer-lived cache.
  const h = harness(entries, () => json({ members: [] }));
  await h.leaderboard();
  assert.deepEqual(plain(h.resolverCalls()[0].init.next), { revalidate: 60 });
});

test("unsafe or malformed avatars fall back to the initial without losing the verification", async () => {
  const h = harness([1, 2, 3, 4].map((rank) => stats(rank, `p${rank}`, { ircAccount: `p${rank}` })), () => json({ members: [
    member("p1", "p1", "javascript:alert(1)"),
    member("p2", "p2", "https://user:pass@cdn.test/a.png"),
    member("p3", "p3", `https://cdn.test/${"a".repeat(2100)}.png`),
    member("p4", "p4", "not a url"),
  ] }));
  for (const entry of (await h.leaderboard()).entries) {
    assert.equal(entry.account.verified, true);
    assert.equal(entry.account.avatar, null, entry.nickname);
  }
});

test("member nicknames that cannot form a safe profile link are not attached", async () => {
  const h = harness([stats(1, "p1", { ircAccount: "p1" }), stats(2, "p2", { ircAccount: "p2" })], () => json({ members: [{ account: "p1", nickname: "../admin", avatar: AVATAR }, { account: "p2", nickname: "", avatar: AVATAR }] }));
  for (const entry of (await h.leaderboard()).entries) assert.equal(entry.account, undefined);
});

test("an unavailable resolver leaves the leaderboard available with initials", async () => {
  const entries = [stats(1, "aYmen", { ircAccount: "aYmen" }), stats(2, "Lea")];
  for (const resolver of [
    () => json({ message: "boom" }, 500),
    () => json({ message: "nope" }, 401),
    () => new Error("The operation was aborted due to timeout"),
    () => new Response("<html>", { status: 200 }),
    () => json({ members: "nope" }),
  ]) {
    const result = await harness(entries, resolver).leaderboard();
    assert.equal(result.status, "available");
    assert.deepEqual(result.entries, [stats(1, "aYmen"), stats(2, "Lea")]);
  }
  // A failing Game API is reported as before, without asking Laravel anything.
  const down = publicMemberModules(async () => { throw new Error("down"); }, ENABLED);
  const result = await down.load("lib/api/game-identities.server.ts").getVerifiedLeaderboard("quiz");
  assert.deepEqual(plain(result), { status: "unavailable" });
});

test("ranking pages render the verified photo and keep account names and keys out of the HTML", async () => {
  const entries = [stats(1, "aYmen", { ircAccount: "SecretServicesAcct" }), stats(2, "Lea")];
  const h = harness(entries, () => json({ members: [member("SecretServicesAcct", "aYmen")] }));
  const html = markup(await h.modules.load("app/jeux/classement/page.tsx").default());
  assert.match(html, /data-avatar="member"><span>A<\/span><img alt="" [^>]*src="https:\/\/laravel\.chatnet\.test\/storage\/avatars\/aymen\.webp"/);
  assert.equal((html.match(/data-avatar="initial"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /SecretServicesAcct|ircAccount|uniqueid|kkkkkkkk|t0ken|Bearer/i);
  assert.equal(h.internalCalls().length, 1);
  // The player-detail rank lookup keeps using the plain leaderboard.
  assert.doesNotMatch(readFileSync(new URL("../src/lib/api/games.server.ts", import.meta.url), "utf8"), /game-identities.server/);
});

test("the player card announces the verified member and links to that profile", async () => {
  const h = harness([], undefined);
  const { PlayerProfileDialog } = h.modules.load("components/games/PlayerProfileDialog.tsx");
  const player = { ...stats(1, "aYmen_irc"), account: { verified: true, nickname: "aYmen", avatar: AVATAR, profileHref: "/membre/aYmen" } };
  const html = markup(jsx(PlayerProfileDialog, { player, onClose() {} }));
  assert.match(html, /class="player-thumb player-thumb-large" aria-hidden="true" data-avatar="member"><span>A<\/span><img alt="" [^>]*width="72"[^>]*src="https:\/\/laravel\.chatnet\.test\/storage\/avatars\/aymen\.webp"/);
  assert.match(html, /<p class="player-dialog-note player-dialog-verified">.*Compte membre vérifié : aYmen<\/p>/);
  assert.match(html, /class="button button-outline" href="\/membre\/aYmen">Profil membre<span class="sr-only"> de aYmen<\/span><\/a>/);
  assert.doesNotMatch(html, /pas forcément associé/);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.player-dialog-verified \{ color: var\(--foreground\); font-weight: 700; \}/);
});
