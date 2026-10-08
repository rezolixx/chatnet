import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { loadAuthRoute } from "./helpers/auth-route.mjs";
import { elements, passwordForm } from "./helpers/password-form.mjs";
import { passwordHint, passwordMessageFromUpstream, passwordMessages, passwordPolicyError, safePasswordErrors } from "../src/lib/auth/password.ts";
import { registrationFailure, validateRegistration } from "../src/lib/auth/registration.ts";

// T19: one password policy, matching Laravel PasswordPolicy and NickServ
// (minpasslen = 10, maxpasslen = 50 bytes, no whitespace, never the nickname).
const now = new Date("2026-09-30T12:00:00Z");
const registration = { nickname: "Member_0123", email: "member@example.com", birthdate: "1990-06-15", gender: "Femme", pays: "France", password: "abcdefghij" };
const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const json = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });

test("the policy messages are the agreed French texts", () => {
  assert.equal(passwordMessages.policy, "Le mot de passe doit contenir au moins 10 caractères, sans espaces.");
  assert.equal(passwordMessages.nickname, "Le mot de passe doit être différent de votre pseudo.");
  assert.match(passwordHint, /10 caractères, sans espaces/);
});

test("a 9-character password is rejected and a 10-character one is accepted", () => {
  assert.equal(passwordPolicyError("abcdefghi"), passwordMessages.policy);
  assert.equal(passwordPolicyError("abcdefghij"), undefined);
  // Length is counted in characters, like Laravel's min rule.
  assert.equal(passwordPolicyError("éééééééééé"), undefined);
  assert.equal(passwordPolicyError("🙂".repeat(9)), passwordMessages.policy);
  assert.equal(passwordPolicyError(""), passwordMessages.policy);
  assert.equal(passwordPolicyError(undefined), passwordMessages.policy);
});

test("no symbol, digit or uppercase is required", () => {
  for (const password of ["abcdefghij", "0123456789", "ABCDEFGHIJ", "motdepasse"]) assert.equal(passwordPolicyError(password), undefined);
});

test("passwords containing any whitespace or control character are rejected", () => {
  for (const password of ["abcde fghij", " abcdefghij", "abcdefghij ", "abcde\tfghij", "abcde\nfghij", "abcde fghij", "abcde\u0000fghij", "abcde\u007ffghij"]) {
    assert.equal(passwordPolicyError(password), passwordMessages.policy, JSON.stringify(password));
  }
});

test("the 50-byte NickServ maximum is enforced in UTF-8 bytes", () => {
  assert.equal(passwordPolicyError("x".repeat(50)), undefined);
  assert.equal(passwordPolicyError("x".repeat(51)), passwordMessages.tooLong);
  assert.equal(passwordPolicyError("é".repeat(25)), undefined);
  assert.equal(passwordPolicyError("é".repeat(26)), passwordMessages.tooLong);
});

test("a password equal to the nickname is rejected, ignoring case and surrounding nickname spaces", () => {
  assert.equal(passwordPolicyError("Member_0123", "Member_0123"), passwordMessages.nickname);
  assert.equal(passwordPolicyError("member_0123", " MEMBER_0123 "), passwordMessages.nickname);
  assert.equal(passwordPolicyError("Member_01234", "Member_0123"), undefined);
  assert.equal(passwordPolicyError("Member_0123", null), undefined);
});

test("registration applies the same policy, including the nickname rule", () => {
  assert.deepEqual(validateRegistration(registration, "abcdefghij", now).errors, {});
  assert.equal(validateRegistration({ ...registration, password: "abcdefghi" }, undefined, now).errors.password, passwordMessages.policy);
  assert.equal(validateRegistration({ ...registration, password: "abcde fghij" }, undefined, now).errors.password, passwordMessages.policy);
  assert.equal(validateRegistration({ ...registration, password: "member_0123" }, undefined, now).errors.password, passwordMessages.nickname);
  assert.equal(validateRegistration({ ...registration, nickname: " Member_0123 ", password: "Member_0123" }, undefined, now).errors.password, passwordMessages.nickname);
});

