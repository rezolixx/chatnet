import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import { contactIdentity, contactUnavailableMessage, contactValidationMessages, safeContactErrors, validateContactInput } from "../src/lib/support/contact.ts";

const identity = { nickname: "Member_01", email: "member@example.com" };
const input = { subject: "Besoin d’aide", message: "Je souhaite contacter l’équipe." };
const cookie = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const privateValue = "UPSTREAM_PRIVATE_SECRET";
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
const csrf = () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
};

function request({ fields = input, origin = "https://chatnet.fr", cookies = cookie, body, extraHeaders = {} } = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (origin) headers.Origin = origin;
  if (cookies) headers.Cookie = cookies;
  return new NextRequest("https://chatnet.fr/api/auth/assistance", { method: "POST", headers, body: body ?? JSON.stringify(fields) });
}

function harness(responses) {
  const calls = [];
  const route = loadAuthRoute("assistance", async (url, init) => {
    calls.push({ url, ...init });
    assert.ok(responses.length, `Unexpected network call: ${url}`);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  });
  return { ...route, calls };
}

async function safePayload(response) {
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.text();
  for (const secret of [privateValue, identity.email, identity.nickname, "session-one", "session-two", "session-three", "xsrf=", "laravel_session", "XSRF-TOKEN"]) assert.ok(!body.includes(secret));
  assert.doesNotMatch(body, /"(?:id|is_read|created_at|updated_at|token|password|cookies|credentials)"/);
  // Only the established first-party HttpOnly bridge cookies may be issued.
  assert.doesNotMatch(response.headers.get("Set-Cookie") ?? "", /(?:^|,\s*)laravel_session=|(?:^|,\s*)XSRF-TOKEN=/);
  return JSON.parse(body);
}

