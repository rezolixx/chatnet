import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import { elements } from "./helpers/password-form.mjs";
import { projectChatProfile } from "../src/lib/auth/chat-profile.ts";
import { CHAT_HANDOFF_REDEEM_URL, ChatEntryFailure, allowsLegacyChatFallback, chatEntryMessages, chatEntryRefusal, isChatHandoffCode } from "../src/lib/chat-handoff.ts";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../src/", import.meta.url));
const code = `dch1_${"Ab9-_".repeat(8)}xyz`;
const secret = "PRIVATE-upstream-detail";
const user = { nickname: "Member_01", avatar: null, pays: "France", description: null, inscritDepuis: "01/01/2020" };
const member = { id: 7, nickname: "Member_01", avatar: null, pays: "France", birthdate: "1990-05-17", gender: "Femme", email: "private@example.com" };
const age = projectChatProfile(member, member.nickname).age;
const cookie = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
const csrf = () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
};
const path = (call) => new URL(call.url).pathname;

function request({ input = { room: "radio" }, origin = "https://chatnet.fr", cookies = cookie, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  if (cookies) headers.Cookie = cookies;
  return new NextRequest("https://chatnet.fr/api/auth/chat/handoff", { method: "POST", headers, body: body ?? JSON.stringify(input) });
}

function bff(responses) {
  const calls = [];
  const loaded = loadAuthRoute("chat/handoff", async (url, init) => {
    calls.push({ url, ...init });
    assert.ok(responses.length, `Unexpected network call: ${url}`);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  });
  return { ...loaded, calls, remaining: responses };
}

async function safePayload(response) {
  const text = await response.text();
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  for (const leaked of [secret, "session-one", "session-two", "session-three", "xsrf=", "laravel_session", "XSRF-TOKEN", "dct1_", "password"]) assert.ok(!text.includes(leaked), `leaked ${leaked}`);
  return JSON.parse(text);
}

const upto = (handoff) => [json(user), json(member), csrf(), handoff];

test("shared V2 rules: exact dch1 code shape and fallback statuses", () => {
  assert.equal(CHAT_HANDOFF_REDEEM_URL, "https://laravel.discut.org/api/chat/identity/handoff/redeem");
  assert.ok(isChatHandoffCode(code));
  for (const value of [`${code}x`, code.slice(0, -1), `dct1_${code.slice(5)}`, `dch1_${"a".repeat(42)}=`, ` ${code}`, `dch1_${"é".repeat(43)}`, null, 42]) assert.equal(isChatHandoffCode(value), false);
  // T21: only "not bound yet" (409 CHAT_ACCOUNT_UNAVAILABLE) and "V2 off" (404).
  const statuses = [400, 401, 403, 404, 405, 409, 419, 422, 429, 500, 502, 503, 599, 200];
  assert.deepEqual(statuses.filter((status) => allowsLegacyChatFallback(status)), [404]);
  assert.deepEqual(statuses.filter((status) => allowsLegacyChatFallback(status, "CHAT_ACCOUNT_UNAVAILABLE")), [404, 409]);
  for (const other of ["CHAT_HANDOFF_REFUSED", "CHAT_DESTINATION_REFUSED", "RATE_LIMITED", "UNAVAILABLE", "PROFILE_INCOMPLETE"]) {
    assert.equal(allowsLegacyChatFallback(409, other), false, other);
  }
});

test("refusal reasons: fixed codes map to specific French messages, everything else is retryable", () => {
  for (const [status, code, expected] of [
    [403, "CHAT_HANDOFF_REFUSED", "ACCOUNT_UNAVAILABLE"],
    [403, "ACCOUNT_UNAVAILABLE", "ACCOUNT_UNAVAILABLE"],
    [403, "UNTRUSTED_ORIGIN", "CHAT_UNAVAILABLE"],
    [409, "CHAT_IDENTITY_V2_REQUIRED", "CHAT_IDENTITY_V2_REQUIRED"],
    [409, "CHAT_ACCOUNT_UNAVAILABLE", "CHAT_IDENTITY_V2_REQUIRED"],
    [422, "PROFILE_INCOMPLETE", "PROFILE_INCOMPLETE"],
    [422, "CHAT_DESTINATION_REFUSED", "INVALID_DESTINATION"],
    [400, "INVALID_ROOM", "INVALID_ROOM"],
    [400, "INVALID_INPUT", "CHAT_UNAVAILABLE"],
    [429, "RATE_LIMITED", "RATE_LIMITED"],
    [500, undefined, "CHAT_UNAVAILABLE"],
    [502, "UNAVAILABLE", "CHAT_UNAVAILABLE"],
    [503, "UNAVAILABLE", "CHAT_UNAVAILABLE"],
  ]) assert.equal(chatEntryRefusal(status, code), expected, `${status} ${code}`);
  for (const [refusal, message] of Object.entries(chatEntryMessages)) {
    const failure = new ChatEntryFailure(refusal);
    assert.equal(failure.message, message);
    assert.equal(failure.refusal, refusal);
    assert.doesNotMatch(message, /sasl|nickserv|handoff|irc|ticket|token|identify|legacy/i, refusal);
  }
});

test("BFF rejects untrusted origins before any network call", async () => {
  for (const origin of [null, "https://evil.example", "https://chatnet.fr.evil.example", "https://discut.org", "http://localhost:3000"]) {
    const h = bff([]);
    const response = await h.POST(request({ origin }));
    assert.equal(response.status, 403);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
});

test("BFF requires bridge cookies and a valid Laravel session, clearing stale bridges", async () => {
  for (const cookies of ["", "chatnet_upstream_session=fake"]) {
    const h = bff([]);
    const response = await h.POST(request({ cookies }));
    assert.equal(response.status, 401);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  for (const responses of [[json({ message: secret }, 401)], [json({ message: secret }, 419)], [json(user), json({ message: secret }, 401)], ...[401, 419].map((status) => upto(json({ message: secret }, status)))]) {
    const h = bff(responses);
    const response = await h.POST(request());
    assert.equal(response.status, 401);
    assert.deepEqual(await safePayload(response), { code: "AUTH_REQUIRED" });
    assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_session=;.*Max-Age=0/);
    assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_xsrf=;.*Max-Age=0/);
    assert.equal(h.remaining.length, 0);
  }
  for (const me of [json({ message: secret }, 500), json({ nickname: "" })]) {
    const h = bff([me]);
    assert.equal((await h.POST(request())).status, 503);
    assert.equal(h.calls.length, 1);
  }
});

test("BFF accepts only an optional room: profile fields and invalid rooms never reach Laravel", async () => {
  for (const input of [null, [], "radio", { room: "radio", age: 99 }, { room: "radio", sexe: "M" }, { room: "radio", ville: "Ailleurs" }, { gender: "Homme" }, { pays: "Ailleurs" }, { nickname: "Other" }, { room: "radio", handoff: code }]) {
    const h = bff([]);
    const response = await h.POST(request({ input }));
    assert.equal(response.status, 400);
    assert.deepEqual(await safePayload(response), { code: "INVALID_INPUT" });
    assert.equal(h.calls.length, 0);
  }
  for (const body of ["{", "", `{"room":"${"a".repeat(1100)}"}`]) {
    const h = bff([]);
    assert.equal((await h.POST(request({ body }))).status, 400);
    assert.equal(h.calls.length, 0);
  }
  for (const room of ["", "#", "##radio", "a b", "a,b", "a/b", "..", "café", "a\nJOIN #x", "a\u0000b", 12, null, ["radio"]]) {
    const h = bff([]);
    const response = await h.POST(request({ input: { room } }));
    assert.equal(response.status, 400);
    assert.deepEqual(await safePayload(response), { code: "INVALID_ROOM" });
    assert.equal(h.calls.length, 0);
  }
});

test("BFF derives the profile server-side and sends the exact Laravel handoff request", async () => {
  const h = bff(upto(json({ handoff: code, expires_in: 60, ticket: "dct1_secret", session: secret, password: secret })));
  const response = await h.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await safePayload(response), { handoff: code, expires_in: 60 });
  assert.deepEqual(h.calls.map(path), ["/api/me", "/api/members/Member_01", "/sanctum/csrf-cookie", "/api/chat/identity/handoff"]);
  assert.ok(h.calls.every((call) => new URL(call.url).origin === "https://laravel.discut.org"));
  assert.match(h.calls[0].headers.get("Cookie"), /laravel_session=session-one$/);
  assert.equal(h.calls[1].headers.get("Cookie"), h.calls[0].headers.get("Cookie"));
  const handoff = h.calls[3];
  assert.equal(handoff.method, "POST");
  assert.equal(handoff.body, JSON.stringify({ age, sexe: "F", ville: "France", room: "radio" }));
  assert.equal(handoff.headers.get("Cookie"), "XSRF-TOKEN=xsrf%3Dtwo; laravel_session=session-two");
  assert.equal(handoff.headers.get("X-XSRF-TOKEN"), "xsrf=two");
  assert.equal(handoff.headers.get("Content-Type"), "application/json");
  assert.equal(handoff.headers.get("Origin"), "https://chatnet.fr");
  assert.equal(handoff.headers.get("Accept"), "application/json");
  assert.equal(handoff.headers.get("X-Requested-With"), "XMLHttpRequest");
  assert.equal(handoff.cache, "no-store");
  assert.equal(handoff.redirect, "error");
});

