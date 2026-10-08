import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import * as forgot from "../src/lib/auth/forgot-password.ts";
import { elements } from "./helpers/password-form.mjs";
import { publicMemberModules } from "./helpers/public-member.mjs";

const require = createRequire(import.meta.url);
const { jsx } = require("react/jsx-runtime");
const byType = (tree, type) => elements(tree, (element) => element.type === type);
const links = (tree) => elements(tree, (element) => typeof element.props?.href === "string");
const alerts = (tree) => elements(tree, (element) => element.props?.role === "alert");
const link = ({ href, children, ...props }) => jsx("a", { href, ...props, children });
const privateValue = "UPSTREAM_PRIVATE_SECRET";

// Run the actual component and handlers with persistent hook slots. Only React's
// scheduler, Next's router/link, the auth context, timers and the network are substituted.
function component(path, name, { fetch = async () => { throw new Error("Unexpected request"); }, mocks = {}, timers = { setTimeout, clearTimeout } } = {}) {
  const slots = [];
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
  };
  const localRequire = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (specifier === "react") return hooks;
    if (specifier === "next/link") return { default: link };
    if (specifier === "@/lib/auth/forgot-password") return forgot;
    return require(specifier);
  };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInContext(`(function(require, exports) { ${code}\n })`, vm.createContext({ fetch, AbortController, ...timers }))(localRequire, exports);
  return { render: (props = {}) => { index = 0; return exports[name](props); } };
}

function forgotForm(options) {
  const calls = [];
  const h = component("components/auth/ForgotPasswordForm.tsx", "ForgotPasswordForm", { ...options, fetch: async (url, init) => {
    calls.push({ url, ...init });
    return options?.fetch ? options.fetch(url, init) : assert.fail(`Unexpected request: ${url}`);
  } });
  return { ...h, calls };
}

function fill(h, value) {
  byType(h.render(), "input")[0].props.onChange({ target: { value } });
  return byType(h.render(), "form")[0];
}

const submitEvent = { preventDefault() {} };

test("email pre-check trims input and rejects empty, malformed, oversized or non-string values", () => {
  assert.deepEqual(forgot.validateResetEmail("  Member_01@Example.com \n"), { email: "Member_01@Example.com" });
  for (const value of ["", "   ", null, undefined, 42, {}, ["member@example.com"]]) {
    assert.deepEqual(forgot.validateResetEmail(value), { error: forgot.forgotPasswordMessages.required });
  }
  for (const value of ["member", "member@", "@example.com", "member@example", "mem ber@example.com", "member@exa mple.com", `${"a".repeat(245)}@example.com`]) {
    assert.deepEqual(forgot.validateResetEmail(value), { error: forgot.forgotPasswordMessages.invalid });
  }
});

test("only the HTTP status decides the outcome and an unknown account matches a known one", () => {
  assert.equal(forgot.FORGOT_PASSWORD_URL, "https://laravel.discut.org/api/forgot-password");
  assert.equal(forgot.forgotPasswordOutcome(200), "sent");
  assert.equal(forgot.forgotPasswordOutcome(404), "sent");
  assert.equal(forgot.forgotPasswordOutcome(422), "invalid");
  assert.equal(forgot.forgotPasswordOutcome(429), "rate_limited");
  for (const status of [0, 201, 204, 301, 302, 400, 401, 403, 405, 419, 500, 502, 503]) assert.equal(forgot.forgotPasswordOutcome(status), "unavailable");
  assert.match(forgot.forgotPasswordMessages.sent, /^Si un compte Chatnet correspond/);
});

