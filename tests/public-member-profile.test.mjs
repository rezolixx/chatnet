import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { projectPublicMember, publicMemberHref, publicNickname } from "../src/lib/api/public-member.ts";
import { normalizeMember } from "../src/lib/api/members.ts";
import { indexablePaths } from "../src/lib/seo/indexable.ts";
import { publicMemberModules } from "./helpers/public-member.mjs";

const now = new Date("2026-10-01T12:00:00Z");
const raw = { nickname: "Member_01", avatar: "https://laravel.discut.org/storage/uploads/avatars/member.webp", birthdate: "1990-10-02", gender: "Homme", pays: "France", email: "PRIVATE_EMAIL", password: "PRIVATE_PASSWORD", remember_token: "PRIVATE_TOKEN", id: 123, session: "PRIVATE_SESSION", description: "PRIVATE_DESCRIPTION", created_at: "2020-01-01", last_seen_at: "2026-10-01" };
const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("public profile projects the audited fields, matching Laravel case-insensitive nicknames", () => {
  const member = projectPublicMember(raw, "member_01", now);
  assert.deepEqual(member, { nickname: "Member_01", avatar: raw.avatar, age: 35, gender: "Homme", pays: "France" });
  assert.deepEqual(Object.keys(member).sort(), ["age", "avatar", "gender", "nickname", "pays"]);
  assert.doesNotMatch(JSON.stringify(member), /PRIVATE_|birthdate|email|password|created_at|last_seen_at|"id"/);
});

test("age uses whole calendar years, birthday/leap boundaries, and hides invalid or missing dates", () => {
  assert.equal(projectPublicMember({ ...raw, birthdate: "1990-10-01" }, raw.nickname, now).age, 36);
  assert.equal(projectPublicMember({ ...raw, birthdate: "2000-02-29" }, raw.nickname, new Date("2025-02-28T12:00:00Z")).age, 25);
  assert.equal(projectPublicMember({ ...raw, birthdate: "2000-02-29" }, raw.nickname, new Date("2024-02-28T12:00:00Z")).age, 23);
  for (const birthdate of [null, undefined, "", "not-a-date", "2026-02-30", "2027-10-02", { private: "secret" }]) {
    assert.equal(projectPublicMember({ ...raw, birthdate }, raw.nickname, now).age, null);
  }
});

test("malformed identities and mismatched responses cannot expose another member's data", () => {
  for (const value of [null, [], "secret", {}, { nickname: 123 }, { nickname: "" }, { ...raw, nickname: "Other" }, { ...raw, nickname: "../api/me" }, { data: raw }]) {
    assert.equal(projectPublicMember(value, raw.nickname, now), null);
  }
  const safe = projectPublicMember({ ...raw, gender: { email: "secret" }, pays: ["secret"] }, raw.nickname, now);
  assert.equal(safe.gender, null);
  assert.equal(safe.pays, null);
});

test("shared avatar projection and existing fallback remain safe for absent or invalid URLs", () => {
  assert.deepEqual(normalizeMember(raw), { nickname: raw.nickname, avatar: raw.avatar });
  for (const avatar of [null, "", "javascript:alert(1)", "uploads/avatars/raw.jpg", {}, "https://user:secret@example.com/avatar.png"]) {
    assert.equal(projectPublicMember({ ...raw, avatar }, raw.nickname, now).avatar, null);
  }
});

test("untrusted nickname/path input is rejected before any network call", async () => {
  const { load } = publicMemberModules(async () => { assert.fail("Invalid input triggered a request"); });
  const { getPublicMember } = load("lib/api/public-member.server.ts");
  for (const nickname of [null, [], "", " ", ".", "..", "../api/me", "a/b", "a\\b", "%2fapi%2fme", "a?token=private", "a#private", "a\nsecret", "a\u202esecret", "a".repeat(51)]) {
    assert.equal(publicNickname(nickname), null);
    assert.equal(publicMemberHref(nickname), null);
    assert.equal((await getPublicMember(nickname)).status, "not-found");
  }
  assert.equal(publicMemberHref(" Membre[FR] "), "/membre/Membre%5BFR%5D");
  assert.equal(publicMemberHref("Émilie"), "/membre/%C3%89milie");
});

