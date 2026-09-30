import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { GET } from "../src/app/indexnow-key.txt/route.ts";
import { POST } from "../src/app/api/indexnow/submit/route.ts";

const key = "ChatnetKey12345";
const secret = "deployment-trigger-token";
const initialKey = process.env.INDEXNOW_KEY;
const initialSecret = process.env.INDEXNOW_TRIGGER_SECRET;
const initialFetch = globalThis.fetch;

function configure() {
  process.env.INDEXNOW_KEY = key;
  process.env.INDEXNOW_TRIGGER_SECRET = secret;
}

function request(token = secret, body) {
  return new Request("https://chatnet.fr/api/indexnow/submit", {
    method: "POST",
    headers: token ? { "X-IndexNow-Token": token, "Content-Type": "application/json" } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function forbidFetch() {
  globalThis.fetch = () => { throw new Error("unexpected upstream request"); };
}

afterEach(() => {
  if (initialKey === undefined) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = initialKey;
  if (initialSecret === undefined) delete process.env.INDEXNOW_TRIGGER_SECRET;
  else process.env.INDEXNOW_TRIGGER_SECRET = initialSecret;
  globalThis.fetch = initialFetch;
});

test("key endpoint serves only the configured key as cacheable plain text", async () => {
  configure();
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
  assert.equal(await response.text(), key);
});

test("key endpoint fails safely when the key is missing or malformed", async () => {
  delete process.env.INDEXNOW_KEY;
  let response = GET();
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "");
  process.env.INDEXNOW_KEY = `${key}\n`;
  response = GET();
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "");
});

test("submit endpoint rejects missing and invalid tokens before fetching", async () => {
  configure();
  forbidFetch();
  for (const token of [null, "wrong-token"]) {
    const response = await POST(request(token));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, code: "UNAUTHORIZED" });
  }
});

test("submit endpoint fails safely when either configuration value is absent", async () => {
  configure();
  forbidFetch();
  delete process.env.INDEXNOW_KEY;
  let response = await POST(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, code: "UNAVAILABLE" });
  process.env.INDEXNOW_KEY = key;
  delete process.env.INDEXNOW_TRIGGER_SECRET;
  response = await POST(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, code: "UNAVAILABLE" });
});

test("submission sends only canonical Chatnet URLs and ignores caller body", async () => {
  configure();
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(null, { status: 202 });
  };
  const response = await POST(request(secret, { urlList: ["https://other.example/", "https://chatnet.fr/connexion"] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, submitted: 6 });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(captured.url, "https://api.indexnow.org/indexnow");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.Accept, "application/json");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.equal(captured.options.cache, "no-store");
  assert(captured.options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(captured.options.body), {
    host: "chatnet.fr",
    key,
    keyLocation: "https://chatnet.fr/indexnow-key.txt",
    urlList: [
      "https://chatnet.fr/", "https://chatnet.fr/salons", "https://chatnet.fr/communaute",
      "https://chatnet.fr/jeux", "https://chatnet.fr/a-propos", "https://chatnet.fr/contact",
    ],
  });
});

test("upstream rejection and timeout return safe errors without response bodies", async () => {
  configure();
  globalThis.fetch = async () => new Response("private upstream details", { status: 403 });
  let response = await POST(request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, code: "UPSTREAM_UNAVAILABLE" });

  globalThis.fetch = async () => new Response("rate limited", { status: 429 });
  response = await POST(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, code: "UPSTREAM_UNAVAILABLE" });

  globalThis.fetch = async () => { throw new DOMException("network details", "TimeoutError"); };
  response = await POST(request());
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { ok: false, code: "UPSTREAM_UNAVAILABLE" });
});
