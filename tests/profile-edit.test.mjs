import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectOwnProfile } from "../src/lib/auth/own-profile.ts";
import { profileUpdateField, safeUpstreamProfileErrors, validateProfileUpdate } from "../src/lib/auth/profile-update.ts";

const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const now = new Date("2026-10-01T12:00:00Z");

test("only one supported Laravel profile field is accepted per update", () => {
  assert.deepEqual(validateProfileUpdate({ birthdate: "1990-06-15" }, now).input, { birthdate: "1990-06-15" });
  assert.deepEqual(validateProfileUpdate({ pays: " France " }, now).input, { pays: "France" });
  assert.equal(profileUpdateField({ birthdate: "1990-06-15" }), "birthdate");
  assert.equal(profileUpdateField({ pays: "France" }), "pays");
  for (const input of [null, [], {}, { nickname: "NewName" }, { email: "new@example.com" }, { gender: "Femme" }, { description: "Hidden" }, { pays: "France", role: "admin" }, { pays: "France", birthdate: "1990-06-15" }]) {
    assert.equal(validateProfileUpdate(input, now).input, undefined);
  }
});

test("birthdate keeps the established Chatnet age gate and pays follows Laravel's length rule", () => {
  assert.deepEqual(validateProfileUpdate({ birthdate: "2010-10-02" }, now).errors, { birthdate: "Entrez une date valide pour un membre de 16 à 120 ans." });
  assert.equal(validateProfileUpdate({ birthdate: "2010-10-01" }, now).input?.birthdate, "2010-10-01");
  assert.equal(validateProfileUpdate({ birthdate: "1905-09-30" }, now).input, undefined);
  assert.equal(validateProfileUpdate({ birthdate: "2000-02-30" }, now).input, undefined);
  assert.equal(validateProfileUpdate({ pays: " " }, now).input, undefined);
  assert.deepEqual(validateProfileUpdate({ pays: "Émirats arabes unis" }, now).input, { pays: "Émirats arabes unis" });
  assert.equal(validateProfileUpdate({ pays: "Pays inventé" }, now).input, undefined);
  assert.equal(validateProfileUpdate({ pays: "A".repeat(256) }, now).input, undefined);
});

test("Laravel validation messages are mapped by field without forwarding raw values", () => {
  assert.deepEqual(safeUpstreamProfileErrors({ errors: { pays: ["private SQL value"] }, message: "private SQL value" }, "pays"), { pays: "Pays invalide." });
  assert.deepEqual(safeUpstreamProfileErrors({ errors: { birthdate: ["private DOB"] } }, "birthdate"), { birthdate: "Date de naissance invalide." });
  assert.deepEqual(safeUpstreamProfileErrors({ errors: { email: ["secret"] } }, "pays"), { pays: "Vérifiez ce champ." });
});

test("successful readback can expose only the established safe own-profile projection", () => {
  const me = { nickname: "Member_01", email: "member@example.com", avatar: "https://laravel.discut.org/avatar.png", birthdate: "1990-06-15", pays: "France", description: "Private profile text", inscritDepuis: "01/01/2020", id: 99, password: "secret" };
  const member = { nickname: "Member_01", gender: "Femme", id: 99, irc_password: "secret" };
  const result = projectOwnProfile(me, member, "Member_01");
  assert.equal(result?.pays, "France");
  assert.equal(result?.birthdate, "1990-06-15");
  assert.deepEqual(Object.keys(result ?? {}).sort(), ["avatar", "birthdate", "description", "email", "gender", "inscritDepuis", "nickname", "pays"]);
  assert.equal(projectOwnProfile(me, { ...member, nickname: "Other" }, "Member_01"), null);
});

test("BFF gates guests and origins, forwards allowlisted fields, and projects the response", () => {
  const route = source("app/api/auth/profile/update/route.ts");
  assert.match(route, /hasTrustedOrigin\(request\)/);
  assert.match(route, /readBridgeCookies\(request\)/);
  assert.match(route, /if \(!cookies\) return unauthenticated\(\)/);
  assert.match(route, /clearBridgeCookies\(response\)/);
  assert.match(route, /await laravelMe\(cookies\)/);
  assert.match(route, /request\.headers\.get\("x-chatnet-profile-nickname"\) !== user\.nickname/);
  assert.match(route, /validateProfileUpdate\(value\)/);
  assert.match(route, /fetchLaravel\(field === "birthdate" \? "\/api\/update-birthdate" : "\/api\/update-pays"/);
  assert.match(route, /body: JSON\.stringify\(input\)/);
  assert.match(route, /safeUpstreamProfileErrors\(raw, field\)/);
  assert.match(route, /projectOwnProfile\(me, await member\.json\(\), user\.nickname\)/);
  assert.match(route, /NextResponse\.json\(\{ profile \}/);
  assert.doesNotMatch(route, /JSON\.stringify\(value\)|NextResponse\.json\(await upstream\.json\(\)/);
});

test("edit UI has only birthdate and pays; description and avatar behavior remain unchanged", () => {
  const editor = source("components/auth/ProfileEditForm.tsx");
  const profile = source("components/auth/ProfileContent.tsx");
  const avatar = source("components/auth/AvatarEditor.tsx");
  assert.match(profile, /<AvatarEditor/);
  assert.match(profile, /<ProfileEditForm/);
  assert.match(profile, /Modifier/);
  assert.match(editor, /save\("birthdate"\)/);
  assert.match(editor, /save\("pays"\)/);
  assert.match(editor, /"X-Chatnet-Profile-Nickname": profile\.nickname/);
  assert.match(editor, /await refreshUser\(\)/);
  assert.doesNotMatch(editor, /new_email|description|nickname.*onChange|gender.*onChange|update-avatar/);
  assert.doesNotMatch(profile, /profile\.description|<h3>Description<\/h3>/);
  assert.match(avatar, /fetch\("\/api\/auth\/avatar"/);
});
