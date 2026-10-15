import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import { elements } from "./helpers/password-form.mjs";
import {
  ACCOUNT_RESTRICTION_UNAVAILABLE,
  AccountRefusalError,
  accountRefusalBody,
  accountRefusalFrom,
  accountRefusalText,
  accountRefusalView,
  formatRestrictionDate,
} from "../src/lib/auth/account-restriction.ts";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../src/", import.meta.url));
const jsx = React.createElement;
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
const bridge = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const user = { nickname: "Member_01", avatar: null, pays: "France", description: null, inscritDepuis: "01/01/2020" };
const PRIVATE = ["PRIVATE", "admin_id", "internal_note", "operation_id", "audit", "starts_at", "\"type\"", "\"permanent\""];
const plain = (value) => JSON.parse(JSON.stringify(value));

// Laravel's refusal bodies, with fields the sites must never relay or show.
const restriction = (kind, expiresAt, reason = "Spam répété dans #Accueil") => ({
  type: kind === "temporary_suspension" ? "suspension" : "ban",
  kind,
  permanent: expiresAt === null,
  reason,
  starts_at: "2026-10-15T08:00:00Z",
  expires_at: expiresAt,
  admin_id: 42,
  internal_note: "PRIVATE internal note",
  operation_id: "PRIVATE-op",
});
const suspended = { code: "ACCOUNT_SUSPENDED", message: "Votre compte est suspendu temporairement.", restriction: restriction("temporary_suspension", "2026-10-22T10:00:00Z"), audit_id: "PRIVATE-audit" };
const temporaryBan = { code: "ACCOUNT_BANNED", message: "Votre compte est banni temporairement.", restriction: restriction("temporary_ban", "2026-11-01T09:30:00Z", "Insultes") };
const permanentBan = { code: "ACCOUNT_BANNED", message: "Votre compte est banni définitivement.", restriction: restriction("permanent_ban", null, "Harcèlement") };
const unavailable = { code: ACCOUNT_RESTRICTION_UNAVAILABLE, message: "Service momentanément indisponible. Réessayez dans quelques instants." };

function assertPublicOnly(text) {
  for (const leaked of PRIVATE) assert.ok(!text.includes(leaked), `leaked ${leaked}`);
}

// --- Shared helper ---------------------------------------------------------

test("helper: suspension, temporary ban and permanent ban keep only the public fields", () => {
  assert.deepEqual(accountRefusalFrom(403, suspended), { code: "ACCOUNT_SUSPENDED", kind: "temporary_suspension", reason: "Spam répété dans #Accueil", expiresAt: "2026-10-22T10:00:00.000Z" });
  assert.deepEqual(accountRefusalFrom(403, temporaryBan), { code: "ACCOUNT_BANNED", kind: "temporary_ban", reason: "Insultes", expiresAt: "2026-11-01T09:30:00.000Z" });
  assert.deepEqual(accountRefusalFrom(403, permanentBan), { code: "ACCOUNT_BANNED", kind: "permanent_ban", reason: "Harcèlement", expiresAt: null });
  assert.deepEqual(accountRefusalFrom(503, unavailable), { code: ACCOUNT_RESTRICTION_UNAVAILABLE });
  const body = JSON.stringify(accountRefusalBody(accountRefusalFrom(403, suspended)));
  assert.equal(body, JSON.stringify({ code: "ACCOUNT_SUSPENDED", restriction: { kind: "temporary_suspension", reason: "Spam répété dans #Accueil", expires_at: "2026-10-22T10:00:00.000Z" } }));
  assertPublicOnly(body);
});