test("login form links to the recovery page below the password field and keeps login unchanged", async () => {
  const logins = [];
  const pushes = [];
  const h = component("components/auth/LoginForm.tsx", "LoginForm", { mocks: {
    "next/navigation": { useRouter: () => ({ push: (url) => pushes.push(url), refresh() {} }) },
    "./AuthProvider": { useAuth: () => ({ user: null, loading: false, login: async (...args) => { logins.push(args); } }) },
  } });
  const tree = h.render();
  const forgotLinks = links(tree).filter((element) => element.props.href === "/mot-de-passe-oublie");
  assert.equal(forgotLinks.length, 1);
  assert.equal(forgotLinks[0].props.children, "Mot de passe oublié ?");
  assert.equal(forgotLinks[0].props.className, "auth-forgot");
  assert.ok(links(tree).some((element) => element.props.href === "/inscription"));

  const html = renderToStaticMarkup(tree);
  const password = html.indexOf('id="auth-password"');
  const recovery = html.indexOf('href="/mot-de-passe-oublie"');
  const submit = html.indexOf('type="submit"');
  assert.ok(password !== -1 && password < recovery && recovery < submit);
  assert.match(html, /class="auth-forgot"[^>]*>Mot de passe oublié \?<\/a>/);

  byType(h.render(), "input")[0].props.onChange({ target: { value: "  Member_01 " } });
  byType(h.render(), "input")[1].props.onChange({ target: { value: "Password!123" } });
  await byType(h.render(), "form")[0].props.onSubmit(submitEvent);
  assert.deepEqual(logins, [["Member_01", "Password!123"]]);
  assert.deepEqual(pushes, ["/"]);
});

test("recovery page renders the email form without any request and is excluded from indexing", () => {
  const page = publicMemberModules(() => assert.fail("The recovery page must not fetch while rendering")).load("app/mot-de-passe-oublie/page.tsx");
  assert.equal(page.metadata.robots.index, false);
  assert.equal(page.metadata.alternates.canonical, "/mot-de-passe-oublie");
  const html = renderToStaticMarkup(page.default());
  assert.match(html, /<h1>Retrouvez l’accès à votre compte\.<\/h1>/);
  assert.match(html, /<label for="forgot-email">Adresse e-mail<\/label>/);
  const input = html.match(/<input[^>]*id="forgot-email"[^>]*>/)?.[0] ?? "";
  for (const attribute of ['name="email"', 'type="email"', 'autoComplete="email"', 'autoCapitalize="none"', 'maxLength="254"', 'required=""']) assert.ok(input.includes(attribute), attribute);
  assert.match(html, /<button class="button button-primary auth-submit" type="submit">Envoyer le lien<\/button>/);
  assert.match(html, /href="\/connexion"[^>]*>Retour à la connexion<\/a>/);
  assert.doesNotMatch(html, /role="alert"|role="status"/);
});

test("client validation shows an accessible field error and never calls Laravel", async () => {
  for (const [value, message] of [["", forgot.forgotPasswordMessages.required], ["   ", forgot.forgotPasswordMessages.required], ["member@example", forgot.forgotPasswordMessages.invalid]]) {
    const h = forgotForm();
    await fill(h, value).props.onSubmit(submitEvent);
    const tree = h.render();
    const input = byType(tree, "input")[0];
    assert.equal(input.props["aria-invalid"], true);
    assert.equal(input.props["aria-describedby"], "forgot-email-error");
    assert.deepEqual(alerts(tree).map((element) => [element.props.id, element.props.children]), [["forgot-email-error", message]]);
    assert.equal(h.calls.length, 0);
  }
});

test("one JSON request with only the trimmed address, no credentials, and no duplicate while pending", async () => {
  const responses = [];
  const h = forgotForm({ fetch: () => new Promise((resolve) => responses.push(resolve)) });
  const form = fill(h, "  member@example.com ");
  const submit = form.props.onSubmit(submitEvent);
  // The same handler cannot enqueue a second request before a re-render.
  const duplicate = form.props.onSubmit(submitEvent);
  assert.equal(h.calls.length, 1);

  const pending = h.render();
  assert.equal(byType(pending, "form")[0].props["aria-busy"], true);
  assert.equal(byType(pending, "button")[0].props.disabled, true);
  assert.equal(byType(pending, "button")[0].props.children, "Envoi…");
  assert.equal(byType(pending, "input")[0].props.disabled, true);

  const [call] = h.calls;
  assert.equal(call.url, "https://laravel.discut.org/api/forgot-password");
  assert.equal(call.method, "POST");
  // Copy out of the vm realm so strict equality does not compare Object prototypes.
  assert.deepEqual({ ...call.headers }, { "Content-Type": "application/json", Accept: "application/json" });
  assert.equal(call.body, JSON.stringify({ email: "member@example.com" }));
  assert.equal(call.credentials, "omit");
  assert.equal(call.cache, "no-store");
  assert.equal(call.redirect, "error");
  assert.ok(call.signal instanceof AbortSignal);

  for (const resolve of responses) resolve(new Response(null, { status: 200 }));
  await Promise.all([submit, duplicate]);
  const done = h.render();
  // The form is replaced by the confirmation, so it cannot be resubmitted by accident.
  assert.equal(byType(done, "form").length, 0);
  assert.equal(byType(done, "button").length, 0);
  assert.equal(h.calls.length, 1);
});

