import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import * as contact from "../src/lib/support/contact.ts";
import { elements } from "./helpers/password-form.mjs";

const require = createRequire(import.meta.url);
const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const byType = (tree, type) => elements(tree, (element) => element.type === type);

function component(path, name, { fetch = async () => { throw new Error("Unexpected request"); }, user = { nickname: "Member_01" }, loading = false, mocks = {} } = {}) {
  const slots = [];
  const redirects = [];
  const refreshes = [];
  let index = 0;
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(effect) { effect(); },
  };
  const link = ({ href, children, ...props }) => require("react/jsx-runtime").jsx("a", { href, ...props, children });
  const localRequire = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (specifier === "react") return hooks;
    if (specifier === "next/link") return { default: link };
    if (specifier === "next/navigation") return { usePathname: () => "/assistance", useRouter: () => ({ replace: (url) => redirects.push(url), refresh() {} }) };
    if (specifier === "@/components/auth/AuthProvider") return { useAuth: () => ({ user, loading, refreshUser: async (invalidate) => refreshes.push(invalidate) }) };
    if (specifier === "@/lib/support/contact") return contact;
    if (specifier === "./AssistanceForm") return { AssistanceForm: () => null };
    if (specifier.startsWith("@/components/")) return new Proxy({}, { get: () => () => null });
    if (specifier === "@/lib/site") return { site: { nav: [{ href: "/", label: "Accueil" }] }, joinHref: "/#rejoindre" };
    return require(specifier);
  };
  const code = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInContext(`(function(require, exports) { ${code}\n })`, vm.createContext({ fetch }))(localRequire, exports);
  return { render: (props = {}) => { index = 0; return exports[name](props); }, redirects, refreshes };
}

function filled(h) {
  byType(h.render(), "input")[0].props.onChange({ target: { value: "Besoin d’aide" } });
  byType(h.render(), "textarea")[0].props.onChange({ target: { value: "Mon message" } });
  return h.render();
}

test("form exposes only subject/message and safely clears them only after confirmed HTTP 201", async () => {
  const calls = [];
  let complete;
  const h = component("components/support/AssistanceForm.tsx", "AssistanceForm", { fetch: (url, init) => {
    calls.push({ url, ...init });
    return new Promise((resolve) => { complete = resolve; });
  } });
  const tree = filled(h);
  assert.deepEqual([...byType(tree, "input"), ...byType(tree, "textarea")].map((field) => field.props.name), ["subject", "message"]);
  const submit = tree.props.onSubmit({ preventDefault() {} });
  // The same handler cannot enqueue a second submission before a re-render.
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(h.render().props["aria-busy"], true);
  assert.equal(byType(h.render(), "button")[0].props.disabled, true);
  assert.equal(byType(h.render(), "input")[0].props.disabled, true);
  assert.equal(byType(h.render(), "textarea")[0].props.disabled, true);
  assert.equal(calls[0].url, "/api/auth/assistance");
  assert.deepEqual(JSON.parse(calls[0].body), { subject: "Besoin d’aide", message: "Mon message" });
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].credentials, "same-origin");
  assert.equal(calls[0].cache, "no-store");
  complete(new Response(JSON.stringify({ sent: true }), { status: 201 }));
  await submit;
  assert.equal(byType(h.render(), "input")[0].props.value, "");
  assert.equal(byType(h.render(), "textarea")[0].props.value, "");
  assert.equal(h.render().props["aria-busy"], false);
  assert.equal(elements(h.render(), (element) => element.props?.role === "status")[0].props.children, contact.contactSuccessMessage);
  const html = renderToStaticMarkup(h.render());
  assert.doesNotMatch(html, /ticket|statut|suivi|pièce jointe|historique|réponse|#[0-9]+/i);
});

