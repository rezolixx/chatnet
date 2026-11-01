import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server.js";
import { projectOwnChannelRequests, validateChannelRequestInput } from "../src/lib/channels/requests.ts";

const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const id = "57be8ef1-2df5-4c95-9ef5-393a94546220";
const input = { channel: "#MonSalon", category: "entraide", description: "Pour discuter entre membres.", topic: "Discussion et entraide", accept_rules: true };
const cookies = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });

function csrf() {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
}

function route(path, fakeFetch) {
  const modules = new Map();
  const context = vm.createContext({ fetch: fakeFetch, Headers, Response, Request, AbortSignal, TextDecoder, Uint8Array, URL, process: { env: { NODE_ENV: "production" } } });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const record = { exports: {} };
    modules.set(file, record);
    const source = readFileSync(file, "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier.startsWith("@/")) return load(resolve(sourceRoot, `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return load(resolve(dirname(file), specifier.endsWith(".ts") ? specifier : `${specifier}.ts`));
      return require(specifier);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(localRequire, record, record.exports);
    return record.exports;
  }
  return load(resolve(sourceRoot, `app/api/channels/requests/${path}`));
}

function request(method = "GET", { origin = "https://chatnet.fr", cookie = cookies, fields = input, path = "" } = {}) {
  const headers = { Cookie: cookie, "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new NextRequest(`https://chatnet.fr/api/channels/requests${path}`, { method, headers, ...(method !== "GET" ? { body: JSON.stringify(fields) } : {}) });
}

function harness(responses, dynamic = false) {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, ...init });
    assert.ok(responses.length, `Unexpected network call: ${url}`);
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return result;
  };
  return { route: route(dynamic ? "[id]/route.ts" : "route.ts", fakeFetch), calls };
}

async function payload(response) {
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  const serialized = JSON.stringify(result);
  for (const secret of ["PRIVATE_TOKEN", "session-one", "session-two", "xsrf=", "laravel_session", "password"]) assert.ok(!serialized.includes(secret));
  return result;
}

test("channel fields are strictly validated; extra identities/status cannot be submitted", () => {
  assert.deepEqual(validateChannelRequestInput(input).input, input);
  for (const channel of ["#A", "#a[]", "#équipe", "#a\rJOIN", "#a test", "#a" + "x".repeat(31)]) {
    assert.ok(validateChannelRequestInput({ ...input, channel }).errors.channel, channel);
  }
  assert.equal(validateChannelRequestInput({ ...input, user_id: 7 }).input, undefined);
  assert.equal(validateChannelRequestInput({ ...input, accept_rules: "on" }).input, undefined);
  assert.ok(validateChannelRequestInput({ ...input, description: "trop court" }).errors.description);
  assert.ok(validateChannelRequestInput({ ...input, topic: "sujet\u0001" }).errors.topic);
  assert.equal(projectOwnChannelRequests({ requests: [{ id, status: "admin", channel: input.channel }] }), null);
});

test("GET requires a live session and projects only own request fields", async () => {
  const guest = harness([]);
  assert.equal((await guest.route.GET(request("GET", { cookie: "" }))).status, 401);
  assert.equal(guest.calls.length, 0);
  const requestRecord = { id, channel: input.channel, category: input.category, description: input.description, topic: input.topic, founder_display: "Founder", status: "pending", rejection_reason: null, created_at: "2026-10-31", updated_at: "2026-10-31", user_profile_id: 4, token: "PRIVATE_TOKEN" };
  const h = harness([json({ nickname: "Member", password: "PRIVATE_TOKEN" }), json({ requests: [requestRecord] })]);
  const response = await h.route.GET(request());
  assert.equal(response.status, 200);
  const body = await payload(response);
  assert.equal(body.requests.length, 1);
  assert.equal(body.requests[0].channel, "#MonSalon");
  assert.ok(!Object.hasOwn(body.requests[0], "user_profile_id"));
  assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), ["/api/me", "/api/channel-requests"]);
  assert.equal(h.calls[1].headers.get("Cookie"), "XSRF-TOKEN=xsrf=one; laravel_session=session-one");
});

test("disabled Laravel feature returns a safe non-active state", async () => {
  const h = harness([json({ nickname: "Member" }), json({ message: "PRIVATE_TOKEN" }, 404)]);
  const response = await h.route.GET(request());
  assert.equal(response.status, 404);
  assert.equal((await payload(response)).code, "FEATURE_UNAVAILABLE");
});

test("POST rejects CSRF, bad body and forged fields without network IO", async () => {
  for (const origin of [null, "https://evil.example", "http://chatnet.fr"]) {
    const h = harness([]);
    assert.equal((await h.route.POST(request("POST", { origin }))).status, 403);
    assert.equal(h.calls.length, 0);
  }
  for (const fields of [{ ...input, founder_uniqueid: "forged" }, { ...input, channel: "#A" }, { ...input, accept_rules: false }]) {
    const h = harness([]);
    assert.ok([400, 422].includes((await h.route.POST(request("POST", { fields }))).status));
    assert.equal(h.calls.length, 0);
  }
});

