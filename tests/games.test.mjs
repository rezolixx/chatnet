import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gameCatalogue, isValidNickname, normalizePlayerRouteParam, playerHref } from "../src/lib/games.ts";
import { indexablePaths } from "../src/lib/seo/indexable.ts";
import { elements } from "./helpers/password-form.mjs";
import { publicMemberModules } from "./helpers/public-member.mjs";

const require = createRequire(import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const BASE = "https://jeux-api.test";

const quizBoard = { game: "quiz", name: "Quiz", limit: 50, entries: [
  { rank: 1, nickname: "Rezo", points: 120, gamesPlayed: 9, wins: 4, id: 77, normalizedNickname: "rezo" },
  { rank: 2, nickname: "[Aymen]", points: 40, gamesPlayed: 5, wins: 1 },
  { rank: 3, nickname: "Lea", points: 40, gamesPlayed: 6, wins: 0 },
] };
const emptyBoard = (game) => ({ game, name: game, limit: 50, entries: [] });
const scores = (nickname, quiz = { points: 40, gamesPlayed: 5, wins: 1 }) => ({ nickname, scores: { quiz, motus: { points: 0, gamesPlayed: 0, wins: 0 }, defis: { points: 0, gamesPlayed: 0, wins: 0 } } });

// Route-aware fixture Game API; `routes` maps a pathname prefix to a Response/Error factory.
function gameApi(routes = {}, env = { GAME_API_BASE_URL: BASE }) {
  const calls = [];
  const modules = publicMemberModules(async (url, init) => {
    calls.push({ url, init });
    const { pathname } = new URL(url);
    const match = Object.keys(routes).find((prefix) => pathname.startsWith(prefix));
    if (!match) throw new Error(`Unexpected request ${url}`);
    const response = routes[match](pathname);
    if (response instanceof Error) throw response;
    return response;
  }, env);
  return { modules, calls, api: modules.load("lib/api/games.server.ts") };
}
const boards = (quiz = quizBoard) => ({ "/api/leaderboards/quiz": () => json(quiz), "/api/leaderboards/motus": () => json(emptyBoard("motus")), "/api/leaderboards/defis": () => json(emptyBoard("defis")) });

test("catalogue only presents the Quiz as implemented; Motus and Défis have no detail page", () => {
  assert.deepEqual(gameCatalogue.map((game) => [game.id, game.channel, game.implemented, game.href]), [["quiz", "#quiz", true, "/jeux/quiz"], ["motus", "#motus", false, null], ["defis", "#defis", false, null]]);
  for (const game of gameCatalogue.filter((item) => !item.implemented)) assert.match(game.description, /pas encore jouable/);
});

test("player nicknames follow the Game API rules and route params decode exactly once", () => {
  for (const nickname of ["Rezo", "[Aymen]", "a_b-c", "`x^{y}|z\\"]) {
    assert.equal(isValidNickname(nickname), true, nickname);
    const href = playerHref(nickname);
    assert.equal(normalizePlayerRouteParam(href.slice("/jeux/joueurs/".length)), nickname);
    assert.equal(new URL(href, "https://chatnet.fr").search, "");
  }
  for (const value of [null, "", "1abc", "a b", "a/b", "a.b", "é", "a".repeat(31), "%", "%E0%A4%A", "%2Fetc", "a%0aJOIN"]) {
    assert.equal(normalizePlayerRouteParam(value), null, String(value));
  }
  assert.equal(normalizePlayerRouteParam("%255BX%255D"), null);
  assert.equal(playerHref("../admin"), "/jeux/classement");
});

test("Game API base is server-only configuration: unset, insecure or credentialed values are refused", () => {
  const base = (value) => gameApi({}, value === undefined ? {} : { GAME_API_BASE_URL: value }).api.gameApiBase();
  assert.deepEqual(plain(base(undefined)), { status: "not-configured" });
  assert.deepEqual(plain(base("  ")), { status: "not-configured" });
  assert.deepEqual(plain(base("https://jeux-api.test/")), { status: "configured", url: "https://jeux-api.test" });
  assert.deepEqual(plain(base("https://chatnet.fr/game-api/")), { status: "configured", url: "https://chatnet.fr/game-api" });
  assert.deepEqual(plain(base("http://127.0.0.1:4100")), { status: "configured", url: "http://127.0.0.1:4100" });
  for (const value of ["http://game-api:4100", "http://10.0.0.5:4100", "ftp://x.test", "https://user:pass@x.test", "https://x.test/?token=1", "not a url"]) {
    assert.deepEqual(plain(base(value)), { status: "invalid" }, value);
  }
  assert.equal(gameApi({}, {}).api.isQuizOpen(), false);
  assert.equal(gameApi({}, { GAMES_QUIZ_OPEN: "true" }).api.isQuizOpen(), true);
  assert.equal(gameApi({}, { GAMES_QUIZ_OPEN: "1" }).api.isQuizOpen(), false);
});

test("leaderboard keeps only public ranking fields, uses an anonymous cached request and the API limit", async () => {
  const h = gameApi(boards());
  const result = plain(await h.api.getLeaderboard("quiz"));
  assert.deepEqual(result, { status: "available", game: "quiz", entries: [
    { rank: 1, nickname: "Rezo", points: 120, gamesPlayed: 9, wins: 4 },
    { rank: 2, nickname: "[Aymen]", points: 40, gamesPlayed: 5, wins: 1 },
    { rank: 3, nickname: "Lea", points: 40, gamesPlayed: 6, wins: 0 },
  ] });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, `${BASE}/api/leaderboards/quiz?limit=50`);
  assert.equal(h.calls[0].init.headers.Accept, "application/json");
  assert.equal(h.calls[0].init.headers.Cookie, undefined);
  assert.equal(h.calls[0].init.headers.Authorization, undefined);
  assert.equal(h.calls[0].init.next.revalidate, 60);
  assert.ok(h.calls[0].init.signal instanceof AbortSignal);
});