test("public server fetch uses exactly the discovered endpoint without session headers and returns only safe fields", async () => {
  const calls = [];
  const { load } = publicMemberModules(async (url, init) => { calls.push({ url, ...init }); return json(raw); });
  const result = await load("lib/api/public-member.server.ts").getPublicMember("member_01");
  assert.equal(result.status, "found");
  assert.deepEqual(Object.keys(result.member).sort(), ["age", "avatar", "gender", "nickname", "pays"]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|birthdate|email|password|"id"/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://laravel.discut.org/api/members/member_01");
  assert.deepEqual(plain(calls[0].headers), { Accept: "application/json" });
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].credentials, undefined);
});

test("unknown members trigger Next notFound while provider/malformed failures remain a safe unavailable state", async () => {
  const props = { params: Promise.resolve({ nickname: raw.nickname }) };
  const missing = publicMemberModules(async () => json({ message: "PRIVATE_BACKEND_ERROR" }, 404));
  assert.equal((await missing.load("lib/api/public-member.server.ts").getPublicMember(raw.nickname)).status, "not-found");
  await assert.rejects(missing.load("app/membre/[nickname]/page.tsx").default(props), /NEXT_HTTP_ERROR_FALLBACK;404/);
  for (const response of [json(raw, 500), json({ data: raw }), json({ ...raw, nickname: "Other" })]) {
    const modules = publicMemberModules(async () => response.clone());
    const tree = await modules.load("app/membre/[nickname]/page.tsx").default(props);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /temporairement indisponible/);
    assert.doesNotMatch(html, /PRIVATE_|Member_01|birthdate/);
  }
});

test("public page renders the profile/avatar fallback without private data or edit controls, and sets noindex", async () => {
  const modules = publicMemberModules(async () => json({ ...raw, avatar: null }));
  const page = modules.load("app/membre/[nickname]/page.tsx");
  const props = { params: Promise.resolve({ nickname: raw.nickname }) };
  const html = renderToStaticMarkup(await page.default(props));
  assert.match(html, /Member_01/);
  assert.match(html, /Genre|Homme|Pays|France|Âge/);
  assert.match(html, /aria-hidden="true">M/);
  assert.doesNotMatch(html, /PRIVATE_|1990-10-02|E-mail|Modifier|<form|Description/);
  const metadata = await page.generateMetadata(props);
  assert.deepEqual(plain(metadata.robots), { index: false, follow: true });
  assert.equal(metadata.alternates.canonical, "/membre/Member_01");
  assert.equal(indexablePaths.some((path) => path.startsWith("/membre")), false);
});

test("community cards link to public Chatnet profiles with encoded nicknames, preserving presence and paging", () => {
  const modules = publicMemberModules(async () => { assert.fail("Rendering cards must not fetch"); });
  const { CommunityMembers } = modules.load("components/community/CommunityMembers.tsx");
  const html = renderToStaticMarkup(CommunityMembers({ members: [{ nickname: "Membre[FR]", avatar: null, online: true }], page: 2, hasNext: true, unavailable: false }));
  assert.match(html, /href="\/membre\/Membre%5BFR%5D"/);
  assert.match(html, /aria-label="Voir le profil de Membre\[FR\]"/);
  assert.match(html, /aria-label="En ligne"/);
  assert.match(html, /href="\/communaute"/);
  assert.match(html, /href="\/communaute\?page=3"/);
  assert.doesNotMatch(html, /discut.org\/compte/);
});

test("authenticated profile and join flows remain separate from the public page", () => {
  assert.match(source("app/profil/page.tsx"), /<ProfileContent/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<AvatarEditor/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<ProfileEditForm/);
  assert.match(source("components/auth/ProfileContent.tsx"), /<PasswordChangeForm/);
  assert.doesNotMatch(source("app/membre/[nickname]/page.tsx"), /useAuth|cookies|laravelMe|ProfileContent/);
  assert.match(source("lib/chat.ts"), /https:\/\/chat.discut.org\/chat/);
  assert.match(source("components/community/PublicMemberProfile.tsx"), /member=\{\{ nickname: member.nickname, avatar: member.avatar \}\}/);
});