test("helper: anything else is not a restriction refusal; the code wins over its metadata", () => {
  for (const [status, body] of [
    [401, suspended], [503, suspended], [403, unavailable], [403, { code: "ACCOUNT_UNAVAILABLE" }], [403, { message: "Votre compte est désactivé." }],
    [403, null], [403, "ACCOUNT_BANNED"], [403, ["ACCOUNT_BANNED"]], [500, unavailable], [200, permanentBan],
  ]) assert.equal(accountRefusalFrom(status, body), null, `${status} ${JSON.stringify(body)}`);
  // A restriction code without valid metadata is still a refusal, never a wrong password.
  assert.deepEqual(accountRefusalFrom(403, { code: "ACCOUNT_BANNED" }), { code: "ACCOUNT_BANNED", kind: "ban", reason: "", expiresAt: null });
  assert.equal(accountRefusalFrom(403, { code: "ACCOUNT_SUSPENDED", restriction: { kind: "permanent_ban" } }).kind, "temporary_suspension");
  assert.equal(accountRefusalFrom(403, { code: "ACCOUNT_BANNED", restriction: { kind: "temporary_suspension", expires_at: "nope" } }).expiresAt, null);
  assert.equal(accountRefusalFrom(403, { code: "ACCOUNT_BANNED", restriction: { kind: "temporary_ban", reason: `\u0000 ${"x".repeat(600)} ` } }).reason.length, 500);
});

test("helper: French copy matches discut.org / the WebChat, end date in the visitor's time zone", () => {
  const paris = { timeZone: "Europe/Paris" };
  assert.equal(formatRestrictionDate("2026-10-22T10:00:00Z", paris), "22 octobre 2026 à 12:00 UTC+2");
  assert.equal(formatRestrictionDate("2026-10-22T10:00:00Z", { timeZone: "America/Montreal" }), "22 octobre 2026 à 06:00 UTC−4");
  assert.deepEqual(accountRefusalView(accountRefusalFrom(403, suspended), paris), {
    title: "Compte suspendu", message: "Votre compte est suspendu temporairement, jusqu’au 22 octobre 2026 à 12:00 UTC+2.", reason: "Spam répété dans #Accueil", temporary: true, retry: false,
  });
  assert.deepEqual(accountRefusalView(accountRefusalFrom(403, temporaryBan), paris), {
    title: "Compte banni temporairement", message: "Votre compte est banni temporairement, jusqu’au 1 novembre 2026 à 10:30 UTC+1.", reason: "Insultes", temporary: true, retry: false,
  });
  assert.deepEqual(accountRefusalView(accountRefusalFrom(403, permanentBan), paris), {
    title: "Compte banni définitivement", message: "Votre compte est banni définitivement.", reason: "Harcèlement", temporary: false, retry: false,
  });
  const down = accountRefusalView(accountRefusalFrom(503, unavailable));
  assert.equal(down.title, "Service momentanément indisponible");
  assert.equal(down.retry, true);
  assert.equal(accountRefusalText(accountRefusalFrom(403, permanentBan)), "Compte banni définitivement. Votre compte est banni définitivement. Motif : Harcèlement");
  assert.equal(new AccountRefusalError(accountRefusalFrom(403, suspended)).message, "Compte suspendu");
});

// --- BFF routes -------------------------------------------------------------

function csrf() {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
}

function route(name, responses) {
  const calls = [];
  const loaded = loadAuthRoute(name, async (url, init) => {
    calls.push({ url: new URL(url).pathname, init });
    assert.ok(responses.length, `Unexpected network call: ${url}`);
    return responses.shift();
  });
  return { ...loaded, calls, remaining: responses };
}

function request(path, { method = "POST", body, cookies = bridge } = {}) {
  const headers = { Origin: "https://chatnet.fr", "Content-Type": "application/json" };
  if (cookies) headers.Cookie = cookies;
  return new NextRequest(`https://chatnet.fr${path}`, { method, headers, body });
}

const cleared = (response) => response.headers.getSetCookie().filter((line) => /^chatnet_upstream_(session|xsrf)=;/.test(line) && /Max-Age=0/i.test(line)).length;

async function relayed(response, status, code) {
  const text = await response.text();
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assertPublicOnly(text);
  for (const secret of ["session-one", "session-two", "xsrf"]) assert.ok(!text.includes(secret));
  const body = JSON.parse(text);
  assert.equal(body.code, code);
  return body;
}

const loginBody = JSON.stringify({ login: "Member_01", password: "Password!123" });

