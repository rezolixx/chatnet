import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";

// Every bridge request reaches Laravel from the Chatnet server's own address.
// With CHATNET_CLIENT_IP_SECRET, sign-in, registration and session checks name
// the visitor (the address the edge proxy wrote in X-Forwarded-For), so
// Laravel's per-address limits are per visitor instead of shared by everyone.
const secret = "chatnet-bff-test-secret-0123456789abcdef";
const env = { CHATNET_CLIENT_IP_SECRET: secret };
const bridgeCookies = "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done";
const registration = { nickname: "Member_01", email: "member@example.com", birthdate: "1990-06-15", gender: "Femme", pays: "France", password: "secret1234" };
const me = { nickname: "Member_01", avatar: null, pays: "France", description: null, inscritDepuis: "15/06/2020" };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const csrf = () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/");
  headers.append("Set-Cookie", "laravel_session=session-two; Path=/");
  return new Response(null, { status: 204, headers });
};

const flows = {
  login: {
    upstream: () => [csrf(), json({ message: "ok" }), json(me)],
    request: (headers) => new NextRequest("https://chatnet.fr/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://chatnet.fr", ...headers },
      body: JSON.stringify({ login: "Member_01", password: "secret123" }),
    }),
    call: (route, request) => route.POST(request),
    status: 200,
  },
  register: {
    upstream: () => [csrf(), json({ message: "ok" }, 201)],
    request: (headers) => new NextRequest("https://chatnet.fr/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://chatnet.fr", ...headers },
      body: JSON.stringify(registration),
    }),
    call: (route, request) => route.POST(request),
    status: 201,
  },
  me: {
    upstream: () => [json(me)],
    request: (headers) => new NextRequest("https://chatnet.fr/api/auth/me", { headers: { Cookie: bridgeCookies, ...headers } }),
    call: (route, request) => route.GET(request),
    status: 200,
  },
};

async function run(name, { headers = {}, routeEnv = env } = {}) {
  const flow = flows[name];
  const responses = flow.upstream();
  const calls = [];
  const route = loadAuthRoute(name, async (url, init) => {
    assert.ok(responses.length, `Unexpected network call: ${url}`);
    calls.push({ url, headers: new Headers(init.headers) });
    return responses.shift();
  }, routeEnv);
  const response = await flow.call(route, flow.request(headers));
  assert.equal(response.status, flow.status, name);
  assert.equal(responses.length, 0, `${name}: every upstream call was made`);
  return { calls, response };
}

function forwarded(calls) {
  return calls.map(({ headers }) => [headers.get("X-Discut-Client-IP"), headers.get("X-Discut-Client-IP-Key")]);
}

test("sign-in, registration and session checks name the visitor on every Laravel call", async () => {
  for (const name of Object.keys(flows)) {
    for (const address of ["203.0.113.5", "2001:db8::5"]) {
      const { calls } = await run(name, { headers: { "X-Forwarded-For": address } });
      assert.ok(calls.length > 0);
      for (const call of calls) assert.ok(call.url.startsWith("https://laravel.discut.org/"));
      assert.deepEqual(forwarded(calls), calls.map(() => [address, secret]), `${name} ${address}`);
    }
  }
});

test("nothing is forwarded without a configured secret of at least 32 characters", async () => {
  for (const name of Object.keys(flows)) {
    for (const routeEnv of [{}, { CHATNET_CLIENT_IP_SECRET: "" }, { CHATNET_CLIENT_IP_SECRET: "too-short-secret" }]) {
      const { calls } = await run(name, { headers: { "X-Forwarded-For": "203.0.113.5" }, routeEnv });
      assert.deepEqual(forwarded(calls), calls.map(() => [null, null]), `${name} ${JSON.stringify(routeEnv)}`);
    }
  }
});

test("only a valid address written by the edge proxy is forwarded", async () => {
  const cases = [
    [{ "X-Forwarded-For": "6.6.6.6, 203.0.113.7" }, "203.0.113.7"],
    [{ "X-Forwarded-For": " 203.0.113.8 " }, "203.0.113.8"],
    [{}, null],
    [{ "X-Forwarded-For": "not-an-ip" }, null],
    [{ "X-Forwarded-For": "203.0.113.7, " }, null],
    [{ "X-Forwarded-For": "203.0.113.300" }, null],
  ];
  for (const name of Object.keys(flows)) {
    for (const [headers, expected] of cases) {
      const { calls } = await run(name, { headers });
      assert.deepEqual(forwarded(calls), calls.map(() => (expected ? [expected, secret] : [null, null])), `${name} ${JSON.stringify(headers)}`);
    }
  }
});

test("a browser cannot supply the visitor address or the key itself", async () => {
  const spoofed = { "X-Discut-Client-IP": "198.51.100.66", "X-Discut-Client-IP-Key": "browser-chosen-key-browser-chosen-key" };
  for (const name of Object.keys(flows)) {
    const withoutEdge = await run(name, { headers: spoofed });
    assert.deepEqual(forwarded(withoutEdge.calls), withoutEdge.calls.map(() => [null, null]), name);

    const withEdge = await run(name, { headers: { ...spoofed, "X-Forwarded-For": "203.0.113.9" } });
    assert.deepEqual(forwarded(withEdge.calls), withEdge.calls.map(() => ["203.0.113.9", secret]), name);
  }
});

test("the secret never reaches the browser", async () => {
  for (const name of Object.keys(flows)) {
    const { response } = await run(name, { headers: { "X-Forwarded-For": "203.0.113.5" } });
    assert.ok(!(await response.text()).includes(secret), name);
    for (const [, value] of response.headers) assert.ok(!value.includes(secret), name);
  }
});