test("BFF maps Homme/Femme to M/F, defaults to Accueil and normalizes the selected room", async () => {
  for (const [gender, input, sexe, room] of [["Homme", {}, "M", "Accueil"], ["Femme", { room: "#Radio" }, "F", "Radio"], ["masculin", { room: "Accueil" }, "M", "Accueil"], ["female", { room: "a[b]" }, "F", "a[b]"]]) {
    const h = bff([json(user), json({ ...member, gender }), csrf(), json({ handoff: code })]);
    const response = await h.POST(request({ input }));
    assert.equal(response.status, 200);
    assert.deepEqual(await safePayload(response), { handoff: code });
    assert.deepEqual(JSON.parse(h.calls[3].body), { age, sexe, ville: "France", room });
  }
});

test("BFF refuses incomplete or foreign server profiles before requesting a handoff", async () => {
  // Gender or country unusable: PROFILE_INCOMPLETE (to complete, never a fallback).
  for (const profile of [{ ...member, gender: "unknown" }, { ...member, gender: undefined }, { ...member, pays: "" }, { ...member, pays: "x".repeat(121) }]) {
    const h = bff([json(user), json(profile)]);
    const response = await h.POST(request());
    assert.equal(response.status, 422);
    assert.deepEqual(await safePayload(response), { code: "PROFILE_INCOMPLETE" });
    assert.equal(h.calls.length, 2);
  }
  for (const profile of [{ ...member, nickname: "Other" }, { ...member, birthdate: undefined }, { nickname: "Other", birthdate: "1900-01-01" }, { nickname: "Other", gender: "unknown" }]) {
    const h = bff([json(user), json(profile)]);
    const response = await h.POST(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await safePayload(response), { code: "UNAVAILABLE" });
    assert.equal(h.calls.length, 2);
  }
  const h = bff([json(user), json({ message: secret }, 404)]);
  assert.equal((await h.POST(request())).status, 503);
  const failedCsrf = bff([json(user), json(member), new Response(null, { status: 500 })]);
  assert.equal((await failedCsrf.POST(request())).status, 503);
  assert.equal(failedCsrf.calls.length, 3);
});