test("login BFF: a suspended or banned member is not told 'wrong password'", async () => {
  for (const [refusal, kind] of [[suspended, "temporary_suspension"], [temporaryBan, "temporary_ban"], [permanentBan, "permanent_ban"]]) {
    const h = route("login", [csrf(), json(refusal, 403)]);
    const response = await h.POST(request("/api/auth/login", { body: loginBody, cookies: null }));
    const body = await relayed(response, 403, refusal.code);
    assert.equal(body.restriction.kind, kind);
    assert.equal(body.restriction.reason, refusal.restriction.reason);
    assert.equal(body.restriction.expires_at, refusal.restriction.expires_at && new Date(refusal.restriction.expires_at).toISOString());
    assert.equal(cleared(response), 2, "no bridge session is opened");
    assert.deepEqual(h.calls.map((c) => c.url), ["/sanctum/csrf-cookie", "/api/login"]);
  }
});

test("login BFF: unreadable restriction state fails closed with its own code", async () => {
  const h = route("login", [csrf(), json(unavailable, 503)]);
  const response = await h.POST(request("/api/auth/login", { body: loginBody, cookies: null }));
  assert.deepEqual(await relayed(response, 503, ACCOUNT_RESTRICTION_UNAVAILABLE), { code: ACCOUNT_RESTRICTION_UNAVAILABLE });
  assert.equal(response.headers.getSetCookie().length, 0);
  // Refused at the session check right after the sign-in, too.
  const late = route("login", [csrf(), json({ user }, 200, { "Set-Cookie": "laravel_session=session-three; Path=/" }), json(suspended, 403)]);
  await relayed(await late.POST(request("/api/auth/login", { body: loginBody, cookies: null })), 403, "ACCOUNT_SUSPENDED");
});