test("Laravel registration password errors are shown with our fixed texts, never copied", () => {
  const map = (message) => registrationFailure(422, { message, errors: { password: [message] } }).errors.password;
  assert.equal(map("Le mot de passe doit contenir au moins 10 caractères."), passwordMessages.policy);
  assert.equal(map("Le mot de passe ne doit pas contenir d'espace."), passwordMessages.policy);
  assert.equal(map("Le mot de passe ne doit pas être identique au pseudo."), passwordMessages.nickname);
  assert.equal(map("Le mot de passe ne doit pas dépasser 50 caractères."), passwordMessages.tooLong);
  assert.equal(map("raw secret-value"), passwordMessages.policy);
  // NickServ's own refusal has no field errors, only a fixed message.
  assert.equal(registrationFailure(422, { message: "Mot de passe refusé par le service IRC, choisis-en un autre." }).errors.password, "Ce mot de passe a été refusé par le service de chat. Choisissez-en un autre.");
  assert.equal(registrationFailure(422, { message: "secret-value" }).errors.password, undefined);
});

test("Laravel password-change errors are mapped by known text", () => {
  assert.deepEqual(safePasswordErrors({ errors: { new_password: ["Le mot de passe ne doit pas être identique au pseudo."] } }), { new_password: passwordMessages.nickname });
  assert.deepEqual(safePasswordErrors({ errors: { new_password: ["Le mot de passe doit contenir au moins 10 caractères."] } }), { new_password: passwordMessages.policy });
  assert.deepEqual(safePasswordErrors({ errors: { new_password: ["Le mot de passe ne doit contenir ni espace ni caractère de contrôle."] } }), { new_password: passwordMessages.policy });
  assert.deepEqual(safePasswordErrors({ errors: { new_password: ["Le mot de passe ne doit pas dépasser 50 caractères."] } }), { new_password: passwordMessages.tooLong });
  assert.equal(passwordMessageFromUpstream("Le mot de passe ne doit pas être identique au pseudo. secret"), passwordMessages.policy);
});

const longUser = { nickname: "Member_0123", avatar: null, pays: "France", description: null, inscritDepuis: "01/01/2020" };
function changeRequest(new_password, nickname = longUser.nickname) {
  return new NextRequest("https://chatnet.fr/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://chatnet.fr", Cookie: "chatnet_upstream_session=session-one; chatnet_upstream_xsrf=xsrf%3Done", "X-Chatnet-Profile-Nickname": nickname },
    body: JSON.stringify({ new_password }),
  });
}

test("the password-change BFF refuses the account nickname before calling /api/update-password", async () => {
  const calls = [];
  const { POST } = loadAuthRoute("password", async (url) => { calls.push(new URL(url).pathname); return json(longUser); });
  const response = await POST(changeRequest("MEMBER_0123"));
  assert.equal(response.status, 422);
  assert.deepEqual((await response.json()).errors, { new_password: passwordMessages.nickname });
  assert.deepEqual(calls, ["/api/me"]);
});

test("the password-change BFF refuses 9 characters and spaces without any network call", async () => {
  for (const password of ["abcdefghi", "abcde fghij"]) {
    const { POST } = loadAuthRoute("password", async () => { throw new Error("Unexpected fetch"); });
    const response = await POST(changeRequest(password));
    assert.equal(response.status, 422);
    assert.deepEqual((await response.json()).errors, { new_password: passwordMessages.policy });
  }
});

test("the password-change BFF forwards Laravel's nickname refusal with our message", async () => {
  const csrf = new Response(null, { status: 204, headers: [["Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/"], ["Set-Cookie", "laravel_session=session-two; Path=/"]] });
  const responses = [json(longUser), csrf, json({ message: "Donnees invalides.", errors: { new_password: ["Le mot de passe ne doit pas être identique au pseudo."] } }, 422)];
  const { POST } = loadAuthRoute("password", async () => responses.shift());
  const response = await POST(changeRequest("abcdefghij"));
  assert.equal(response.status, 422);
  assert.deepEqual((await response.json()).errors, { new_password: passwordMessages.nickname });
});

const byType = (tree, type) => elements(tree, (element) => element.type === type);
const toggle = (tree) => byType(tree, "button").find((button) => button.props.type === "button");
const passwordInputs = (tree) => byType(tree, "input").filter((input) => input.props.type === "password");
const alerts = (tree) => elements(tree, (element) => element.props?.role === "alert");

function openForm(harness, password, confirmation = password) {
  toggle(harness.render()).props.onClick();
  const [input, confirm] = passwordInputs(harness.render());
  input.props.onChange({ target: { value: password } });
  confirm.props.onChange({ target: { value: confirmation } });
}