// ---- Age policy (16-120 from the profile birthdate): no handoff, no fallback ----

// The routes use today's date: under 16 is computed, the others stay refused.
const refusedBirthdates = [`${new Date().getUTCFullYear() - 10}-01-01`, "1900-01-01", "1905-10-07", "2999-01-01", "2023-02-29", "0000-00-00"];

test("BFF answers PROFILE_BIRTHDATE_INVALID for a birthdate outside the policy, before any handoff", async () => {
  assert.equal(allowsLegacyChatFallback(422, "PROFILE_BIRTHDATE_INVALID"), false);
  for (const status of [403, 404, 409, 422, 429, 503]) assert.equal(allowsLegacyChatFallback(status, "PROFILE_BIRTHDATE_INVALID"), false);
  for (const birthdate of refusedBirthdates) {
    const h = bff([json(user), json({ ...member, birthdate })]);
    const response = await h.POST(request());
    assert.equal(response.status, 422, birthdate);
    assert.deepEqual(await safePayload(response), { code: "PROFILE_BIRTHDATE_INVALID" });
    assert.deepEqual(h.calls.map(path), ["/api/me", "/api/members/Member_01"]);
  }
});

test("BFF forwards only the code of Laravel's own birthdate refusal; other 422s keep their mapping", async () => {
  const h = bff(upto(json({ authenticated: false, code: "PROFILE_BIRTHDATE_INVALID", message: secret }, 422)));
  const response = await h.POST(request());
  assert.equal(response.status, 422);
  assert.deepEqual(await safePayload(response), { code: "PROFILE_BIRTHDATE_INVALID" });
  for (const body of [{ code: "INVALID_DESTINATION" }, { message: secret }, "not json"]) {
    const other = bff(upto(new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 422 })));
    const refused = await other.POST(request());
    assert.equal(refused.status, 422);
    assert.deepEqual(await safePayload(refused), { code: "CHAT_DESTINATION_REFUSED" });
  }
});