test("login BFF: normal sign-in and other refusals are unchanged", async () => {
  const ok = route("login", [csrf(), json({ user }, 200, { "Set-Cookie": "laravel_session=session-three; Path=/" }), json(user)]);
  const response = await ok.POST(request("/api/auth/login", { body: loginBody, cookies: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user });
  assert.ok(response.headers.getSetCookie().some((line) => line.startsWith("chatnet_upstream_session=session-three")));
  for (const [status, body] of [[401, { message: "Identifiants invalides." }], [422, { message: "x" }], [403, { message: "Votre compte est désactivé." }], [403, { code: "ACCOUNT_DELETION_PENDING" }]]) {
    const h = route("login", [csrf(), json(body, status)]);
    const refused = await h.POST(request("/api/auth/login", { body: loginBody, cookies: null }));
    assert.equal(refused.status, 401);
    assert.equal((await refused.json()).code, "INVALID_CREDENTIALS");
  }
});

test("session check BFF: a restriction ends the bridge session; an unreadable state keeps it", async () => {
  const restricted = await route("me", [json(temporaryBan, 403)]).GET(request("/api/auth/me", { method: "GET" }));
  await relayed(restricted, 403, "ACCOUNT_BANNED");
  assert.equal(cleared(restricted), 2);
  const down = await route("me", [json(unavailable, 503)]).GET(request("/api/auth/me", { method: "GET" }));
  await relayed(down, 503, ACCOUNT_RESTRICTION_UNAVAILABLE);
  assert.equal(down.headers.getSetCookie().length, 0);
  // Every member route relays the same refusal from its session check.
  for (const name of ["profile", "chat-profile"]) {
    const response = await route(name, [json(suspended, 403)]).GET(request(`/api/auth/${name}`, { method: "GET" }));
    await relayed(response, 403, "ACCOUNT_SUSPENDED");
    assert.equal(cleared(response), 2, name);
  }
});

test("chat handoff BFF: a restricted member gets the refusal, never CHAT_HANDOFF_REFUSED or a handoff code", async () => {
  // Refused at the session check: no profile read, no handoff requested.
  const early = route("chat/handoff", [json(suspended, 403)]);
  await relayed(await early.POST(request("/api/auth/chat/handoff", { body: JSON.stringify({ room: "radio" }) })), 403, "ACCOUNT_SUSPENDED");
  assert.deepEqual(early.calls.map((c) => c.url), ["/api/me"]);
  // Restricted meanwhile: refused by the handoff itself.
  const member = { nickname: "Member_01", avatar: null, pays: "France", birthdate: "1990-05-17", gender: "Femme" };
  for (const [status, body] of [[403, permanentBan], [503, unavailable]]) {
    const late = route("chat/handoff", [json(user), json(member), csrf(), json({ authenticated: false, ...body }, status)]);
    const response = await late.POST(request("/api/auth/chat/handoff", { body: JSON.stringify({ room: "radio" }) }));
    const relayedBody = await relayed(response, status, body.code);
    assert.ok(!("handoff" in relayedBody));
    assert.equal(cleared(response), status === 403 ? 2 : 0);
  }
  // The legacy preparation relays it too, instead of ACCOUNT_UNAVAILABLE.
  const legacy = route("chat/prepare", [json(user), csrf(), json(temporaryBan, 403)]);
  await relayed(await legacy.POST(request("/api/auth/chat/prepare")), 403, "ACCOUNT_BANNED");
});

test("logout BFF: a restricted member's ended session counts as signed out", async () => {
  const response = await route("logout", [csrf(), json(suspended, 403)]).POST(request("/api/auth/logout"));
  assert.equal(response.status, 200);
  assert.equal(cleared(response), 2);
});

// --- Browser ----------------------------------------------------------------

// Run real client modules with persistent hook slots; only React's scheduler,
// Next's router/link, the icons and the network are substituted.
function client(entry, { fetch = async (url) => assert.fail(`Unexpected fetch ${url}`), auth, pathname = "/" } = {}) {
  const slots = [], effects = [], records = new Map(), navigations = [];
  let index = 0;
  const storage = new Proxy({}, { get(_, key) { throw new Error(`storage.${String(key)} used`); } });
  const hooks = { ...React,
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial; return [slots[slot], (v) => { slots[slot] = typeof v === "function" ? v(slots[slot]) : v; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useCallback(fn) { index++; return fn; },
    useEffect(fn) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(fn); } },
    useContext() { return auth?.(); },
  };
  const context = vm.createContext({ fetch, window: { localStorage: storage, sessionStorage: storage }, localStorage: storage, sessionStorage: storage, document: { getElementById: () => null }, URL, AbortController, Intl, console });
  function load(relative) {
    let file = resolve(root, relative);
    if (!/\.tsx?$/.test(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (records.has(file)) return records.get(file).exports;
    const record = { exports: {} }; records.set(file, record);
    const localRequire = (s) => {
      if (s === "react") return hooks;
      if (s === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ push: (url) => navigations.push(url), replace: (url) => navigations.push(url), refresh() {} }) };
      if (s === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => jsx("a", { href, ...props }, children) };
      if (s === "@/components/ui/Icons") return { Icon: () => null };
      if (s.startsWith("@/")) return load(s.slice(2));
      if (s.startsWith(".")) return load(resolve(dirname(file), s));
      return require(s);
    };
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, record, record.exports);
    return record.exports;
  }
  const exports = load(entry);
  return {
    load, navigations,
    render(name, props = {}) { index = 0; return exports[name](props); },
    async mount() { this.render(...this.entry); effects.splice(0).forEach((fn) => fn()); await new Promise((r) => setImmediate(r)); },
  };
}

const respond = (body, status = 200) => async () => json(body, status);

function provider(responses) {
  const calls = [];
  const h = client("components/auth/AuthProvider.tsx", { fetch: async (url, init) => {
    calls.push(url);
    const next = responses[url]?.shift();
    assert.ok(next, `Unexpected fetch ${url}`);
    return next(init);
  } });
  h.entry = ["AuthProvider", { children: null }];
  const value = () => h.render("AuthProvider", { children: null }).props.value;
  return { ...h, calls, value, memberFetch: h.load("lib/auth/member-fetch").memberFetch };
}

