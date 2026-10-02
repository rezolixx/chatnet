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
const byType = (tree, type) => elements(tree, (el) => el.type === type);
const plain = (v) => JSON.parse(JSON.stringify(v));

// Execute real client component handlers; mock scheduler, auth and external IO.
function client(path, { user = null, fetch = async () => { throw new Error("Unexpected fetch"); }, window = {} } = {}) {
  const slots = [], effects = [], records = new Map();
  let index = 0;
  const hooks = { ...React,
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (v) => { slots[slot] = typeof v === "function" ? v(slots[slot]) : v; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(fn); } },
  };
  const context = vm.createContext({ fetch, window, URL, AbortController, console });
  function load(relative) {
    let file = resolve(root, relative);
    if (!/\.tsx?$/.test(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (records.has(file)) return records.get(file).exports;
    const record = { exports: {} }; records.set(file, record);
    const localRequire = (s) => {
      if (s === "react") return hooks;
      if (s === "@/components/auth/AuthProvider") return { useAuth: () => ({ user, loading: false, refreshUser: async () => {} }) };
      if (s === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => jsx("a", { href, ...props }, children) };
      if (s === "@/components/community/MemberAvatar") return { MemberAvatar: () => null };
      if (s.startsWith("@/")) return load(s.slice(2));
      if (s.startsWith(".")) return load(resolve(dirname(file), s));
      return require(s);
    };
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, record, record.exports);
    return record.exports;
  }
  const componentModule = load(path);
  return { render: (name, props) => { index = 0; return componentModule[name](props); }, effects };
}

function server(response) {
  return publicMemberModules(async () => { if (response instanceof Error) throw response; return new Response(JSON.stringify(response)); });
}

test("cards used in directory and homepage link name/action to safe detail URLs", () => {
  const h = client("components/rooms/RoomCard.tsx");
  const html = renderToStaticMarkup(h.render("RoomCard", { room: { name: "#a&b", topic: "<script>private</script>" } }));
  assert.equal((html.match(/href="\/salons\/a%26b"/g) ?? []).length, 2);
  assert.match(html, /Voir le salon/);
  assert.match(html, /aria-label="Voir le salon a&amp;b"/);
  assert.match(html, /&lt;script&gt;private&lt;\/script&gt;/);
  assert.doesNotMatch(html, /href="\/#rejoindre"|<script>/);
});

test("directory search still filters name/topic and clears an empty search result", () => {
  const h = client("components/rooms/RoomDirectory.tsx");
  const props = { rooms: [{ name: "#Radio", topic: "Musique" }, { name: "#Aide", topic: null }] };
  const render = () => h.render("RoomDirectory", props);
  const cards = () => elements(render(), (el) => el.props?.room).map((el) => el.props.room.name);
  assert.deepEqual(cards(), ["#Radio", "#Aide"]);
  byType(render(), "input")[0].props.onChange({ target: { value: " MUSIQUE " } });
  assert.deepEqual(cards(), ["#Radio"]);
  byType(render(), "input")[0].props.onChange({ target: { value: "unknown" } });
  assert.deepEqual(cards(), []);
  byType(render(), "button")[0].props.onClick();
  assert.deepEqual(cards(), ["#Radio", "#Aide"]);
});

test("detail renders authoritative name/full escaped topic, join props, back action and noindex metadata", async () => {
  const topic = "Long sujet\n" + "contenu ".repeat(150) + "<script>unsafe</script>";
  const modules = server([{ channel: "#Radio", topic, chanid: 44, modes: "private", topicauthor: "private" }]);
  const page = modules.load("app/salons/[channel]/page.tsx");
  const props = { params: Promise.resolve({ channel: "radio" }) };
  const tree = await page.default(props);
  const intro = elements(tree, (el) => el.props?.eyebrow)[0];
  assert.equal(intro.props.title, "#Radio");
  assert.equal(byType(tree, "p")[0].props.children, topic);
  assert.match(renderToStaticMarkup(byType(tree, "article")[0]), /&lt;script&gt;unsafe/);
  assert.equal(elements(tree, (el) => el.props?.selectedRoom)[0].props.selectedRoom, "#Radio");
  assert.equal(elements(tree, (el) => el.props?.href === "/salons")[0].props.children, "Retour aux salons");
  const metadata = await page.generateMetadata(props);
  assert.equal(metadata.alternates.canonical, "https://chatnet.fr/salons/Radio");
  assert.deepEqual(plain(metadata.robots), { index: false, follow: true });
  assert.equal(metadata.title, "Salon #Radio");
  assert.doesNotMatch(JSON.stringify(metadata), /private|chanid|ticket=|token=/);
});

