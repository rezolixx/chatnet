import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import { safePasswordErrors, validatePasswordInput } from "../src/lib/auth/password.ts";

const secret = "OnlyInRequest!912";
const user = { nickname: "Member_01", avatar: null, pays: "France", description: null, inscritDepuis: "01/01/2020" };
const cookie = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
const csrf = () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
};

function request({ input = { new_password: secret }, origin = "https://chatnet.fr", cookies = cookie, nickname = user.nickname, body } = {}) {
  const headers = { "Content-Type": "application/json", "X-Chatnet-Profile-Nickname": nickname };
  if (origin) headers.Origin = origin;
  if (cookies) headers.Cookie = cookies;
  return new NextRequest("https://chatnet.fr/api/auth/password", { method: "POST", headers, body: body ?? JSON.stringify(input) });
}

function harness(responses, route = "password") {
  const calls = [];
  const loaded = loadAuthRoute(route, async (url, init) => {
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
  assert.ok(!text.includes(secret));
  assert.ok(!text.includes("session-one") && !text.includes("session-two") && !text.includes("xsrf="));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return JSON.parse(text);
}

test("guests, missing bridge cookies and fake authenticated sessions cannot update passwords", async () => {
  for (const cookies of ["", "chatnet_upstream_session=fake"]) {
    const h = harness([]);
    const response = await h.POST(request({ cookies }));
    assert.equal(response.status, 401);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  const h = harness([json({ message: secret }, 401)]);
  const response = await h.POST(request());
  assert.equal(response.status, 401);
  assert.equal(h.calls.length, 1);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  await safePayload(response);
});

test("missing, hostile, lookalike and production localhost Origins are rejected before network calls", async () => {
  for (const origin of [null, "https://evil.example", "https://chatnet.fr.evil.example", "http://localhost:3000"]) {
    const h = harness([]);
    const response = await h.POST(request({ origin }));
    assert.equal(response.status, 403);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
});

test("only new_password is accepted; arbitrary, current and confirmation fields are rejected", async () => {
  for (const input of [null, [], {}, { password: secret }, { new_password: secret, role: "admin" }, { new_password: secret, email: "other@example.com" }, { new_password: secret, current_password: secret }, { new_password: secret, password_confirmation: secret }, { new_password: secret, confirmation: secret }]) {
    const h = harness([]);
    const response = await h.POST(request({ input }));
    assert.equal(response.status, 400);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
});

test("malformed and oversized JSON is rejected without forwarding", async () => {
  for (const body of ["{", "x".repeat(8193)]) {
    const h = harness([]);
    assert.equal((await h.POST(request({ body }))).status, 400);
    assert.equal(h.calls.length, 0);
  }
});

test("password validation mirrors Laravel trimming/minimum and bounds the BFF transport", async () => {
  for (const new_password of [null, {}, 123456, "", "abcde", "  abc  ", "x".repeat(1025)]) {
    const h = harness([]);
    const response = await h.POST(request({ input: { new_password } }));
    assert.equal(response.status, 422);
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  assert.deepEqual(validatePasswordInput({ new_password: "  abcdef  " }).input, { new_password: "  abcdef  " });
  assert.ok(validatePasswordInput({ new_password: "é漢🙂abc" }).input);
  assert.equal(validatePasswordInput({ new_password: "🙂🙂🙂" }).input, undefined);
  assert.ok(validatePasswordInput({ new_password: "\u00a0abcd\u00a0" }).input);
});

test("changed account identity cannot mutate a different account", async () => {
  const h = harness([json(user)]);
  const response = await h.POST(request({ nickname: "Other" }));
  assert.equal(response.status, 409);
  assert.equal(h.calls.length, 1);
});

test("exact Laravel PUT payload, refreshed CSRF and cookie rotation are preserved; active session stays active", async () => {
  const h = harness([json(user), csrf(), json({ message: secret, password: secret, credentials: secret }, 200, { "Set-Cookie": "laravel_session=session-three; Path=/" }), json(user)]);
  const response = await h.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await safePayload(response), { changed: true, session: "active" });
  assert.equal(h.remaining.length, 0);
  assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), ["/api/me", "/sanctum/csrf-cookie", "/api/update-password", "/api/me"]);
  const mutation = h.calls[2];
  assert.equal(mutation.method, "PUT");
  assert.deepEqual(JSON.parse(mutation.body), { new_password: secret });
  assert.equal(mutation.headers.get("X-XSRF-TOKEN"), "xsrf=two");
  assert.equal(mutation.headers.get("Cookie"), "XSRF-TOKEN=xsrf%3Dtwo; laravel_session=session-two");
  assert.equal(mutation.headers.get("Origin"), "https://chatnet.fr");
  assert.equal(mutation.cache, "no-store");
  assert.equal(mutation.redirect, "error");
  assert.equal(h.calls[3].headers.get("Cookie"), "XSRF-TOKEN=xsrf%3Dtwo; laravel_session=session-three");
  const setCookie = response.headers.get("Set-Cookie");
  assert.match(setCookie, /chatnet_upstream_session=session-three/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=lax/);
  assert.doesNotMatch(setCookie, /(?:^|, )laravel_session=|(?:^|, )XSRF-TOKEN=|Max-Age=0/);
});

test("Laravel 422 fields are safely projected without raw messages, credentials or submitted values", async () => {
  const h = harness([json(user), csrf(), json({ message: secret, errors: { new_password: [secret], current_password: [secret], email: [secret] }, credentials: secret }, 422)]);
  const response = await h.POST(request());
  assert.equal(response.status, 422);
  const payload = await safePayload(response);
  assert.deepEqual(Object.keys(payload.errors), ["new_password"]);
  assert.deepEqual(payload.errors, safePasswordErrors({ errors: { new_password: [secret] } }));
  assert.equal(h.calls.length, 3);
  assert.deepEqual(safePasswordErrors(null), { new_password: "Vérifiez le nouveau mot de passe." });
});

test("success followed by Laravel session expiration clears the bridge but preserves confirmed success", async () => {
  for (const status of [401, 419]) {
    const h = harness([json(user), csrf(), json({ message: secret }), json({ message: secret }, status)]);
    const response = await h.POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await safePayload(response), { changed: true, session: "expired" });
    assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_session=;.*Max-Age=0/);
    assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_xsrf=;.*Max-Age=0/);
    assert.ok(h.calls.every((call) => !call.url.endsWith("/logout")));
  }
});