test("an existing session receiving a 403 restriction clears the member state and shows the notice", async () => {
  const h = provider({ "/api/auth/me": [respond({ user })], "/api/auth/profile/update": [respond({ code: "ACCOUNT_SUSPENDED", restriction: { kind: "temporary_suspension", reason: "Spam", expires_at: "2026-10-22T10:00:00Z" } }, 403)] });
  await h.mount();
  assert.deepEqual(plain(h.value().user), user);
  assert.equal(h.value().accountRefusal, null);
  const response = await h.memberFetch("/api/auth/profile/update", { method: "PUT" });
  assert.equal(response.status, 403);
  assert.equal(await response.json().then((b) => b.code), "ACCOUNT_SUSPENDED", "the caller can still read the body");
  assert.equal(h.value().user, null);
  assert.equal(h.value().loading, false);
  assert.deepEqual(plain(h.value().accountRefusal), { code: "ACCOUNT_SUSPENDED", kind: "temporary_suspension", reason: "Spam", expiresAt: "2026-10-22T10:00:00.000Z" });
  // Shown site-wide, but not stored: dismissing it forgets it.
  const notice = client("components/auth/AccountRestrictionNotice.tsx", { auth: () => h.value() });
  const html = renderToStaticMarkup(notice.render("AccountRestrictionNotice"));
  assert.match(html, /Compte suspendu/);
  assert.match(html, /Motif :<\/strong> Spam/);
  assert.ok(html.includes(`jusqu’au ${formatRestrictionDate("2026-10-22T10:00:00Z")}`));
  assert.match(html, /aria-label="Fermer ce message"/);
  h.value().clearAccountRefusal();
  assert.equal(h.value().accountRefusal, null);
  assert.equal(notice.render("AccountRestrictionNotice"), null);
});

test("a restricted or unverifiable session at page load leaves no member signed in, with no loop", async () => {
  const banned = provider({ "/api/auth/me": [respond(permanentBan, 403)] });
  await banned.mount();
  assert.equal(banned.value().user, null);
  assert.equal(banned.value().accountRefusal.kind, "permanent_ban");
  assert.deepEqual(plain(banned.calls), ["/api/auth/me"], "one session check, no retry");
  const down = provider({ "/api/auth/me": [respond(unavailable, 503), respond({ user })] });
  await down.mount();
  assert.equal(down.value().user, null);
  assert.deepEqual(plain(down.value().accountRefusal), { code: ACCOUNT_RESTRICTION_UNAVAILABLE });
  // "Réessayer": the API decides again; a valid session clears the notice.
  await down.value().refreshUser();
  assert.deepEqual(plain(down.value().user), user);
  assert.equal(down.value().accountRefusal, null);
  // Not shown twice on the sign-in page (the form shows it).
  assert.equal(client("components/auth/AccountRestrictionNotice.tsx", { auth: () => banned.value(), pathname: "/connexion" }).render("AccountRestrictionNotice"), null);
});

test("login: restriction refusals throw AccountRefusalError; unrestricted login is unchanged", async () => {
  const h = provider({ "/api/auth/me": [respond({ code: "AUTH_REQUIRED" }, 401)], "/api/auth/login": [respond(accountRefusalBody(accountRefusalFrom(403, suspended)), 403), respond(unavailable, 503), respond({ code: "INVALID_CREDENTIALS" }, 401), respond({ user })] });
  await h.mount();
  await assert.rejects(h.value().login("Member_01", "x"), (error) => error.name === "AccountRefusalError" && error.refusal.kind === "temporary_suspension");
  assert.equal(h.value().accountRefusal.code, "ACCOUNT_SUSPENDED");
  h.value().clearAccountRefusal();
  await assert.rejects(h.value().login("Member_01", "x"), (error) => error.name === "AccountRefusalError" && error.refusal.code === ACCOUNT_RESTRICTION_UNAVAILABLE);
  assert.equal(h.value().accountRefusal, null, "an unavailable sign-in is shown by the form only");
  await assert.rejects(h.value().login("Member_01", "x"), { message: "Identifiants incorrects." });
  await h.value().login("Member_01", "Password!123");
  assert.deepEqual(plain(h.value().user), user);
  assert.equal(h.value().accountRefusal, null);
});