test("chat profile and legacy prepare BFFs answer PROFILE_BIRTHDATE_INVALID too", async () => {
  const loadWith = (name, responses) => {
    const calls = [];
    const route = loadAuthRoute(name, async (url, init) => {
      calls.push({ url, ...init });
      assert.ok(responses.length, `Unexpected network call: ${url}`);
      return responses.shift();
    });
    return { route, calls };
  };
  const profileRequest = () => new NextRequest("https://chatnet.fr/api/auth/chat-profile", { headers: { Cookie: cookie } });
  for (const birthdate of refusedBirthdates) {
    const { route } = loadWith("chat-profile", [json(user), json({ ...member, birthdate })]);
    const response = await route.GET(profileRequest());
    assert.equal(response.status, 422, birthdate);
    assert.deepEqual(await safePayload(response), { code: "PROFILE_BIRTHDATE_INVALID" });
  }
  // A missing birthdate stays an incomplete profile.
  const missing = loadWith("chat-profile", [json(user), json({ ...member, birthdate: undefined })]);
  assert.equal((await missing.route.GET(profileRequest())).status, 503);
  const valid = loadWith("chat-profile", [json(user), json(member)]);
  assert.equal((await valid.route.GET(profileRequest())).status, 200);

  const prepareRequest = () => new NextRequest("https://chatnet.fr/api/auth/chat/prepare", { method: "POST", headers: { Origin: "https://chatnet.fr", Cookie: cookie } });
  const refused = loadWith("chat/prepare", [json(user), csrf(), json({ code: "PROFILE_BIRTHDATE_INVALID", message: secret }, 422)]);
  const response = await refused.route.POST(prepareRequest());
  assert.equal(response.status, 422);
  assert.deepEqual(await safePayload(response), { code: "PROFILE_BIRTHDATE_INVALID" });
  const other = loadWith("chat/prepare", [json(user), csrf(), json({ message: secret }, 422)]);
  assert.equal((await other.route.POST(prepareRequest())).status, 503);
});

test("T21: chat profile BFF answers PROFILE_INCOMPLETE; legacy BFF forwards only Laravel's fixed refusals", async () => {
  const loadWith = (name, responses) => loadAuthRoute(name, async () => responses.shift());
  const profileRequest = () => new NextRequest("https://chatnet.fr/api/auth/chat-profile", { headers: { Cookie: cookie } });
  for (const incomplete of [{ ...member, gender: "Autre" }, { ...member, pays: " " }]) {
    const response = await loadWith("chat-profile", [json(user), json(incomplete)]).GET(profileRequest());
    assert.equal(response.status, 422);
    assert.deepEqual(await safePayload(response), { code: "PROFILE_INCOMPLETE" });
  }
  // A refused birthdate wins over a missing gender: the date is corrected first.
  const both = await loadWith("chat-profile", [json(user), json({ ...member, gender: "Autre", birthdate: "1900-01-01" })]).GET(profileRequest());
  assert.deepEqual(await safePayload(both), { code: "PROFILE_BIRTHDATE_INVALID" });

  const prepareRequest = () => new NextRequest("https://chatnet.fr/api/auth/chat/prepare", { method: "POST", headers: { Origin: "https://chatnet.fr", Cookie: cookie } });
  for (const [status, code] of [[409, "CHAT_IDENTITY_V2_REQUIRED"], [403, "ACCOUNT_UNAVAILABLE"]]) {
    const refused = await loadWith("chat/prepare", [json(user), csrf(), json({ code, message: secret }, status)]).POST(prepareRequest());
    assert.equal(refused.status, status);
    assert.deepEqual(await safePayload(refused), { code });
    // Another body with the same status keeps the generic mapping.
    const other = await loadWith("chat/prepare", [json(user), csrf(), json({ code: secret, message: secret }, status)]).POST(prepareRequest());
    assert.equal(other.status, 503);
    assert.deepEqual(await safePayload(other), { code: "UNAVAILABLE" });
  }
});

test("BFF keeps refreshed upstream cookies in the HttpOnly bridge only", async () => {
  const h = bff(upto(json({ handoff: code, expires_in: 60 }, 200, { "Set-Cookie": "laravel_session=session-three; Path=/; HttpOnly" })));
  const response = await h.POST(request());
  assert.deepEqual(await safePayload(response), { handoff: code, expires_in: 60 });
  const setCookie = response.headers.get("Set-Cookie");
  assert.match(setCookie, /chatnet_upstream_session=session-three/);
  assert.match(setCookie, /chatnet_upstream_xsrf=xsrf%(?:25)?3Dtwo/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=lax/);
  assert.doesNotMatch(setCookie, /(?:^|, )laravel_session=|(?:^|, )XSRF-TOKEN=|Max-Age=0/);
  const refusal = bff(upto(json({ message: secret }, 409, { "Set-Cookie": "laravel_session=session-three; Path=/" })));
  const refused = await refusal.POST(request());
  assert.equal(refused.status, 409);
  assert.match(refused.headers.get("Set-Cookie"), /chatnet_upstream_session=session-three/);
});