test("change form shows the hint, keeps quiet while typing, then explains the rule after the field is left", () => {
  const harness = passwordForm(undefined, "Member_0123");
  openForm(harness, "abc");
  let input = passwordInputs(harness.render())[0];
  assert.match(input.props["aria-describedby"], /new-password-hint/);
  assert.equal(alerts(harness.render()).length, 0);
  assert.equal(elements(harness.render(), (element) => element.props?.id === "new-password-hint")[0].props.children, passwordHint);
  input.props.onBlur();
  input = passwordInputs(harness.render())[0];
  assert.equal(input.props["aria-invalid"], true);
  assert.equal(alerts(harness.render())[0].props.children, passwordMessages.policy);
  // Valid input clears the message immediately.
  input.props.onChange({ target: { value: "abcdefghij" } });
  assert.equal(alerts(harness.render()).length, 0);
  assert.equal(passwordInputs(harness.render())[0].props["aria-invalid"], false);
});

test("change form never submits a 9-character, spaced or nickname password", async () => {
  for (const [password, message] of [["abcdefghi", passwordMessages.policy], ["abcde fghij", passwordMessages.policy], ["member_0123", passwordMessages.nickname]]) {
    const harness = passwordForm(async () => { throw new Error("Unexpected fetch"); }, "Member_0123");
    openForm(harness, password);
    await byType(harness.render(), "form")[0].props.onSubmit({ preventDefault() {} });
    const shown = alerts(harness.render());
    assert.equal(shown.length, 1, password);
    assert.equal(shown[0].props.children, message);
  }
});

test("change form submits a valid 10-character password", async () => {
  const calls = [];
  const harness = passwordForm(async (url, init) => { calls.push(JSON.parse(init.body)); return json({ changed: true, session: "active" }); }, "Member_0123");
  openForm(harness, "abcdefghij");
  await byType(harness.render(), "form")[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls, [{ new_password: "abcdefghij" }]);
});

test("change form displays the BFF validation message instead of a generic one", async () => {
  const harness = passwordForm(async () => json({ code: "VALIDATION_ERROR", errors: { new_password: passwordMessages.nickname } }, 422), "Member_0123");
  openForm(harness, "abcdefghij");
  await byType(harness.render(), "form")[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(alerts(harness.render()).map((alert) => alert.props.children), [passwordMessages.nickname]);
});

test("registration form shows the hint and the policy on the password field", () => {
  const form = source("components/auth/RegisterForm.tsx");
  assert.match(form, /import \{ passwordHint, passwordPolicyError \} from "@\/lib\/auth\/password"/);
  assert.match(form, /id="register-password-hint">\{passwordHint\}/);
  assert.match(form, /onBlur=\{\(\) => blur\(key\)\}/);
  assert.match(form, /passwordPolicyError\(next\.password, next\.nickname\.trim\(\)\)/);
});

test("login keeps accepting existing passwords of any length", async () => {
  const login = source("components/auth/LoginForm.tsx");
  assert.doesNotMatch(login, /passwordPolicyError|minLength/);
  assert.doesNotMatch(source("app/api/auth/login/route.ts"), /passwordPolicyError|PASSWORD_MIN_LENGTH/);
  const calls = [];
  const csrf = new Response(null, { status: 204, headers: [["Set-Cookie", "XSRF-TOKEN=xsrf%3Dtwo; Path=/"], ["Set-Cookie", "laravel_session=session-two; Path=/"]] });
  const responses = [csrf, json({}), json(longUser)];
  const { POST } = loadAuthRoute("login", async (url, init) => { calls.push({ url, body: init?.body }); return responses.shift(); });
  const response = await POST(new NextRequest("https://chatnet.fr/api/auth/login", { method: "POST", headers: { Origin: "https://chatnet.fr", "Content-Type": "application/json" }, body: JSON.stringify({ login: longUser.nickname, password: "old 6" }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(calls[1].body), { login: longUser.nickname, password: "old 6" });
});

test("hint and error styles use theme tokens and add no fixed widths (dark mode and mobile)", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.field-hint \{ margin: 0; color: var\(--muted\); font-size: 11px; line-height: 1\.45; \}/);
  assert.match(css, /:root\[data-theme="dark"\] \.field-error/);
  assert.equal((css.match(/--muted:/g) ?? []).length >= 2, true);
  const form = source("components/auth/PasswordChangeForm.tsx");
  assert.match(form, /className="profile-edit-grid"/);
  assert.doesNotMatch(form, /style=\{/);
});