// `refuse(helpers)`: the refusal login() throws, built with the harness's own classes.
function loginForm(refuse) {
  const state = { refusal: null };
  let login = async () => {};
  const auth = () => ({ user: null, loading: false, login, accountRefusal: state.refusal, clearAccountRefusal: () => { state.refusal = null; } });
  const h = client("components/auth/LoginForm.tsx", { auth });
  if (refuse) {
    const helpers = h.load("lib/auth/account-restriction");
    login = async () => { throw new helpers.AccountRefusalError(refuse(helpers)); };
  }
  const render = () => h.render("LoginForm");
  const byType = (type) => elements(render(), (el) => el.type === type);
  return {
    html: () => renderToStaticMarkup(render()),
    async submit() {
      byType("input")[0].props.onChange({ target: { value: "Member_01" } });
      byType("input")[1].props.onChange({ target: { value: "Password!123" } });
      await byType("form")[0].props.onSubmit({ preventDefault() {} });
    },
    navigations: h.navigations,
  };
}

test("login form shows each restriction, never as invalid credentials", async () => {
  for (const [body, status, expected] of [
    [suspended, 403, ["Compte suspendu", `Votre compte est suspendu temporairement, jusqu’au ${formatRestrictionDate("2026-10-22T10:00:00Z")}.`, "Spam répété dans #Accueil", "Vous pourrez vous reconnecter après cette date."]],
    [temporaryBan, 403, ["Compte banni temporairement", `jusqu’au ${formatRestrictionDate("2026-11-01T09:30:00Z")}`, "Insultes"]],
    [permanentBan, 403, ["Compte banni définitivement", "Votre compte est banni définitivement.", "Harcèlement"]],
    [unavailable, 503, ["Service momentanément indisponible", "Réessayez dans quelques minutes."]],
  ]) {
    const form = loginForm((helpers) => helpers.accountRefusalFrom(status, body));
    await form.submit();
    const html = form.html();
    for (const text of expected) assert.ok(html.includes(text), `${body.code}: ${text}\n${html}`);
    if (status === 403) assert.match(html, /Motif :/);
    assert.doesNotMatch(html, /Identifiants incorrects/);
    assertPublicOnly(html);
    assert.deepEqual(form.navigations, [], "no redirect");
  }
  assert.doesNotMatch(loginForm().html(), /role="alert"/);
});

function chatJoin(auth) {
  return client("components/chat/ChatJoinForm.tsx", { auth }).render("ChatJoinForm");
}

test("chat entry: a refused member gets the notice, never the guest form; anonymous visitors keep it", () => {
  const anonymous = chatJoin(() => ({ user: null, loading: false, accountRefusal: null, refreshUser: async () => {} }));
  assert.equal(anonymous.type.name, "GuestChatJoinForm");
  const member = chatJoin(() => ({ user: { nickname: "Member_01" }, loading: false, accountRefusal: null, refreshUser: async () => {} }));
  assert.equal(member.type.name, "AuthenticatedChatCard");
  for (const refusal of [accountRefusalFrom(403, temporaryBan), accountRefusalFrom(503, unavailable)]) {
    const refused = chatJoin(() => ({ user: null, loading: false, accountRefusal: refusal, refreshUser: async () => {} }));
    assert.equal(elements(refused, (el) => el.type?.name === "GuestChatJoinForm").length, 0);
    const [panel] = elements(refused, (el) => el.type?.name === "AccountRestrictionPanel");
    assert.equal(panel.props.refusal, refusal);
  }
});

test("member sources keep the refusal in memory only, behind the shared helper", () => {
  for (const file of ["lib/auth/account-restriction.ts", "lib/auth/member-fetch.ts", "components/auth/AuthProvider.tsx", "components/auth/AccountRestrictionPanel.tsx", "components/auth/AccountRestrictionNotice.tsx"]) {
    const code = readFileSync(resolve(root, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(code, /localStorage|sessionStorage|document\.cookie|console\./, file);
  }
  // No component checks the codes itself.
  for (const file of ["components/auth/LoginForm.tsx", "components/chat/AuthenticatedChatCard.tsx", "components/chat/ChatJoinForm.tsx", "components/auth/AuthProvider.tsx"]) {
    assert.doesNotMatch(readFileSync(resolve(root, file), "utf8"), /"ACCOUNT_(SUSPENDED|BANNED|RESTRICTION_UNAVAILABLE)"/, file);
  }
});