test("BFF keeps Laravel's refusals as fixed codes and maps failures to 503", async () => {
  for (const [status, expected] of [[403, "CHAT_HANDOFF_REFUSED"], [404, "CHAT_HANDOFF_UNAVAILABLE"], [409, "CHAT_ACCOUNT_UNAVAILABLE"], [422, "CHAT_DESTINATION_REFUSED"], [429, "RATE_LIMITED"]]) {
    const h = bff(upto(json({ code: secret, message: secret, errors: { ville: [secret] } }, status)));
    const response = await h.POST(request());
    assert.equal(response.status, status);
    assert.deepEqual(await safePayload(response), { code: expected });
  }
  for (const upstream of [json({ message: secret }, 500), json({ message: secret }, 502), json({ message: secret }, 503), json({ message: secret }, 400), json({ handoff: code }, 201), new Error(secret)]) {
    const h = bff(upto(upstream));
    const response = await h.POST(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await safePayload(response), { code: "UNAVAILABLE" });
    assert.equal(h.calls.filter((call) => path(call) === "/api/chat/identity/handoff").length, 1);
  }
});

test("BFF refuses a malformed Laravel success instead of manufacturing a handoff", async () => {
  const bodies = [{}, [], "text", { handoff: "dch1_short" }, { handoff: `${code}x` }, { handoff: `dct1_${code.slice(5)}` }, { handoff: code, expires_in: 0 }, { handoff: code, expires_in: -1 }, { handoff: code, expires_in: 121 }, { handoff: code, expires_in: "60" }, { handoff: code, expires_in: null }];
  for (const body of bodies) {
    const h = bff(upto(json(body)));
    const response = await h.POST(request());
    assert.equal(response.status, 502);
    const text = await response.clone().text();
    assert.ok(!text.includes("dch1_") && !text.includes("dct1_"));
    assert.deepEqual(await safePayload(response), { code: "UNAVAILABLE" });
  }
  const h = bff(upto(new Response("{not json", { status: 200 })));
  assert.equal((await h.POST(request())).status, 502);
  assert.doesNotMatch(readFileSync(resolve(root, "app/api/auth/chat/handoff/route.ts"), "utf8"), /console\.|localStorage|sessionStorage/);
});