test("validation errors, generic failures and unconfirmed success preserve the entered message", async () => {
  for (const response of [new Response(JSON.stringify({ errors: { message: ["UPSTREAM_SECRET"] } }), { status: 422 }), new Response("UPSTREAM_SECRET", { status: 500 }), new Response(JSON.stringify({ sent: true }), { status: 200 }), new Response(JSON.stringify({ sent: false }), { status: 201 }), new Response("invalid", { status: 201 })]) {
    const h = component("components/support/AssistanceForm.tsx", "AssistanceForm", { fetch: async () => response });
    await filled(h).props.onSubmit({ preventDefault() {} });
    assert.equal(byType(h.render(), "input")[0].props.value, "Besoin d’aide");
    assert.equal(byType(h.render(), "textarea")[0].props.value, "Mon message");
    assert.ok(elements(h.render(), (element) => element.props?.role === "alert").length);
    assert.equal(elements(h.render(), (element) => element.props?.role === "status").length, 0);
    assert.doesNotMatch(renderToStaticMarkup(h.render()), /UPSTREAM_SECRET/);
  }
});

test("empty message fails local validation; subject is optional; network failure is generic", async () => {
  const h = component("components/support/AssistanceForm.tsx", "AssistanceForm");
  await h.render().props.onSubmit({ preventDefault() {} });
  assert.equal(byType(h.render(), "textarea")[0].props["aria-invalid"], true);
  assert.equal(byType(h.render(), "input")[0].props.required, undefined);
  const failed = component("components/support/AssistanceForm.tsx", "AssistanceForm", { fetch: async () => { throw new Error("SECRET"); } });
  await filled(failed).props.onSubmit({ preventDefault() {} });
  assert.equal(elements(failed.render(), (element) => element.props?.role === "alert")[0].props.children, contact.contactUnavailableMessage);
});

test("session expiry uses the existing refresh flow and never confirms success", async () => {
  const h = component("components/support/AssistanceForm.tsx", "AssistanceForm", { fetch: async () => new Response("{}", { status: 401 }) });
  await filled(h).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.refreshes, [true]);
  assert.equal(elements(h.render(), (element) => element.props?.role === "status").length, 0);
});

test("loading, guest and unavailable states hide the form; guest redirects to login", () => {
  for (const state of [{ loading: true }, { user: null }]) {
    const h = component("components/support/AssistanceContent.tsx", "AssistanceContent", state);
    assert.equal(h.render({ available: true }).props["aria-busy"], "true");
    if (state.user === null) assert.deepEqual(h.redirects, ["/connexion"]);
  }
  const h = component("components/support/AssistanceContent.tsx", "AssistanceContent");
  assert.equal(h.render({ available: false }).props.role, "alert");
  assert.match(renderToStaticMarkup(h.render({ available: true })), /Contacter l’équipe/);
});

test("guest/loading navbar has no Assistance link; authenticated desktop and mobile do", () => {
  for (const state of [{ user: null }, { loading: true }]) {
    const h = component("components/layout/Navbar.tsx", "Navbar", state);
    assert.doesNotMatch(renderToStaticMarkup(h.render()), /href="\/assistance"/);
  }
  const h = component("components/layout/Navbar.tsx", "Navbar");
  assert.equal((renderToStaticMarkup(h.render()).match(/href="\/assistance"/g) ?? []).length, 2);
});

test("server page requires real bridge cookies and authenticated me before rendering the member form", async () => {
  const redirect = (url) => { throw new Error(`REDIRECT:${url}`); };
  const cookies = (present) => ({ cookies: async () => ({ get: () => present ? { value: "private-cookie" } : undefined }) });
  const page = (present, response) => component("app/assistance/page.tsx", "default", { mocks: {
    "next/headers": cookies(present),
    "next/navigation": { redirect },
    "@/lib/auth/cookies.server": { SESSION_COOKIE: "session", XSRF_COOKIE: "xsrf" },
    "@/lib/auth/laravel.server": { laravelMe: async () => ({ response }) },
    "@/components/support/AssistanceContent": { AssistanceContent: () => null },
  } });
  await assert.rejects(page(false).render(), /REDIRECT:\/connexion/);
  for (const status of [401, 419]) await assert.rejects(page(true, new Response("{}", { status })).render(), /REDIRECT:\/connexion/);
  for (const [raw, expected] of [[{ nickname: "Member", email: "member@example.com" }, true], [{ nickname: "Member" }, false]]) {
    const tree = await page(true, new Response(JSON.stringify(raw))).render();
    const content = elements(tree, (element) => Object.hasOwn(element.props ?? {}, "available"));
    assert.equal(content[0].props.available, expected);
    assert.deepEqual(Object.keys(content[0].props), ["available"]);
  }
});