test("unconfigured, empty and failing leaderboards stay distinct and never invent entries", async () => {
  const unconfigured = gameApi(boards(), {});
  assert.deepEqual(plain(await unconfigured.api.getLeaderboard("quiz")), { status: "not-configured" });
  assert.equal(unconfigured.calls.length, 0);
  const invalidBase = gameApi(boards(), { GAME_API_BASE_URL: "http://game-api:4100" });
  assert.deepEqual(plain(await invalidBase.api.getLeaderboard("quiz")), { status: "unavailable" });
  assert.equal(invalidBase.calls.length, 0);
  assert.deepEqual(plain(await gameApi(boards(emptyBoard("quiz"))).api.getLeaderboard("quiz")), { status: "available", game: "quiz", entries: [] });
  const entry = { rank: 1, nickname: "Rezo", points: 1, gamesPlayed: 1, wins: 1 };
  const broken = [
    () => json({ error: { code: "service_unavailable", message: "x" } }, 503),
    () => new Error("socket hang up"),
    () => new DOMException("Timed out", "TimeoutError"),
    () => new Response("<html>proxy</html>", { status: 200 }),
    () => json({ ...quizBoard, game: "motus" }),
    () => json({ game: "quiz", entries: null }),
    () => json({ game: "quiz", entries: [{ ...entry, rank: 2 }] }),
    () => json({ game: "quiz", entries: [entry, { ...entry, nickname: "Lea" }] }),
    () => json({ game: "quiz", entries: [{ ...entry, nickname: "<script>" }] }),
    () => json({ game: "quiz", entries: [{ ...entry, points: -1 }] }),
    () => json({ game: "quiz", entries: [{ ...entry, wins: "1" }] }),
    () => json({ game: "quiz", entries: [{ ...entry, gamesPlayed: 1.5 }] }),
  ];
  for (const response of broken) assert.deepEqual(plain(await gameApi({ "/api/leaderboards/quiz": response }).api.getLeaderboard("quiz")), { status: "unavailable" });
});