test("existing and unknown addresses render the same confirmation and the response body is never read", async () => {
  const rendered = [];
  for (const [status, message] of [[200, "Un lien de reinitialisation a ete envoye a votre email."], [404, "Aucun utilisateur trouve avec cet email."]]) {
    const response = new Response(JSON.stringify({ message, secret: privateValue }), { status, headers: { "Content-Type": "application/json" } });
    const h = forgotForm({ fetch: async () => response });
    await fill(h, "member@example.com").props.onSubmit(submitEvent);
    assert.equal(response.bodyUsed, false);
    const tree = h.render();
    const confirmations = elements(tree, (element) => element.props?.role === "status");
    assert.deepEqual(confirmations.map((element) => element.props.children), [forgot.forgotPasswordMessages.sent]);
    assert.ok(links(tree).some((element) => element.props.href === "/connexion"));
    const html = renderToStaticMarkup(tree);
    for (const leaked of [message, privateValue, "member@example.com"]) assert.ok(!html.includes(leaked));
    assert.match(html, /Discut\.org/);
    rendered.push(html);
  }
  assert.equal(rendered[0], rendered[1]);
});

test("server validation, rate limits and failures keep the form editable and retryable without exposing upstream text", async () => {
  const cases = [
    [new Response(JSON.stringify({ message: privateValue, errors: { email: [privateValue] } }), { status: 422 }), { field: forgot.forgotPasswordMessages.invalid }],
    [new Response(JSON.stringify({ message: privateValue }), { status: 429 }), { form: forgot.forgotPasswordMessages.rateLimited }],
    [new Response(JSON.stringify({ message: privateValue }), { status: 500 }), { form: forgot.forgotPasswordMessages.unavailable }],
    [new Response(null, { status: 503 }), { form: forgot.forgotPasswordMessages.unavailable }],
    [new TypeError("Failed to fetch"), { form: forgot.forgotPasswordMessages.unavailable }],
  ];
  for (const [result, expected] of cases) {
    const h = forgotForm({ fetch: async () => { if (result instanceof Error) throw result; return result; } });
    await fill(h, "member@example.com").props.onSubmit(submitEvent);
    if (result instanceof Response) assert.equal(result.bodyUsed, false);
    const tree = h.render();
    const messages = alerts(tree).map((element) => element.props.children);
    assert.deepEqual(messages, [expected.field ?? expected.form]);
    if (expected.field) assert.equal(byType(tree, "input")[0].props["aria-invalid"], true);
    assert.equal(byType(tree, "input")[0].props.value, "member@example.com");
    assert.equal(byType(tree, "input")[0].props.disabled, false);
    assert.equal(byType(tree, "button")[0].props.disabled, false);
    assert.ok(!renderToStaticMarkup(tree).includes(privateValue));
    await byType(tree, "form")[0].props.onSubmit(submitEvent);
    assert.equal(h.calls.length, 2);
  }
});

test("a stalled request is aborted after 20 seconds and reported as unavailable", async () => {
  const timers = [];
  const cleared = [];
  const h = forgotForm({
    timers: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); return 7; }, clearTimeout: (handle) => cleared.push(handle) },
    fetch: (url, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
  });
  const submit = fill(h, "member@example.com").props.onSubmit(submitEvent);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 20000);
  timers[0].callback();
  await submit;
  assert.equal(h.calls[0].signal.aborted, true);
  assert.deepEqual(cleared, [7]);
  assert.deepEqual(alerts(h.render()).map((element) => element.props.children), [forgot.forgotPasswordMessages.unavailable]);
});
