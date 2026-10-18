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
const ENABLED = { GAME_API_BASE_URL: GAME_API, API_BASE_URL: LARAVEL, GAMES_VERIFIED_AVATARS: "true", GAMES_IDENTITY_KEY: KEY };
const AVATAR = "https://laravel.chatnet.test/storage/avatars/aymen.webp";
const DEFAULT_AVATAR = "https://laravel.chatnet.test/images/avatar.png";

const stats = (rank, nickname, extra = {}) => ({ rank, nickname, points: 100 - rank, gamesPlayed: 5, wins: 1, ...extra });
const board = (entries) => ({ game: "quiz", name: "Quiz", limit: 50, entries });
const member = (account, nickname = account, avatar = AVATAR) => ({ account, nickname, avatar });

// Real modules; the Game API and Laravel resolver are fixtures behind one fetch stub.
function harness(entries, resolver = () => json({ members: [] }), env = ENABLED) {
  const calls = [];
  const modules = publicMemberModules(async (url, init) => {
    calls.push({ url, init });
    const { origin, pathname } = new URL(url);
    if (origin === GAME_API && pathname === "/api/leaderboards/quiz") return json(board(entries));
    if (origin === LARAVEL && pathname === "/api/internal/games/verified-members") {
      const response = resolver(JSON.parse(init.body), init);
      if (response instanceof Error) throw response;
      return response;
    }
    throw new Error(`Unexpected request ${url}`);
  }, env);
  const resolverCalls = () => calls.filter((call) => call.url.startsWith(LARAVEL));
  return { modules, calls, resolverCalls, leaderboard: async () => plain(await modules.load("lib/api/game-identities.server.ts").getVerifiedLeaderboard("quiz")) };
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
  }
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
  assert.doesNotMatch(html, /SecretServicesAcct|ircAccount|uniqueid|kkkkkkkk/i);
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