// Execute the real member card with persistent hook slots; only React's
// scheduler, the auth context and browser IO are substituted.
function memberCard(options = {}) {
  const { handoff, prepare, popup = true, profileResponse } = options;
  const selectedRoom = "selectedRoom" in options ? options.selectedRoom : "radio";
  const slots = [], effects = [], records = new Map(), events = [], calls = [], forms = [], tabs = [], timers = [], refreshes = [];
  let index = 0;
  const profile = { nickname: "Member", avatar: null, age: 25, gender: "Femme", pays: "France" };
  const hooks = { ...React,
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (v) => { slots[slot] = typeof v === "function" ? v(slots[slot]) : v; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useEffect(fn) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(fn); } },
  };
  const responders = { "/api/auth/chat-profile": [profileResponse ?? (() => json({ profile }))], "/api/auth/chat/handoff": [handoff].flat(), "/api/auth/chat/prepare": [prepare].flat() };
  const fetch = async (url, init) => {
    events.push(`fetch:${url}`);
    calls.push({ url, init });
    const next = responders[url]?.shift();
    assert.ok(next, `Unexpected fetch: ${url}`);
    return next(init);
  };
  const storage = new Proxy({}, { get(_, key) { events.push(`storage:${String(key)}`); return () => null; } });
  const window = {
    open(url, name) {
      events.push("open");
      if (!popup) return null;
      const tab = { url, name, opener: "chatnet", closed: false, closes: 0, navigations: [], close() { this.closed = true; this.closes++; } };
      tab.location = { set href(value) { tab.navigations.push(value); } };
      tabs.push(tab);
      return tab;
    },
    setTimeout(fn, ms) { timers.push({ fn, ms, cleared: false }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
    localStorage: storage,
    sessionStorage: storage,
  };
  const document = {
    createElement(tag) {
      return { tag, children: [], appendChild(child) { this.children.push(child); }, submit() {
        events.push("form:submit");
        forms.push({ attached: this.attached === true, method: this.method, action: this.action, target: this.target, hidden: this.hidden, inputs: this.children.map(({ type, name, value }) => ({ type, name, value })) });
      }, remove() { this.attached = false; events.push("form:remove"); } };
    },
    body: { appendChild(el) { el.attached = true; events.push("form:append"); } },
    get cookie() { events.push("cookie"); return ""; },
    set cookie(value) { events.push("cookie"); },
  };
  const console = new Proxy({}, { get(_, key) { return () => events.push(`console:${String(key)}`); } });
  const context = vm.createContext({ fetch, window, document, URL, AbortController, console, localStorage: storage, sessionStorage: storage });
  function load(relative) {
    let file = resolve(root, relative);
    if (!/\.tsx?$/.test(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (records.has(file)) return records.get(file).exports;
    const record = { exports: {} }; records.set(file, record);
    const localRequire = (s) => {
      if (s === "react") return hooks;
      if (s === "@/components/auth/AuthProvider") return { useAuth: () => ({ user: { nickname: "Member" }, loading: false, refreshUser: async (v) => { refreshes.push(v); } }) };
      if (s === "@/components/community/MemberAvatar") return { MemberAvatar: () => null };
      if (s.startsWith("@/")) return load(s.slice(2));
      if (s.startsWith(".")) return load(resolve(dirname(file), s));
      return require(s);
    };
    const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInContext(`(function(require,module,exports){${output}\n})`, context)(localRequire, record, record.exports);
    return record.exports;
  }
  const card = load("components/chat/AuthenticatedChatCard.tsx");
  const props = selectedRoom === undefined ? { nickname: "Member" } : { nickname: "Member", selectedRoom };
  const render = () => { index = 0; return card.AuthenticatedChatCard(props); };
  const button = () => elements(render(), (el) => el.type === "button")[0];
  const alert = () => elements(render(), (el) => el.props?.role === "alert")[0]?.props.children;
  let cleanups = [];
  return {
    events, calls, forms, tabs, timers, refreshes, button, alert,
    async mount() { render(); cleanups = effects.map((fn) => fn()); await new Promise((r) => setImmediate(r)); },
    unmount() { cleanups.forEach((fn) => fn?.()); },
    click() { return button().props.onClick(); },
    urls: () => calls.map((c) => c.url).filter((url) => url !== "/api/auth/chat-profile"),
  };
}

const respond = (body, status = 200) => () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const legacy = respond({ nickname: "Member", token: "legacy-token", ticket: "legacy-ticket" });
const hang = (init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
const quiet = (events) => events.filter((e) => /^(storage|cookie|console)/.test(e));

test("member V2 entry opens one named tab synchronously and POSTs the code into it", async () => {
  const h = memberCard({ handoff: respond({ handoff: code, expires_in: 60 }) });
  await h.mount();
  const pending = h.click();
  assert.equal(h.tabs.length, 1);
  assert.deepEqual(h.events, ["fetch:/api/auth/chat-profile", "open", "fetch:/api/auth/chat/handoff"]);
  assert.equal(h.button().props.disabled, true);
  await pending;
  const [tab] = h.tabs;
  assert.equal(tab.url, "about:blank");
  assert.match(tab.name, /^chatnet-chat-[a-z0-9]+-[a-z0-9]+$/);
  assert.notEqual(tab.name, "_blank");
  assert.equal(tab.opener, null);
  const call = h.calls[1];
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.credentials, "same-origin");
  assert.equal(call.init.cache, "no-store");
  assert.equal(call.init.headers["Content-Type"], "application/json");
  assert.equal(call.init.body, JSON.stringify({ room: "radio" }));
  assert.deepEqual(h.forms, [{ attached: true, method: "POST", action: CHAT_HANDOFF_REDEEM_URL, target: tab.name, hidden: true, inputs: [{ type: "hidden", name: "code", value: code }] }]);
  assert.deepEqual(h.events.slice(-3), ["form:append", "form:submit", "form:remove"]);
  assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
  assert.deepEqual(tab.navigations, []);
  assert.ok([tab.url, ...h.calls.map((c) => c.url)].every((url) => !url.includes(code)));
  assert.deepEqual(quiet(h.events), []);
  assert.equal(tab.closes, 0);
  assert.equal(h.button().props.disabled, false);
  assert.equal(h.alert(), undefined);
  h.unmount();
  assert.equal(tab.closes, 0);
});

test("duplicate clicks while pending create one tab, one handoff request and one form", async () => {
  const h = memberCard({ handoff: respond({ handoff: code }) });
  await h.mount();
  await Promise.all([h.click(), h.click(), h.click()]);
  assert.equal(h.tabs.length, 1);
  assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
  assert.equal(h.forms.length, 1);
  assert.equal(h.events.filter((e) => e === "open").length, 1);
});

test("an account V2 cannot serve yet (409) or V2 off (404) reuses the same tab for the legacy URL and room", async () => {
  for (const handoff of [respond({ code: "CHAT_ACCOUNT_UNAVAILABLE" }, 409), respond({ code: "CHAT_HANDOFF_UNAVAILABLE" }, 404), respond("<html>", 404)]) {
    const h = memberCard({ handoff, prepare: legacy });
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), ["/api/auth/chat/handoff", "/api/auth/chat/prepare"]);
    assert.equal(h.calls[2].init.method, "POST");
    assert.equal(h.calls[2].init.body, undefined);
    assert.equal(h.tabs.length, 1);
    const [tab] = h.tabs;
    assert.equal(tab.navigations.length, 1);
    const url = new URL(tab.navigations[0]);
    assert.equal(url.origin + url.pathname, "https://chat.discut.org/chat");
    assert.equal(url.searchParams.get("token"), "legacy-token");
    assert.equal(url.searchParams.get("ticket"), "legacy-ticket");
    assert.equal(url.hash, `#${JSON.parse(h.calls[1].init.body).room}`);
    assert.equal(url.hash, "#radio");
    assert.equal(h.forms.length, 0);
    assert.equal(tab.closes, 0);
    assert.equal(h.alert(), undefined);
  }
});

// T21: every other V2 refusal or failure is shown, never downgraded.
test("other V2 refusals and failures close the tab with a specific message, never the legacy flow", async () => {
  for (const [handoff, message] of [
    [respond({ code: "CHAT_HANDOFF_REFUSED" }, 403), chatEntryMessages.ACCOUNT_UNAVAILABLE],
    [respond({ code: "UNTRUSTED_ORIGIN" }, 403), chatEntryMessages.CHAT_UNAVAILABLE],
    [respond({ code: "X" }, 409), chatEntryMessages.CHAT_IDENTITY_V2_REQUIRED],
    [respond({ code: "PROFILE_INCOMPLETE" }, 422), chatEntryMessages.PROFILE_INCOMPLETE],
    [respond({ code: "CHAT_DESTINATION_REFUSED" }, 422), chatEntryMessages.INVALID_DESTINATION],
    [respond({ code: "INVALID_ROOM" }, 400), chatEntryMessages.INVALID_ROOM],
    [respond({ code: "RATE_LIMITED" }, 429), chatEntryMessages.RATE_LIMITED],
    ...[500, 502, 503].map((status) => [respond({ code: "UNAVAILABLE" }, status), chatEntryMessages.CHAT_UNAVAILABLE]),
    [() => Promise.reject(new TypeError("Failed to fetch")), chatEntryMessages.CHAT_UNAVAILABLE],
  ]) {
    const h = memberCard({ handoff, prepare: legacy });
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
    assert.equal(h.tabs[0].closes, 1);
    assert.deepEqual(h.tabs[0].navigations, []);
    assert.equal(h.forms.length, 0);
    assert.equal(h.alert(), message);
    assert.equal(h.button().props.disabled, false);
  }
});

test("a V2 timeout is a retryable error, no fallback; the next click gets the handoff in a new tab", async () => {
  const h = memberCard({ handoff: [hang, respond({ handoff: code })], prepare: legacy, selectedRoom: undefined });
  await h.mount();
  const pending = h.click();
  const timer = h.timers.find((t) => t.ms === 20000 && !t.cleared);
  assert.ok(timer);
  timer.fn();
  await pending;
  assert.equal(h.calls[1].init.body, JSON.stringify({ room: "Accueil" }));
  assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
  assert.equal(h.tabs[0].closes, 1);
  assert.deepEqual(h.tabs[0].navigations, []);
  assert.equal(h.alert(), chatEntryMessages.CHAT_UNAVAILABLE);
  assert.ok(h.timers.every((t) => t.cleared));

  await h.click();
  assert.deepEqual(h.urls(), ["/api/auth/chat/handoff", "/api/auth/chat/handoff"]);
  assert.equal(h.tabs.length, 2);
  assert.equal(h.forms.length, 1);
  assert.equal(h.forms[0].target, h.tabs[1].name);
  assert.equal(h.tabs[1].closes, 0);
  assert.equal(h.alert(), undefined);
});

test("Laravel's legacy refusal after a 409 closes the tab with its message", async () => {
  for (const [prepare, message] of [
    [respond({ code: "CHAT_IDENTITY_V2_REQUIRED" }, 409), chatEntryMessages.CHAT_IDENTITY_V2_REQUIRED],
    [respond({ code: "ACCOUNT_UNAVAILABLE" }, 403), chatEntryMessages.ACCOUNT_UNAVAILABLE],
    [respond({ code: "UNAVAILABLE" }, 503), chatEntryMessages.CHAT_UNAVAILABLE],
    [() => Promise.reject(new TypeError("Failed to fetch")), chatEntryMessages.CHAT_UNAVAILABLE],
  ]) {
    const h = memberCard({ handoff: respond({ code: "CHAT_ACCOUNT_UNAVAILABLE" }, 409), prepare });
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), ["/api/auth/chat/handoff", "/api/auth/chat/prepare"]);
    assert.equal(h.tabs[0].closes, 1);
    assert.deepEqual(h.tabs[0].navigations, []);
    assert.equal(h.alert(), message);
  }
});

