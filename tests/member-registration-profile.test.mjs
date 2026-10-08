import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registrationCountries } from "../src/lib/auth/countries.ts";
import { projectOwnProfile } from "../src/lib/auth/own-profile.ts";
import { registrationFailure, upstreamRegistrationConflict, upstreamRegistrationErrors, validateRegistration } from "../src/lib/auth/registration.ts";
import { indexablePaths } from "../src/lib/seo/indexable.ts";

const valid = { nickname: "Member_01", email: "member@example.com", birthdate: "1990-06-15", gender: "Femme", pays: "France", password: "secret1234" };
const now = new Date("2026-09-30T12:00:00Z");
const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("registration forwards a validated allowlist and no confirmation or arbitrary fields", () => {
  const result = validateRegistration({ ...valid, nickname: " Member_01 ", email: " member@example.com ", role: "admin", confirmPassword: "secret1234" }, undefined, now);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.input, valid);
  assert.deepEqual(Object.keys(result.input), ["nickname", "email", "birthdate", "gender", "pays", "password"]);
  assert.equal(result.input.pays, "France");
  assert.equal(Object.hasOwn(result.input, "country"), false);
});

test("selected pays uses the canonical Discut labels within the Laravel limit", () => {
  assert.equal(registrationCountries.length, 251);
  assert.equal(new Set(registrationCountries).size, registrationCountries.length);
  assert.ok(registrationCountries.every((name) => name.length <= 100));
  assert.ok(registrationCountries.includes("France"));
  assert.ok(registrationCountries.includes("Émirats arabes unis"));
  assert.deepEqual(validateRegistration({ ...valid, pays: "Émirats arabes unis", country: "Other" }, undefined, now).input?.pays, "Émirats arabes unis");
  assert.ok(validateRegistration({ ...valid, pays: "Invented Country" }, undefined, now).errors.pays);
  const form = source("components/auth/RegisterForm.tsx");
  assert.match(form, /<select id="register-pays" name="pays"/);
  assert.match(form, /sortedCountries\.map\(\(name\) => <option key=\{name\} value=\{name\}>/);
});

test("registration preserves the Discut public rules and rejects malformed input", () => {
  assert.equal(validateRegistration(null).input, undefined);
  assert.ok(validateRegistration({ ...valid, nickname: "a-b" }, undefined, now).errors.nickname);
  assert.ok(validateRegistration({ ...valid, nickname: "abc" }, undefined, now).errors.nickname);
  assert.ok(validateRegistration({ ...valid, birthdate: "2010-10-01" }, undefined, now).errors.birthdate);
  assert.ok(validateRegistration({ ...valid, birthdate: "2000-02-30" }, undefined, now).errors.birthdate);
  assert.ok(validateRegistration({ ...valid, password: "12345" }, undefined, now).errors.password);
  assert.ok(validateRegistration({ ...valid, gender: "" }, undefined, now).errors.gender);
  assert.ok(validateRegistration({ ...valid, pays: "" }, undefined, now).errors.pays);
});

test("client validation rejects password confirmation mismatch", () => {
  assert.equal(validateRegistration(valid, "different", now).input, undefined);
  assert.ok(validateRegistration(valid, "different", now).errors.confirmPassword);
});

test("Laravel field validation is mapped by key, never by raw personal data", () => {
  assert.deepEqual(upstreamRegistrationErrors({ errors: { email: ["private@example.com SQL error"], password: ["raw password"] }, message: "private@example.com" }), {
    email: "Cette adresse e-mail est invalide ou indisponible.", password: "Le mot de passe doit contenir au moins 10 caractères, sans espaces.",
  });
  assert.deepEqual(upstreamRegistrationConflict({ message: "Cet email est déjà utilisé." }), { email: "Cette adresse e-mail est déjà utilisée." });
  assert.deepEqual(upstreamRegistrationConflict({ message: "Ce pseudo existe déjà, choisis un autre pseudo." }), { nickname: "Ce pseudo est déjà utilisé." });
  assert.deepEqual(upstreamRegistrationConflict({ message: "SQL user private@example.com" }), {});
});

test("registration status mapping keeps conflict, validation, rate limit and session errors safe", () => {
  assert.deepEqual(registrationFailure(409, { message: "SQL private@example.com" }), { status: 409, code: "CONFLICT", message: "Ce pseudo ou cet e-mail est déjà utilisé.", errors: {} });
  assert.deepEqual(registrationFailure(422, { errors: { birthdate: ["private DOB"] } }), { status: 422, code: "VALIDATION_ERROR", message: "Vérifiez les champs du formulaire.", errors: { birthdate: "Vérifiez votre date de naissance." } });
  assert.equal(registrationFailure(429).code, "RATE_LIMITED");
  assert.equal(registrationFailure(419).code, "SESSION_EXPIRED");
  assert.deepEqual(registrationFailure(500, { message: "raw Laravel error" }), { status: 503, code: "UNAVAILABLE", message: "Inscription temporairement indisponible." });
});

const me = { nickname: "Member_01", email: "private@example.com", avatar: "https://laravel.discut.org/a.png", birthdate: "1990-06-15", pays: "France", description: "Bonjour", inscritDepuis: "15/06/2020", password: "secret", irc_password: "irc-secret", id: 44, last_seen_at: "yesterday" };
const member = { nickname: "Member_01", gender: "Femme", email: "someone-else@example.com", id: 999, password: "another-secret" };

test("own profile requires exact session nickname on both Laravel responses", () => {
  assert.equal(projectOwnProfile(me, member, "Other"), null);
  assert.equal(projectOwnProfile(me, { ...member, nickname: "Other" }, "Member_01"), null);
  assert.equal(projectOwnProfile({ ...me, nickname: "member_01" }, member, "Member_01"), null);
});

test("own profile exposes only verified account fields, using email from /api/me", () => {
  assert.deepEqual(projectOwnProfile(me, member, "Member_01"), {
    nickname: "Member_01", email: "private@example.com", avatar: "https://laravel.discut.org/a.png", birthdate: "1990-06-15", gender: "Femme", pays: "France", description: "Bonjour", inscritDepuis: "15/06/2020",
  });
  assert.equal(projectOwnProfile({ ...me, avatar: "javascript:alert(1)" }, member, "Member_01")?.avatar, null);
});

test("registration BFF keeps the session handshake and safe upstream diagnostics", () => {
  const register = source("app/api/auth/register/route.ts");
  const profile = source("app/api/auth/profile/route.ts");
  assert.match(register, /hasTrustedOrigin\(request\)/);
  assert.match(register, /maxBytes = 4096/);
  assert.match(register, /size > maxBytes/);
  // A fresh handshake (no current cookies); only the visitor request is passed.
  assert.match(register, /csrfCookies\((?:undefined, request)?\)/);
  assert.match(register, /xsrfHeader\(cookies\)/);
  assert.match(register, /upstreamCookieHeader\(cookies\)/);
  assert.match(register, /"\/api\/register"/);
  assert.match(register, /body: JSON\.stringify\(input\)/);
  assert.match(register, /registrationFailure\(upstream\.status, body\)/);
  assert.match(register, /upstream\.status !== 201/);
  assert.match(register, /X-Chatnet-Register-Upstream-Status/);
  assert.match(register, /String\(upstreamStatus\)/);
  assert.match(register, /responseHeaders\(upstream\.status\)/);
  assert.doesNotMatch(register, /setBridgeCookies|console\.|logger\.|localStorage|sessionStorage/);
  assert.match(profile, /laravelMe\(cookies\)/);
  assert.match(profile, /encodeURIComponent\(user\.nickname\)/);
  assert.match(profile, /projectOwnProfile\(me, await member\.json\(\), user\.nickname\)/);
  assert.match(profile, /clearBridgeCookies\(response\)/);
  assert.doesNotMatch(profile, /export async function PUT/);
});

test("guest navbar exposes login, signup and chat while member controls remain separate", () => {
  const navbar = source("components/layout/Navbar.tsx");
  const css = source("app/globals.css");
  assert.match(navbar, /: user\s*\? <div className="nav-account">/);
  assert.match(navbar, /: <div className="nav-guest"><Link href="\/connexion"/);
  assert.match(navbar, /<Link href="\/inscription" className="button button-outline nav-signup"/);
  assert.match(navbar, /<ActionLink href=\{joinHref\} className="button button-primary nav-join">Rejoindre Chatnet/);
  assert.match(navbar, /<div className="nav-auth-mobile">\{accountAction\}<\/div>/);
  assert.match(css, /\.nav-auth-mobile \.nav-guest \{ display: grid/);
  assert.match(source("components/auth/LoginForm.tsx"), /href="\/inscription">Créer un compte/);
  assert.match(source("components/auth/RegisterForm.tsx"), /href="\/connexion">Se connecter/);
});

test("private pages stay outside sitemap and IndexNow paths", () => {
  assert.equal(indexablePaths.includes("/inscription"), false);
  assert.equal(indexablePaths.includes("/profil"), false);
  assert.match(source("app/inscription/page.tsx"), /robots: \{ index: false, follow: true \}/);
  assert.match(source("app/profil/page.tsx"), /robots: \{ index: false, follow: true \}/);
});