test("guest, incomplete cookies and forged/expired sessions are rejected before submission", async () => {
  for (const cookies of ["", "chatnet_upstream_session=fake"]) {
    const h = harness([]);
    const response = await h.POST(request({ cookies }));
    assert.equal(response.status, 401);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  for (const status of [401, 419]) {
    const h = harness([json({ token: privateValue }, status)]);
    const response = await h.POST(request());
    assert.equal(response.status, 401);
    assert.equal(h.calls.length, 1);
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
    await safePayload(response);
  }
});

test("missing and untrusted origins are rejected without network calls", async () => {
  for (const origin of [null, "https://evil.example", "https://chatnet.fr.evil.example", "http://chatnet.fr", "http://localhost:3000"]) {
    const h = harness([]);
    const response = await h.POST(request({ origin }));
    assert.equal(response.status, 403);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
});

test("browser name, email and arbitrary fields are rejected instead of overriding identity", async () => {
  for (const field of ["name", "email", "nickname", "id", "status", "priority", "attachments", "reply", "role", "__proto__"]) {
    const h = harness([]);
    const fields = JSON.parse(JSON.stringify(input).slice(0, -1) + `,${JSON.stringify(field)}:"override"}`);
    const response = await h.POST(request({ fields }));
    assert.equal(response.status, 400);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  for (const fields of [null, [], {}, { name: identity.nickname, email: identity.email }, { message: input.message }]) {
    const h = harness([]);
    assert.equal((await h.POST(request({ fields }))).status, 400);
    assert.equal(h.calls.length, 0);
  }
});

test("bounded JSON and Laravel field limits reject malformed, excessive or invalid input", async () => {
  for (const body of ["{", "x".repeat(32769)]) {
    const h = harness([]);
    assert.equal((await h.POST(request({ body }))).status, 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness([]);
  assert.equal((await h.POST(request({ extraHeaders: { "Content-Length": "32769" } }))).status, 400);
  for (const fields of [{ subject: 12, message: "test" }, { subject: "x".repeat(256), message: "test" }, { subject: "", message: " " }, { subject: "", message: null }, { subject: "", message: "x".repeat(5001) }]) {
    const h = harness([]);
    const response = await h.POST(request({ fields }));
    assert.equal(response.status, 422);
    assert.ok(Object.keys((await safePayload(response)).errors).length);
    assert.equal(h.calls.length, 0);
  }
  assert.ok(validateContactInput({ subject: "", message: "🙂".repeat(5000) }).input);
});

test("server obtains nickname/email from authenticated me and forwards exactly four fields with refreshed CSRF", async () => {
  for (const origin of ["https://chatnet.fr", "https://www.chatnet.fr"]) {
    const h = harness([json({ ...identity, password: privateValue, token: privateValue }, 200, { "Set-Cookie": "laravel_session=me-rotated; Path=/" }), csrf(), json({ id: 123, is_read: false, token: privateValue, credentials: privateValue }, 201, { "Set-Cookie": "laravel_session=session-three; Path=/" })]);
    const response = await h.POST(request({ origin, extraHeaders: { "X-Chatnet-Profile-Nickname": "Forged", Authorization: "Bearer forged" } }));
    assert.equal(response.status, 201);
    assert.deepEqual(await safePayload(response), { sent: true });
    assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), ["/api/me", "/sanctum/csrf-cookie", "/api/contact-messages"]);
    assert.equal(h.calls[0].headers.get("Cookie"), "XSRF-TOKEN=xsrf=one; laravel_session=session-one");
    assert.match(h.calls[1].headers.get("Cookie"), /laravel_session=me-rotated/);
    const post = h.calls[2];
    assert.equal(post.method, "POST");
    assert.deepEqual(JSON.parse(post.body), { name: identity.nickname, email: identity.email, ...input });
    assert.deepEqual(Object.keys(JSON.parse(post.body)), ["name", "email", "subject", "message"]);
    assert.equal(post.headers.get("Cookie"), "XSRF-TOKEN=xsrf%3Dtwo; laravel_session=session-two");
    assert.equal(post.headers.get("X-XSRF-TOKEN"), "xsrf=two");
    assert.equal(post.headers.get("Origin"), "https://chatnet.fr");
    assert.equal(post.headers.get("Authorization"), null);
    assert.equal(post.redirect, "error");
    assert.ok(h.calls.every((call) => call.cache === "no-store"));
    const setCookie = response.headers.get("Set-Cookie");
    assert.match(setCookie, /chatnet_upstream_session=session-three/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=lax/);
  }
});

test("missing or unusable authoritative identity stops before the public contact endpoint", async () => {
  for (const me of [null, { nickname: "Member_01" }, { email: identity.email }, { ...identity, email: "invalid" }, { ...identity, nickname: " " }]) {
    const h = harness([json(me)]);
    const response = await h.POST(request());
    assert.equal(response.status, 503);
    assert.equal(h.calls.length, 1);
    await safePayload(response);
  }
  assert.deepEqual(contactIdentity({ ...identity, role: "admin" }), { name: identity.nickname, email: identity.email });
});

test("201 acknowledgement never reads an upstream model or requires an invented identifier", async () => {
  const h = harness([json(identity), csrf(), new Response("not JSON", { status: 201 })]);
  const response = await h.POST(request());
  assert.equal(response.status, 201);
  assert.deepEqual(await safePayload(response), { sent: true });
});

test("Laravel 422 projects only safe local subject/message errors without identity or upstream strings", async () => {
  const h = harness([json(identity), csrf(), json({ message: privateValue, errors: { subject: [privateValue], message: [privateValue], name: [identity.nickname], email: [identity.email], token: [privateValue] }, id: 123 }, 422)]);
  const response = await h.POST(request());
  assert.equal(response.status, 422);
  assert.deepEqual((await safePayload(response)).errors, contactValidationMessages);
  assert.deepEqual(safeContactErrors({ errors: { name: [privateValue], email: [privateValue] } }), {});
  for (const raw of [null, [], { errors: [] }, { errors: { email: [privateValue] } }]) {
    const h = harness([json(identity), csrf(), json(raw, 422)]);
    assert.equal((await h.POST(request())).status, 422);
  }
});

test("Laravel 500 is a generic error and unexpected success codes cannot confirm submission", async () => {
  for (const [status, expected] of [[500, 500], [502, 503], [200, 503], [202, 503], [302, 503], [429, 429]]) {
    const h = harness([json(identity), csrf(), json({ message: privateValue, model: { id: 123 }, cookie: privateValue }, status)]);
    const response = await h.POST(request());
    assert.equal(response.status, expected);
    const body = await safePayload(response);
    assert.equal(body.sent, undefined);
    if (status !== 429) assert.equal(body.message, contactUnavailableMessage);
    assert.equal(h.calls.length, 3);
  }
});

test("upstream auth failures clear the bridge and network failures never retry or claim success", async () => {
  for (const upstream of [json({}, 401), json({}, 419), new Error(privateValue)]) {
    const h = harness([json(identity), csrf(), upstream]);
    const response = await h.POST(request());
    assert.equal(response.status, upstream instanceof Error ? 503 : 401);
    await safePayload(response);
    assert.equal(h.calls.length, 3);
    if (!(upstream instanceof Error)) assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  }
  for (const failure of [json({}, 500), new Error(privateValue), new Response("invalid JSON")]) {
    const h = harness([failure]);
    const response = await h.POST(request());
    assert.equal(response.status, 503);
    await safePayload(response);
    assert.equal(h.calls.length, 1);
  }
  const h = harness([json(identity), json({}, 500)]);
  assert.equal((await h.POST(request())).status, 503);
  assert.equal(h.calls.length, 2);
});