test("a profile without usable gender or country shows what to complete, with no join button and no request", async () => {
  const h = memberCard({ profileResponse: respond({ code: "PROFILE_INCOMPLETE" }, 422) });
  await h.mount();
  assert.equal(h.alert(), chatEntryMessages.PROFILE_INCOMPLETE);
  assert.equal(h.button(), undefined);
  assert.deepEqual(h.urls(), []);
  assert.equal(h.tabs.length, 0);
});

test("a selected room Chatnet cannot open is refused before any tab or request", async () => {
  const h = memberCard({ selectedRoom: "a b" });
  await h.mount();
  await h.click();
  assert.equal(h.alert(), chatEntryMessages.INVALID_ROOM);
  assert.deepEqual(h.urls(), []);
  assert.equal(h.tabs.length, 0);
});

test("V2 401/419 closes the tab and refreshes the user without any fallback", async () => {
  for (const status of [401, 419]) {
    const h = memberCard({ handoff: respond({ code: "AUTH_REQUIRED" }, status) });
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
    assert.equal(h.tabs[0].closes, 1);
    assert.deepEqual(h.refreshes, [true]);
    assert.equal(h.forms.length, 0);
    assert.deepEqual(h.tabs[0].navigations, []);
  }
});

test("malformed V2 success and other 4xx never fall back silently; the unused tab is closed", async () => {
  const cases = [{}, [], { handoff: "dch1_short" }, { handoff: `${code}x` }, { handoff: "javascript:alert(1)" }, { nickname: "Member", token: "legacy-token" }].map((body) => respond(body));
  cases.push(respond("not json"), () => new Response(null, { status: 204 }), respond({ handoff: code }, 400), respond({ handoff: code }, 405), respond({}, 413));
  for (const handoff of cases) {
    const h = memberCard({ handoff });
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
    assert.equal(h.forms.length, 0);
    assert.equal(h.tabs[0].closes, 1);
    assert.deepEqual(h.tabs[0].navigations, []);
    assert.match(h.alert(), /Impossible de se connecter au chat/);
    assert.equal(h.button().props.disabled, false);
  }
});

