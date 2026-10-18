import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { elements } from "./helpers/password-form.mjs";
import { publicMemberModules } from "./helpers/public-member.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../src/", import.meta.url));
const jsx = React.createElement;
const markup = (tree) => renderToStaticMarkup(tree);

const rows = [
  { rank: 1, nickname: "Rezo", points: 1200, gamesPlayed: 9, wins: 4 },
  { rank: 2, nickname: "[Aymen]", points: 40, gamesPlayed: 5, wins: 1 },
  { rank: 3, nickname: "lea", points: 40, gamesPlayed: 6, wins: 0 },
];
const verified = { avatar: "https://cdn.chatnet.test/avatars/rezo.webp", profileHref: "/membre/Rezo" };

// Real React rendering of the actual components (server markup).
const real = (path) => publicMemberModules(async () => { throw new Error("Unexpected fetch"); }).load(path);

// Real component code and handlers with persistent hook slots, to drive clicks and dialog events.
function client(path) {
  const slots = [], effects = [], records = new Map();
  let index = 0;
  const hooks = { ...React,
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (v) => { slots[slot] = typeof v === "function" ? v(slots[slot]) : v; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useEffect(fn) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(fn); } },
    useId() { return "player-dialog-title"; },
  };
  const context = vm.createContext({ URL, console });
  function load(relative) {
    let file = resolve(root, relative);
    if (!/\.tsx?$/.test(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (records.has(file)) return records.get(file).exports;
    const record = { exports: {} }; records.set(file, record);
    const localRequire = (s) => {
      if (s === "react") return hooks;
      if (s === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => jsx("a", { href, ...props }, children) };
      if (s === "next/image") return { __esModule: true, default: (props) => jsx("img", props) };
      if (s.startsWith("@/")) return load(s.slice(2));
      if (s.startsWith(".")) return load(resolve(dirname(file), s));
      return require(s);
    };
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, record, record.exports);
    return record.exports;
  }
  const mod = load(path);
  return { mod, render: (name, props) => { index = 0; return mod[name](props); }, effects, slots };
}

const click = (overrides = {}) => {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, currentTarget: { focused: 0, focus() { this.focused += 1; } }, preventDefault() { this.defaultPrevented = true; }, ...overrides };
  return event;
};

// Minimal HTMLDialogElement: close() fires the dialog's "close" handler like the browser does.
function fakeDialog(tree) {
  const dialog = { open: false, modal: false, showModal() { this.open = true; this.modal = true; }, show() { this.open = true; }, close() { if (!this.open) return; this.open = false; tree().props.onClose(); } };
  return dialog;
}