test("missing topic is explicit; encoded unicode room has a page but no guessed WebChat fragment", async () => {
  const page = server([{ channel: "#café", topic: "" }]).load("app/salons/[channel]/page.tsx");
  const props = { params: Promise.resolve({ channel: "caf%C3%A9" }) };
  const tree = await page.default(props);
  assert.equal(byType(tree, "p")[0].props.children, "Aucun sujet n’est renseigné pour ce salon.");
  assert.equal(elements(tree, (el) => el.props?.selectedRoom).length, 0);
  assert.match(byType(tree, "p")[1].props.children, /ouverture directe/);
  assert.equal((await page.generateMetadata(props)).alternates.canonical, "https://chatnet.fr/salons/caf%C3%A9");
});

test("working list with unknown/unsafe room throws Next 404; upstream failure renders unavailable", async () => {
  for (const channel of ["unknown", "../radio", "a\nJOIN"]) {
    const page = server([{ channel: "#radio" }]).load("app/salons/[channel]/page.tsx");
    await assert.rejects(page.default({ params: Promise.resolve({ channel }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
  const page = server(new Error("timeout PRIVATE")).load("app/salons/[channel]/page.tsx");
  const tree = await page.default({ params: Promise.resolve({ channel: "radio" }) });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Salon indisponible/);
  assert.match(html, /Retour aux salons/);
  assert.doesNotMatch(html, /PRIVATE|Aucun salon/);
  const notFound = server([]).load("app/salons/[channel]/not-found.tsx");
  assert.match(renderToStaticMarkup(notFound.default()), /Salon introuvable/);
  assert.match(renderToStaticMarkup(notFound.default()), /Retour aux salons/);
});

test("directory empty and failure states remain distinct; room pages stay outside indexing lists", async () => {
  for (const [response, expected] of [[[], /Aucun salon enregistré/], [new Error("failed"), /temporairement indisponibles/]]) {
    const tree = await server(response).load("app/salons/page.tsx").default();
    const html = renderToStaticMarkup(tree);
    assert.match(html, expected);
    if (response instanceof Error) assert.doesNotMatch(html, /Aucun salon/);
  }
  const indexable = readFileSync(resolve(root, "lib/seo/indexable.ts"), "utf8");
  assert.doesNotMatch(indexable, /\/salons\//);
});

test("guest/member wrapper forwards the selected room and prevents unsupported join forms", () => {
  for (const user of [null, { nickname: "Member" }]) {
    const h = client("components/chat/ChatJoinForm.tsx", { user });
    const tree = h.render("ChatJoinForm", { selectedRoom: "#radio" });
    assert.equal(tree.props.selectedRoom, "radio");
    assert.equal(h.render("ChatJoinForm", {}).props.selectedRoom, undefined);
    assert.equal(h.render("ChatJoinForm", { selectedRoom: "café" }).props.role, "alert");
  }
});

test("guest handler forwards selected room only to the final chat URL, preserving direct ticket GET", async () => {
  const calls = [], navigations = [];
  const popup = { closed: false, close() {}, set opener(v) {}, location: { set href(url) { navigations.push(url); } } };
  const h = client("components/chat/ChatJoinForm.tsx", { fetch: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ticket: "one-time" })); }, window: { open: () => popup, setTimeout: () => 1, clearTimeout() {} } });
  const guest = h.render("ChatJoinForm", { selectedRoom: "#radio" });
  const render = () => guest.type(guest.props);
  // Reset hook cursor by wrapper render before rendering its guest child.
  const rerender = () => { h.render("ChatJoinForm", { selectedRoom: "#radio" }); return render(); };
  for (const [name, value] of [["nick", "Guest"], ["age", "25"], ["ville", "Paris"]]) byType(rerender(), "input").find((el) => el.props.name === name).props.onChange({ target: { value } });
  byType(rerender(), "input").find((el) => el.props.value === "F").props.onChange();
  await byType(rerender(), "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://laravel.discut.org/api/chat/origin-ticket");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(new URL(navigations[0]).hash, "#radio");
  assert.equal(new URL(navigations[0]).searchParams.get("chatnow"), "1");
});

test("member handler keeps the preparation contract and uses the selected fragment", async () => {
  const calls = [], navigations = [];
  const profile = { nickname: "Member", avatar: null, age: 25, gender: "Femme", pays: "France" };
  const h = client("components/chat/AuthenticatedChatCard.tsx", { fetch: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(url.endsWith("chat-profile") ? { profile } : { nickname: "Member", token: "one-time", ticket: "ticket" })); }, window: { open: () => ({ closed: false, close() {}, location: { set href(url) { navigations.push(url); } } }), setTimeout: () => 1, clearTimeout() {} } });
  const props = { nickname: "Member", selectedRoom: "#radio" };
  h.render("AuthenticatedChatCard", props);
  h.effects.forEach((fn) => fn());
  await new Promise((resolve) => setImmediate(resolve));
  await byType(h.render("AuthenticatedChatCard", props), "button")[0].props.onClick();
  assert.deepEqual(calls.map((c) => c.url), ["/api/auth/chat-profile", "/api/auth/chat/prepare"]);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body, undefined);
  assert.equal(new URL(navigations[0]).hash, "#radio");
});