test("POST verifies member, refreshes Laravel CSRF and forwards only approved fields", async () => {
  const h = harness([json({ nickname: "Member", role: "admin", token: "PRIVATE_TOKEN" }), csrf(), json({ id, status: "pending", secret: "PRIVATE_TOKEN" }, 201)]);
  const response = await h.route.POST(request("POST"));
  assert.equal(response.status, 201);
  assert.deepEqual(await payload(response), { id, status: "pending" });
  assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), ["/api/me", "/sanctum/csrf-cookie", "/api/channel-requests"]);
  const post = h.calls[2];
  assert.equal(post.method, "POST");
  assert.deepEqual(JSON.parse(post.body), input);
  assert.equal(post.headers.get("Cookie"), "XSRF-TOKEN=xsrf%3Dtwo; laravel_session=session-two");
  assert.equal(post.headers.get("X-XSRF-TOKEN"), "xsrf=two");
  assert.equal(post.headers.get("Authorization"), null);
  assert.ok(h.calls.every((call) => call.cache === "no-store"));
  assert.match(response.headers.get("Set-Cookie"), /chatnet_upstream_session=session-two/);
});

test("PUT only accepts UUID path and a verified revision acknowledgement", async () => {
  const invalid = harness([], true);
  assert.equal((await invalid.route.PUT(request("PUT", { path: "/bad" }), { params: Promise.resolve({ id: "bad" }) })).status, 404);
  assert.equal(invalid.calls.length, 0);
  const h = harness([json({ nickname: "Member" }), csrf(), json({ id, status: "pending", token: "PRIVATE_TOKEN" })], true);
  const response = await h.route.PUT(request("PUT", { path: `/${id}` }), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await payload(response), { id, status: "pending" });
  assert.equal(new URL(h.calls[2].url).pathname, `/api/channel-requests/${id}`);
  assert.equal(h.calls[2].method, "PUT");
});

test("upstream conflicts, validation and unexpected acknowledgements are sanitized", async () => {
  for (const [status, code] of [[403, "IDENTITY_REQUIRED"], [409, "CONFLICT"], [429, "RATE_LIMITED"]]) {
    const h = harness([json({ nickname: "Member" }), csrf(), json({ message: "PRIVATE_TOKEN" }, status)]);
    const response = await h.route.POST(request("POST"));
    assert.equal(response.status, status);
    assert.equal((await payload(response)).code, code);
  }
  const quota = harness([json({ nickname: "Member" }), csrf(), json({ code: "ACTIVE_REQUEST_LIMIT", message: "PRIVATE_TOKEN" }, 409)]);
  const quotaResponse = await quota.route.POST(request("POST"));
  assert.equal(quotaResponse.status, 409);
  assert.equal((await payload(quotaResponse)).code, "ACTIVE_REQUEST_LIMIT");
  const reserved = harness([json({ nickname: "Member" }), csrf(), json({ message: "Ce nom de salon est reserve." }, 409)]);
  const reservedResponse = await reserved.route.POST(request("POST"));
  assert.equal(reservedResponse.status, 409);
  assert.equal((await payload(reservedResponse)).code, "NAME_RESERVED");
  const throttled = harness([json({ nickname: "Member" }), csrf(), json({ message: "PRIVATE_TOKEN" }, 429, { "Retry-After": "42" })]);
  const throttledResponse = await throttled.route.POST(request("POST"));
  assert.equal(throttledResponse.status, 429);
  const throttledBody = await payload(throttledResponse);
  assert.equal(throttledBody.code, "RATE_LIMITED");
  assert.match(throttledBody.message, /1 minute/);
  assert.doesNotMatch(throttledBody.message, /Deux demandes/);
  const formSource = readFileSync(resolve(sourceRoot, "components/rooms/ChannelRequestForm.tsx"), "utf8");
  assert.match(formSource, /body.code === "ACTIVE_REQUEST_LIMIT"/);
  assert.match(formSource, /body.code === "RATE_LIMITED"/);
  const validation = harness([json({ nickname: "Member" }), csrf(), json({ errors: { channel: ["PRIVATE_TOKEN"], founder_uniqueid: ["PRIVATE_TOKEN"] } }, 422)]);
  const response = await validation.route.POST(request("POST"));
  assert.deepEqual(Object.keys((await payload(response)).errors), ["channel"]);
  const unconfirmed = harness([json({ nickname: "Member" }), csrf(), json({ id, status: "active", secret: "PRIVATE_TOKEN" }, 201)]);
  assert.equal((await unconfirmed.route.POST(request("POST"))).status, 503);
});