test("leaderboard rows show an initial avatar next to each nickname and keep the stats links", () => {
  const { LeaderboardTable } = real("components/games/LeaderboardTable.tsx");
  const html = markup(jsx(LeaderboardTable, { entries: rows, caption: "Classement du Quiz" }));
  assert.equal((html.match(/class="player-thumb" aria-hidden="true" data-avatar="initial"/g) ?? []).length, 3);
  assert.match(html, /<a class="leaderboard-player" aria-haspopup="dialog" href="\/jeux\/joueurs\/Rezo"><span class="player-thumb"[^>]*><span>R<\/span><\/span><span class="leaderboard-player-name">Rezo<\/span><\/a>/);
  assert.match(html, /href="\/jeux\/joueurs\/%5BAymen%5D"[^>]*><span class="player-thumb"[^>]*><span>\[<\/span><\/span><span class="leaderboard-player-name">\[Aymen\]<\/span>/);
  assert.match(html, /<span>L<\/span><\/span><span class="leaderboard-player-name">lea<\/span>/);
  assert.doesNotMatch(html, /<img|\/membre\/|<dialog/);
  // Ranking values and order are untouched.
  assert.match(html, /<td class="leaderboard-points">1\s200<\/td><td>9<\/td><td>4<\/td>/);
  assert.deepEqual([...html.matchAll(/leaderboard-rank">(\d+)</g)].map((m) => m[1]), ["1", "2", "3"]);
});

test("only a verified member account adds a photo; the initial stays underneath while loading", () => {
  const { LeaderboardTable } = real("components/games/LeaderboardTable.tsx");
  const html = markup(jsx(LeaderboardTable, { entries: [{ ...rows[0], account: verified }, rows[1]], caption: "Classement" }));
  assert.equal((html.match(/data-avatar="member"/g) ?? []).length, 1);
  assert.equal((html.match(/data-avatar="initial"/g) ?? []).length, 1);
  assert.match(html, /data-avatar="member"><span>R<\/span><img alt="" [^>]*width="32" height="32"[^>]*src="https:\/\/cdn\.chatnet\.test\/avatars\/rezo\.webp"/);
  assert.equal((html.match(/<img/g) ?? []).length, 1);
});

test("a failed member photo falls back to the initial letter", () => {
  const h = client("components/games/PlayerAvatar.tsx");
  const tree = () => h.render("PlayerAvatar", { nickname: "rezo", avatar: verified.avatar });
  const [img] = elements(tree(), (el) => typeof el.props?.onError === "function");
  assert.equal(img.props.alt, "");
  img.props.onError();
  const html = markup(tree());
  assert.match(html, /data-avatar="initial"><span>R<\/span><\/span>/);
  assert.doesNotMatch(html, /<img/);
});

test("game identities never borrow a member photo from nickname equality", async () => {
  // The Game API only knows nicknames: its normalisation can never produce a verified account.
  const calls = [];
  const modules = publicMemberModules(async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ game: "quiz", entries: [{ ...rows[0], account: verified, avatar: verified.avatar }] }));
  }, { GAME_API_BASE_URL: "https://jeux-api.test" });
  const result = JSON.parse(JSON.stringify(await modules.load("lib/api/games.server.ts").getLeaderboard("quiz")));
  assert.deepEqual(result.entries, [rows[0]]);
  assert.deepEqual(calls.map((url) => new URL(url).pathname), ["/api/leaderboards/quiz"]);
  const pageSource = ["app/jeux/page.tsx", "app/jeux/quiz/page.tsx", "app/jeux/classement/page.tsx", "lib/api/games.server.ts", "components/games/LeaderboardTable.tsx"].map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
  assert.doesNotMatch(pageSource, /public-member|\/api\/members|getPublicMember|MemberAvatar/);
});

test("clicking a nickname or avatar opens the player card without leaving the leaderboard", () => {
  const h = client("components/games/LeaderboardTable.tsx");
  const render = () => h.render("LeaderboardTable", { entries: rows, caption: "Classement" });
  assert.equal(elements(render(), (el) => el.props?.player).length, 0);
  const links = elements(render(), (el) => el.props?.className === "leaderboard-player");
  assert.deepEqual(links.map((link) => link.props.href), ["/jeux/joueurs/Rezo", "/jeux/joueurs/%5BAymen%5D", "/jeux/joueurs/lea"]);
  // The avatar is inside the link, so it shares the same click target.
  assert.ok(elements(links[1], (el) => el.props?.nickname === "[Aymen]").length === 1);

  const event = click();
  links[1].props.onClick(event);
  assert.equal(event.defaultPrevented, true);
  const [dialog] = elements(render(), (el) => el.props?.player);
  assert.deepEqual(dialog.props.player, rows[1]);

  dialog.props.onClose();
  assert.equal(elements(render(), (el) => el.props?.player).length, 0);
  assert.equal(event.currentTarget.focused, 1, "focus returns to the link that opened the card");
});

test("modified or non-primary clicks keep the native link to the statistics page", () => {
  const h = client("components/games/LeaderboardTable.tsx");
  const render = () => h.render("LeaderboardTable", { entries: rows, caption: "Classement" });
  const [link] = elements(render(), (el) => el.props?.className === "leaderboard-player");
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const event = click(overrides);
    link.props.onClick(event);
    assert.equal(event.defaultPrevented, false, JSON.stringify(overrides));
  }
  assert.equal(elements(render(), (el) => el.props?.player).length, 0);
});