test("player profile: invalid names make no request, 404/400 are not found, failures are unavailable", async () => {
  for (const value of ["a b", "%E0%A4%A", "..", "x".repeat(31)]) {
    const h = gameApi(boards());
    assert.deepEqual(plain(await h.api.getPlayerProfile(value)), { status: "not-found" });
    assert.equal(h.calls.length, 0);
  }
  const notFound = { error: { code: "player_not_found", message: "Joueur introuvable." } };
  assert.deepEqual(plain(await gameApi({ "/api/scores/": () => json(notFound, 404) }).api.getPlayerProfile("Ghost")), { status: "not-found" });
  assert.deepEqual(plain(await gameApi({ "/api/scores/": () => json({ error: { code: "invalid_nickname" } }, 400) }).api.getPlayerProfile("Ghost")), { status: "not-found" });
  assert.deepEqual(plain(await gameApi({}, {}).api.getPlayerProfile("Rezo")), { status: "not-configured" });
  for (const response of [() => json({}, 503), () => json({}, 500), () => new Error("down"), () => json(scores("Someone")), () => json({ nickname: "Rezo", scores: { quiz: { points: 1, gamesPlayed: 1, wins: 1 } } })]) {
    assert.deepEqual(plain(await gameApi({ "/api/scores/": response, ...boards() }).api.getPlayerProfile("Rezo")), { status: "unavailable" });
  }
});

test("player profile shows recorded casing, public stats only, and a rank taken from the published leaderboard", async () => {
  const h = gameApi({ "/api/scores/": () => json({ ...scores("[Aymen]"), email: "private@example.test", id: 4 }), ...boards() });
  const result = plain(await h.api.getPlayerProfile("%5Baymen%5D"));
  assert.deepEqual(result, { status: "found", player: { nickname: "[Aymen]", scores: {
    quiz: { points: 40, gamesPlayed: 5, wins: 1, rank: 2 },
    motus: { points: 0, gamesPlayed: 0, wins: 0, rank: null },
    defis: { points: 0, gamesPlayed: 0, wins: 0, rank: null },
  } } });
  assert.equal(h.calls[0].url, `${BASE}/api/scores/%5Baymen%5D`);
  // Leaderboards are only consulted for games the player has actually played.
  assert.deepEqual(h.calls.slice(1).map(({ url }) => new URL(url).pathname), ["/api/leaderboards/quiz"]);
  const outsideTop = gameApi({ "/api/scores/": () => json(scores("Zed", { points: 1, gamesPlayed: 1, wins: 0 })), ...boards() });
  assert.equal((await outsideTop.api.getPlayerProfile("Zed")).player.scores.quiz.rank, null);
  const boardDown = gameApi({ "/api/scores/": () => json(scores("Rezo")), "/api/leaderboards/": () => json({}, 503) });
  assert.equal((await boardDown.api.getPlayerProfile("Rezo")).status, "found");
});

function page(path, routes, env) {
  return gameApi(routes, env).modules.load(path);
}
const markup = (tree) => renderToStaticMarkup(tree);

test("/jeux catalogue: honest statuses, no playable claim for Motus/Défis, unconfigured ranking state", async () => {
  const mod = page("app/jeux/page.tsx", {}, {});
  const html = markup(await mod.default());
  assert.match(html, /<h1>Jouez en direct avec la communauté\.<\/h1>/);
  assert.match(html, /Ouverture prochaine/);
  assert.doesNotMatch(html, /Disponible sur IRC/);
  assert.equal((html.match(/Pas encore jouable/g) ?? []).length, 2);
  assert.match(html, /href="\/jeux\/quiz"/);
  assert.match(html, /href="\/jeux\/classement"/);
  assert.doesNotMatch(html, /href="\/jeux\/(motus|defis)"/);
  assert.match(html, /Classements bientôt en ligne/);
  assert.doesNotMatch(html, /<table/);
  assert.equal(mod.metadata.alternates.canonical, "https://chatnet.fr/jeux");
  assert.equal(mod.revalidate, 60);
});

