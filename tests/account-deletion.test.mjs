import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import {
  accountDeletionMessages,
  deletedMessage,
  deletionFieldErrors,
  deletionMessageForCode,
  deletionOutcomeFromUpstream,
  isDeletionConfirmed,
  validateDeletionInput,
} from "../src/lib/auth/account-deletion.ts";

// T22: chatnet.fr account deletion goes through the same Laravel workflow as
// discut.org (DELETE /api/delete-account). Only Laravel's confirmation is a
// deletion; the bridge never echoes Laravel's text.
const secret = "OnlyInRequest!912";
const user = { nickname: "Member_01", avatar: null, pays: "France", description: null, inscritDepuis: "01/01/2020" };
const cookie = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const input = { password: secret, confirmation: "SUPPRIMER" };
const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
const csrf = () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
};

function request({ body = input, origin = "https://chatnet.fr", cookies = cookie, nickname = user.nickname, raw } = {}) {
  const headers = { "Content-Type": "application/json", "X-Chatnet-Profile-Nickname": nickname };
  if (origin) headers.Origin = origin;
  if (cookies) headers.Cookie = cookies;
  return new NextRequest("https://chatnet.fr/api/auth/account/delete", { method: "POST", headers, body: raw ?? JSON.stringify(body) });
}

function harness(responses) {
  const calls = [];
  const loaded = loadAuthRoute("account/delete", async (url, init) => {
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

const deletions = (h) => h.calls.filter((call) => new URL(call.url).pathname === "/api/delete-account");

test("guests, missing bridge cookies and expired sessions delete nothing", async () => {
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
  assert.equal(deletions(h).length, 0);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("missing, hostile and lookalike Origins are rejected before any network call", async () => {
  for (const origin of [null, "https://evil.example", "https://chatnet.fr.evil.example", "http://localhost:3000"]) {
    const h = harness([]);
    assert.equal((await h.POST(request({ origin }))).status, 403);
    assert.equal(h.calls.length, 0);
  }
});

test("only { password, confirmation } is accepted, and SUPPRIMER is required, before any network call", async () => {
  for (const body of [null, [], {}, { password: secret }, { confirmation: "SUPPRIMER" }, { ...input, email: "x@example.com" }, { password: 1, confirmation: "SUPPRIMER" }]) {
    const h = harness([]);
    const response = await h.POST(request({ body }));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(h.calls.length, 0);
    await safePayload(response);
  }
  for (const [body, field] of [[{ password: "", confirmation: "SUPPRIMER" }, "password"], [{ password: secret, confirmation: "oui" }, "confirmation"], [{ password: "x".repeat(256), confirmation: "SUPPRIMER" }, "password"]]) {
    const h = harness([]);
    const response = await h.POST(request({ body }));
    assert.equal(response.status, 422);
    assert.deepEqual(Object.keys((await safePayload(response)).errors), [field]);
    assert.equal(h.calls.length, 0);
  }
  for (const raw of ["{", "x".repeat(8193)]) {
    const h = harness([]);
    assert.equal((await h.POST(request({ raw }))).status, 400);
    assert.equal(h.calls.length, 0);
  }
});

test("a page showing another account than the session's never deletes", async () => {
  const h = harness([json(user)]);
  const response = await h.POST(request({ nickname: "Other" }));
  assert.equal(response.status, 409);
  assert.equal((await safePayload(response)).code, "STALE_PROFILE");
  assert.equal(deletions(h).length, 0);
});

test("confirmed deletion: exact Laravel DELETE, then the bridge session ends", async () => {
  const h = harness([json(user), csrf(), json({ status: "deleted", code: "ACCOUNT_DELETED", irc: "removed", message: secret })]);
  const response = await h.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await safePayload(response), { deleted: true, pending: false, irc: "removed" });
  assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), ["/api/me", "/sanctum/csrf-cookie", "/api/delete-account"]);
  const mutation = h.calls[2];
  assert.equal(mutation.method, "DELETE");
  assert.deepEqual(JSON.parse(mutation.body), input);
  assert.equal(mutation.headers.get("X-XSRF-TOKEN"), "xsrf=two");
  assert.equal(mutation.headers.get("Origin"), "https://chatnet.fr");
  assert.equal(mutation.redirect, "error");
  assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_session=;.*Max-Age=0/);
});

test("website deleted while NickServ is still being verified is a deletion, said as such", async () => {
  const h = harness([json(user), csrf(), json({ status: "irc_pending", code: "ACCOUNT_DELETED_IRC_PENDING", irc: "uncertain" }, 202)]);
  const response = await h.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await safePayload(response), { deleted: true, pending: true, irc: "uncertain" });
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("anything but Laravel's confirmation is never a deletion, and Laravel's text is never echoed", async () => {
  const cases = [
    [json({ message: "✅ Compte supprimé avec succès." }), 503, "UNCONFIRMED"],
    [json({ code: "REAUTH_FAILED", message: secret }, 403), 403, "WRONG_PASSWORD"],
    [json({ status: "not_deleted", code: "ACCOUNT_PROTECTED", message: secret }, 403), 403, "ACCOUNT_PROTECTED"],
    [json({ status: "busy", code: "ACCOUNT_DELETION_IN_PROGRESS" }, 409), 409, "IN_PROGRESS"],
    [json({ code: "CONFIRMATION_REQUIRED" }, 422), 422, "VALIDATION_ERROR"],
    [json({ message: secret }, 429), 429, "RATE_LIMITED"],
    [json({ status: "website_pending", code: "ACCOUNT_DELETION_INCOMPLETE", message: secret }, 500), 503, "INCOMPLETE"],
    [json({ status: "not_deleted", code: "IRC_REFUSED" }, 502), 502, "IRC_REFUSED"],
    [json({ status: "not_deleted", code: "IRC_UNAVAILABLE" }, 503), 503, "IRC_UNAVAILABLE"],
    [json({ status: "not_deleted", code: "ACCOUNT_DELETION_DISABLED" }, 503), 503, "UNAVAILABLE"],
    [new Response("<html>gateway</html>", { status: 504 }), 503, "UNCONFIRMED"],
    [new Error(secret), 503, "UNCONFIRMED"],
  ];
  for (const [upstream, status, code] of cases) {
    const h = harness([json(user), csrf(), upstream]);
    const response = await h.POST(request());
    assert.equal(response.status, status, code);
    const payload = await safePayload(response);
    assert.equal(payload.code, code);
    assert.equal(payload.deleted, undefined);
    assert.ok(Object.values(accountDeletionMessages).includes(payload.message), payload.message);
    assert.doesNotMatch(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
    assert.equal(deletions(h).length, 1, "never retried");
  }
  for (const status of [401, 419]) {
    const h = harness([json(user), csrf(), json({ message: secret }, status)]);
    const response = await h.POST(request());
    assert.equal(response.status, 401);
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  }
});

test("a failure before anything was sent says nothing was deleted", async () => {
  for (const responses of [[json({ message: secret }, 503)], [json(user), new Response(null, { status: 500 })], [new Error(secret)]]) {
    const h = harness(responses);
    const response = await h.POST(request());
    assert.equal(response.status, 503);
    assert.equal((await safePayload(response)).code, "UNAVAILABLE");
    assert.equal(deletions(h).length, 0);
  }
});

test("shared rules: confirmation word, field errors, codes and confirmation page wording", () => {
  for (const value of ["SUPPRIMER", "supprimer", " Supprimer "]) assert.equal(isDeletionConfirmed(value), true);
  for (const value of ["", "oui", "SUPPRIME", null, 1]) assert.equal(isDeletionConfirmed(value), false);
  assert.deepEqual(validateDeletionInput(input).input, input);
  assert.deepEqual(deletionFieldErrors({ confirmation: secret }), { confirmation: accountDeletionMessages.confirmationRequired });
  assert.deepEqual(deletionFieldErrors({ password: secret }), { password: accountDeletionMessages.passwordRequired });
  assert.equal(deletionMessageForCode("WRONG_PASSWORD"), accountDeletionMessages.wrongPassword);
  for (const code of [undefined, "", "deleted", "__proto__", "constructor"]) assert.equal(deletionMessageForCode(code), accountDeletionMessages.unconfirmed);
  assert.equal(deletedMessage("removed"), accountDeletionMessages.deletedWithIrc);
  assert.equal(deletedMessage("skipped"), accountDeletionMessages.deletedIrcKept);
  assert.equal(deletedMessage("uncertain"), accountDeletionMessages.ircPending);
  for (const irc of [undefined, "absent", ["removed"], "<script>"]) assert.equal(deletedMessage(irc), accountDeletionMessages.deleted);
  assert.deepEqual(deletionOutcomeFromUpstream(200, { status: "deleted", irc: "<b>" }), { deleted: true, pending: false, irc: "absent" });
});

test("profile UI: explicit confirmation, one request at a time, success only after the bridge confirmed", () => {
  const form = source("components/auth/AccountDeletionForm.tsx");
  assert.match(source("components/auth/ProfileContent.tsx"), /<AccountDeletionForm key=\{`delete-\$\{profile\.nickname\}`\} nickname=\{profile\.nickname\} \/>/);
  assert.match(form, /fetch\("\/api\/auth\/account\/delete"/);
  assert.match(form, /"X-Chatnet-Profile-Nickname": nickname/);
  assert.match(form, /if \(pending\.current\) return;/);
  assert.match(form, /if \(response\.ok && result\.deleted === true\) \{/);
  assert.match(form, /window\.location\.assign\(`\/profil\/compte-supprime\?irc=\$\{irc\}`\)/);
  assert.match(form, /autoComplete="current-password"/);
  assert.match(form, /disabled=\{submitting \|\| !password \|\| !isDeletionConfirmed\(confirmation\)\}/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|console\./);
  const page = source("app/profil/compte-supprime/page.tsx");
  assert.match(page, /deletedMessage\(irc\)/);
  assert.match(page, /index: false/);
});