test("player card is a labelled modal dialog with stats, rank and the full statistics link", () => {
  const { PlayerProfileDialog } = real("components/games/PlayerProfileDialog.tsx");
  const html = markup(jsx(PlayerProfileDialog, { player: rows[1], onClose() {} }));
  const titleId = html.match(/<dialog class="player-dialog" aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(titleId);
  assert.match(html, new RegExp(`<h2 id="${titleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">\\[Aymen\\]</h2>`));
  assert.match(html, /<button type="button" class="player-dialog-close" aria-label="Fermer la fiche du joueur">/);
  assert.match(html, /2e<span class="sr-only"> au classement du Quiz<\/span>/);
  assert.match(html, /<dt>Points<\/dt><dd>40<\/dd>/);
  assert.match(html, /<dt>Parties jouées<\/dt><dd>5<\/dd>/);
  assert.match(html, /<dt>Victoires<\/dt><dd>1<\/dd>/);
  assert.match(html, /href="\/jeux\/joueurs\/%5BAymen%5D">Statistiques complètes/);
  assert.match(html, /pas forcément associé à un compte membre Chatnet/);
  assert.doesNotMatch(html, /\/membre\/|Profil membre|<img/);
  const first = markup(jsx(PlayerProfileDialog, { player: rows[0], onClose() {} }));
  assert.match(first, /1er<span class="sr-only">/);
  assert.match(first, /<dd>1\s200<\/dd>/);
});

test("a verified account adds its photo and public profile link to the player card", () => {
  const { PlayerProfileDialog } = real("components/games/PlayerProfileDialog.tsx");
  const html = markup(jsx(PlayerProfileDialog, { player: { ...rows[0], account: verified }, onClose() {} }));
  assert.match(html, /class="player-thumb player-thumb-large" aria-hidden="true" data-avatar="member"><span>R<\/span><img alt="" [^>]*width="72"/);
  assert.match(html, /class="button button-outline" href="\/membre\/Rezo">Profil membre<\/a>/);
  assert.doesNotMatch(html, /pas forcément associé/);
});

test("nicknames are rendered as text, never as markup", () => {
  const { PlayerProfileDialog } = real("components/games/PlayerProfileDialog.tsx");
  const html = markup(jsx(PlayerProfileDialog, { player: { ...rows[0], nickname: "<img src=x onerror=alert(1)>" }, onClose() {} }));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;<\/h2>/);
  assert.doesNotMatch(html, /<img src=x/);
  // An unsafe nickname can never become a link path either.
  assert.match(html, /href="\/jeux\/classement"/);
});

test("dialog opens modally and every close path (button, Escape, backdrop) reports a single close", () => {
  const h = client("components/games/PlayerProfileDialog.tsx");
  let closes = 0;
  const tree = () => h.render("PlayerProfileDialog", { player: rows[0], onClose: () => { closes += 1; } });
  tree();
  const dialog = fakeDialog(tree);
  h.slots[0].current = dialog; // dialogRef
  h.effects.forEach((effect) => effect());
  assert.equal(dialog.modal, true, "showModal() makes the page inert, traps focus and handles Escape");

  // Close button.
  elements(tree(), (el) => el.props?.className === "player-dialog-close")[0].props.onClick();
  assert.equal(closes, 1);

  // Escape: the browser cancels then closes a modal dialog, firing "close".
  dialog.showModal();
  dialog.close();
  assert.equal(closes, 2);

  // Backdrop: press and release on the dialog box itself (the panel fills it).
  dialog.showModal();
  const root = tree();
  const backdrop = { target: "dialog", currentTarget: "dialog" };
  root.props.onPointerDown(backdrop);
  tree().props.onClick(backdrop);
  assert.equal(closes, 3);

  // Clicks inside the panel, and selections dragged from the panel to the backdrop, keep it open.
  dialog.showModal();
  tree().props.onPointerDown({ target: "panel", currentTarget: "dialog" });
  tree().props.onClick({ target: "panel", currentTarget: "dialog" });
  tree().props.onPointerDown({ target: "panel", currentTarget: "dialog" });
  tree().props.onClick(backdrop);
  assert.equal(closes, 3);
  assert.equal(dialog.open, true);
});

test("player card styles stay inside small screens and align avatars in table rows", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.leaderboard-player \{ display: inline-flex; align-items: center; gap: 10px;/);
  assert.match(css, /\.player-thumb \{ position: relative; display: inline-grid; place-items: center; flex: 0 0 auto; width: 32px; height: 32px; overflow: hidden; border-radius: 50%;/);
  assert.match(css, /\.player-dialog \{ width: min\(440px, calc\(100% - 32px\)\); max-height: calc\(100dvh - 32px\); margin: auto;/);
  assert.match(css, /\.player-dialog-head h2 \{[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /@media \(max-width: 470px\) \{[^\n]*\.player-thumb:not\(\.player-thumb-large\) \{ width: 26px; height: 26px;[^\n]*\.player-dialog-actions \.button \{ width: 100%; \}/);
});