test("post-success read failure does not claim the password update failed or invent a logout", async () => {
  for (const failure of [json({ message: secret }, 503), new Error(secret), json({ nickname: "Other" })]) {
    const h = harness([json(user), csrf(), json({ message: secret }), failure]);
    const response = await h.POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await safePayload(response), { changed: true, session: "unverified" });
    assert.doesNotMatch(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
  }
});

test("upstream auth, throttling, failure and timeout responses contain no secrets and never retry mutations", async () => {
  for (const [upstream, expected] of [[json({ message: secret }, 401), 401], [json({ message: secret }, 419), 401], [json({ message: secret }, 429), 429], [json({ message: secret }, 502), 503], [json({ message: secret }, 500), 503], [new Error(secret), 503]]) {
    const h = harness([json(user), csrf(), upstream]);
    const response = await h.POST(request());
    assert.equal(response.status, expected);
    await safePayload(response);
    assert.equal(h.calls.filter((call) => call.url.endsWith("/api/update-password")).length, 1);
  }
});

test("existing login rotation and safe me projection still execute unchanged", async () => {
  const login = harness([csrf(), json({ password: secret }, 200, { "Set-Cookie": "laravel_session=login-rotated; Path=/" }), json({ ...user, password: secret, email: "private@example.com" })], "login");
  const response = await login.POST(new NextRequest("https://chatnet.fr/api/auth/login", { method: "POST", headers: { Origin: "https://chatnet.fr", "Content-Type": "application/json" }, body: JSON.stringify({ login: user.nickname, password: secret }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await safePayload(response), { user });
  assert.deepEqual(JSON.parse(login.calls[1].body), { login: user.nickname, password: secret });
  assert.match(login.calls[2].headers.get("Cookie"), /laravel_session=login-rotated/);
  const me = harness([json({ ...user, password: secret })], "me");
  assert.deepEqual(await safePayload(await me.GET(new NextRequest("https://chatnet.fr/api/auth/me", { headers: { Cookie: cookie } }))), { user });
});

test("password UI confirms locally, clears secrets and does not change avatar/profile editing or login", () => {
  const form = source("components/auth/PasswordChangeForm.tsx");
  assert.match(form, /password !== confirmation/);
  assert.match(form, /body: JSON\.stringify\(checked\.input\)/);
  assert.match(form, /setPassword\(""\)/);
  assert.match(form, /setConfirmation\(""\)/);
  assert.match(form, /pending\.current/);
  assert.match(form, /window\.location\.assign\("\/profil\/securite\/confirme"\)/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|console\.|current_password|type="text"/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<AvatarEditor/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<ProfileEditForm/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<PasswordChangeForm key=\{profile.nickname\}/);
  assert.match(source("components/auth/AvatarEditor.tsx"), /fetch\("\/api\/auth\/avatar"/);
  assert.match(source("components/auth/ProfileEditForm.tsx"), /fetch\("\/api\/auth\/profile\/update"/);
  assert.doesNotMatch(source("app/api/auth/password/route.ts"), /console\.|localStorage|sessionStorage/);
});