test("unmount while pending closes the unused tab and sends neither a form nor a fallback", async () => {
  const h = memberCard({ handoff: hang });
  await h.mount();
  const pending = h.click();
  h.unmount();
  await pending;
  assert.equal(h.tabs[0].closed, true);
  assert.deepEqual(h.urls(), ["/api/auth/chat/handoff"]);
  assert.equal(h.forms.length, 0);
  assert.deepEqual(h.tabs[0].navigations, []);
});

test("blocked popups make no request; legacy 401 after a fallback still refreshes the user", async () => {
  const blocked = memberCard({ popup: false });
  await blocked.mount();
  await blocked.click();
  assert.deepEqual(blocked.urls(), []);
  assert.match(blocked.alert(), /bloqué/);
  const expired = memberCard({ handoff: respond({}, 404), prepare: respond({}, 401) });
  await expired.mount();
  await expired.click();
  assert.deepEqual(expired.urls(), ["/api/auth/chat/handoff", "/api/auth/chat/prepare"]);
  assert.equal(expired.tabs[0].closes, 1);
  assert.deepEqual(expired.refreshes, [true]);
});

// ---- Member card and the age policy -------------------------------------------

const birthdateRefusal = respond({ code: "PROFILE_BIRTHDATE_INVALID" }, 422);

function assertBirthdateNotice(h) {
  const [text, , link] = h.alert();
  assert.match(text, /^Votre date de naissance indique un âge hors des limites autorisées \(16 à 120 ans\)\. Corrigez-la dans votre profil pour accéder au chat\.$/);
  assert.equal(link.props.href, "/profil");
  assert.equal(link.props.children, "Corriger ma date de naissance");
  assert.equal(h.button(), undefined);
}

test("a profile refused for its birthdate shows how to correct it, with no join button and no request", async () => {
  const h = memberCard({ profileResponse: birthdateRefusal });
  await h.mount();
  assertBirthdateNotice(h);
  assert.deepEqual(h.urls(), []);
  assert.equal(h.tabs.length, 0);
});

test("a birthdate refusal from the handoff or the legacy flow closes the tab and never falls back", async () => {
  for (const options of [{ handoff: birthdateRefusal }, { handoff: respond({ code: "CHAT_ACCOUNT_UNAVAILABLE" }, 409), prepare: birthdateRefusal }]) {
    const h = memberCard(options);
    await h.mount();
    await h.click();
    assert.deepEqual(h.urls(), options.prepare ? ["/api/auth/chat/handoff", "/api/auth/chat/prepare"] : ["/api/auth/chat/handoff"]);
    assert.equal(h.tabs[0].closes, 1);
    assert.deepEqual(h.tabs[0].navigations, []);
    assert.equal(h.forms.length, 0);
    assertBirthdateNotice(h);
  }
});

test("member card source keeps the code out of URLs, storage, cookies and logs", () => {
  const source = readFileSync(resolve(root, "components/chat/AuthenticatedChatCard.tsx"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\.|"_blank"/);
  assert.deepEqual(source.match(/location\.href = \w+/g), ["location.href = buildAuthenticatedChatUrl"]);
  assert.doesNotMatch(source, /searchParams|useState\([^)]*handoff/i);
});