test("/jeux shows the real top five when the Game API answers and the open status when configured", async () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({ rank: index + 1, nickname: `Joueur${index + 1}`, points: 100 - index, gamesPlayed: 3, wins: 1 }));
  const html = markup(await page("app/jeux/page.tsx", { "/api/leaderboards/quiz": () => json({ game: "quiz", entries }) }, { GAME_API_BASE_URL: BASE, GAMES_QUIZ_OPEN: "true" }).default());
  assert.equal((html.match(/<tr class|<tr>/g) ?? []).length, 6);
  assert.match(html, /href="\/jeux\/joueurs\/Joueur5"/);
  assert.doesNotMatch(html, /Joueur6/);
  assert.match(html, /Disponible sur IRC/);
  const empty = markup(await page("app/jeux/page.tsx", { "/api/leaderboards/quiz": () => json(emptyBoard("quiz")) }).default());
  assert.match(empty, /Aucun score pour le moment/);
  const down = markup(await page("app/jeux/page.tsx", { "/api/leaderboards/quiz": () => json({}, 503) }).default());
  assert.match(down, /role="alert"/);
  assert.match(down, /momentanément indisponible/);
});

test("/jeux/quiz documents the real rules and only offers the #quiz join form once the quiz is open", async () => {
  const closed = page("app/jeux/quiz/page.tsx", {}, {});
  const tree = await closed.default();
  assert.equal(elements(tree, (el) => el.props?.selectedRoom).length, 0);
  const html = markup(tree);
  for (const text of ["+10 points", "!quiz [catégorie]", "!score [pseudo]", "120 caractères", "trois réponses différentes", "Cinéma / musique", "Le salon #quiz ouvre bientôt", "Classements bientôt en ligne"]) assert.ok(html.includes(text), text);
  assert.match(html, /href="\/#rejoindre"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.equal(closed.metadata.alternates.canonical, "https://chatnet.fr/jeux/quiz");
  const open = await page("app/jeux/quiz/page.tsx", { "/api/leaderboards/quiz": () => json(quizBoard) }, { GAME_API_BASE_URL: BASE, GAMES_QUIZ_OPEN: "true" }).default();
  assert.deepEqual(elements(open, (el) => el.props?.selectedRoom).map((el) => el.props.selectedRoom), ["quiz"]);
  assert.ok(elements(open, (el) => el.props?.entries).some((el) => el.props.entries.length === 3));
});

test("/jeux/classement: full real list, empty/unavailable states, and noindex unless populated", async () => {
  const filled = page("app/jeux/classement/page.tsx", boards());
  const html = markup(await filled.default());
  assert.match(html, /href="\/jeux\/joueurs\/%5BAymen%5D"/);
  assert.match(html, /<caption class="sr-only">Classement du Quiz, 3 premiers joueurs<\/caption>/);
  assert.match(html, /role="region" aria-label="Classement du Quiz, 3 premiers joueurs" tabindex="0"/);
  assert.match(html, /Le classement de Motus sera publié au lancement du jeu/);
  assert.doesNotMatch(html, /normalizedNickname|rezo"/);
  const metadata = await filled.generateMetadata();
  assert.equal(metadata.robots, undefined);
  assert.equal(metadata.alternates.canonical, "https://chatnet.fr/jeux/classement");
  for (const [routes, env, text] of [[{}, {}, /Classements bientôt en ligne/], [boards(emptyBoard("quiz")), undefined, /Aucun score pour le moment/], [{ "/api/leaderboards/quiz": () => new Error("down") }, undefined, /momentanément indisponible/]]) {
    const mod = page("app/jeux/classement/page.tsx", routes, env);
    assert.match(markup(await mod.default()), text);
    assert.deepEqual(plain((await mod.generateMetadata()).robots), { index: false, follow: true });
  }
});

test("player page: unknown player is a 404, unavailable is not, stats are noindex and not linked to member accounts", async () => {
  const props = (pseudo) => ({ params: Promise.resolve({ pseudo }) });
  const missing = page("app/jeux/joueurs/[pseudo]/page.tsx", { "/api/scores/": () => json({ error: { code: "player_not_found" } }, 404) });
  await assert.rejects(missing.default(props("Ghost")), /NEXT_HTTP_ERROR_FALLBACK;404/);
  await assert.rejects(missing.default(props("bad%20name")), /NEXT_HTTP_ERROR_FALLBACK;404/);
  const down = page("app/jeux/joueurs/[pseudo]/page.tsx", { "/api/scores/": () => json({}, 503) });
  const downHtml = markup(await down.default(props("Rezo")));
  assert.match(downHtml, /Statistiques momentanément indisponibles/);
  assert.deepEqual(plain((await down.generateMetadata(props("Rezo"))).robots), { index: false, follow: true });
  const unconfigured = markup(await page("app/jeux/joueurs/[pseudo]/page.tsx", {}, {}).default(props("Rezo")));
  assert.match(unconfigured, /Statistiques bientôt disponibles/);

  const found = page("app/jeux/joueurs/[pseudo]/page.tsx", { "/api/scores/": () => json(scores("Rezo", { points: 120, gamesPlayed: 9, wins: 4 })), ...boards() });
  const html = markup(await found.default(props("rezo")));
  assert.match(html, /<h1>Rezo<\/h1>/);
  assert.match(html, /<dt>Points<\/dt><dd>120<\/dd>/);
  assert.match(html, /<dt>Victoires<\/dt><dd>4<\/dd>/);
  assert.match(html, /Classé 1er du Quiz/);
  assert.match(html, /pas forcément associé à un compte membre/);
  assert.doesNotMatch(html, /href="\/membre\//);
  assert.doesNotMatch(html, /application\/ld\+json/);
  const metadata = await found.generateMetadata(props("rezo"));
  assert.equal(metadata.title, "Statistiques de Rezo");
  assert.equal(metadata.alternates.canonical, "https://chatnet.fr/jeux/joueurs/Rezo");
  assert.deepEqual(plain(metadata.robots), { index: false, follow: true });
});

test("sitemap lists the quiz page but not data-dependent rankings or per-player pages", async () => {
  assert.ok(indexablePaths.includes("/jeux/quiz"));
  assert.ok(!indexablePaths.some((path) => path.startsWith("/jeux/classement") || path.startsWith("/jeux/joueurs")));
});

test("navbar marks Jeux as the current section on game sub-pages", () => {
  const source = new URL("../src/components/layout/Navbar.tsx", import.meta.url);
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const render = (pathname) => {
    const exports = {};
    const localRequire = (specifier) => {
      if (specifier === "react") return { useState: (value) => [value, () => {}] };
      if (specifier === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ refresh() {} }) };
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "@/components/auth/AuthProvider") return { useAuth: () => ({ user: null, loading: false, logout: async () => {} }) };
      if (specifier === "@/lib/site") return { site: { nav: [{ href: "/", label: "Accueil" }, { href: "/jeux", label: "Jeux" }] }, discordUrl: "https://discord.test", joinHref: "/#rejoindre" };
      if (specifier.startsWith("@/components/")) return new Proxy({}, { get: () => () => null });
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) { ${code}\n })`, vm.createContext({}))(localRequire, { exports }, exports);
    return markup(exports.Navbar());
  };
  const quiz = render("/jeux/quiz");
  assert.match(quiz, /href="\/jeux" class="nav-link active" aria-current="true"/);
  assert.match(quiz, /href="\/" class="nav-link"/);
  assert.match(render("/jeux"), /href="\/jeux" class="nav-link active" aria-current="page"/);
  assert.doesNotMatch(render("/jeuxvideo"), /nav-link active/);
});

test("game styles keep tables scrollable and grids single-column on small screens", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.leaderboard-scroll \{ position: relative; overflow-x: auto;/);
  assert.match(css, /@media \(max-width: 920px\) \{ \.games-hero-inner, \.quiz-join-grid, \.quiz-rules-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.game-tile-grid, \.games-steps \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});
