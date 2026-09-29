import assert from "node:assert/strict";
import test from "node:test";
import { projectChatProfile } from "../src/lib/auth/chat-profile.ts";
import { buildAuthenticatedChatUrl, buildChatUrl } from "../src/lib/chat.ts";

const member = {
  id: 76,
  nickname: "ExampleUser",
  avatar: "https://laravel.discut.org/images/default-avatar.svg",
  pays: "Tunisie",
  birthdate: "1985-06-29",
  gender: "Homme",
  created_at: "2026-03-24T19:59:22.000000Z",
  last_seen_at: "2026-09-29 16:49:50",
  is_online: true,
  email: "private@example.com",
};

test("projects only safe profile fields and calculates age in UTC", () => {
  const profile = projectChatProfile(member, "ExampleUser", new Date("2026-09-29T23:00:00Z"));
  assert.deepEqual(profile, { nickname: "ExampleUser", avatar: "https://laravel.discut.org/images/default-avatar.svg", age: 41, gender: "Homme", pays: "Tunisie" });
  assert.deepEqual(Object.keys(profile), ["nickname", "avatar", "age", "gender", "pays"]);
  assert.equal(projectChatProfile(member, "ExampleUser", new Date("2026-06-28T23:59:59Z"))?.age, 40);
  assert.equal(projectChatProfile(member, "OtherMember"), null);
  assert.equal(projectChatProfile({ ...member, nickname: "ExampleUser " }, "ExampleUser"), null);
});

test("rejects missing or invalid required chat profile values", () => {
  const now = new Date("2026-09-29T00:00:00Z");
  assert.equal(projectChatProfile({ ...member, birthdate: "1985-02-30" }, "ExampleUser", now), null);
  assert.equal(projectChatProfile({ ...member, gender: "unknown" }, "ExampleUser", now), null);
  assert.equal(projectChatProfile({ ...member, pays: "" }, "ExampleUser", now), null);
  assert.equal(projectChatProfile({ ...member, birthdate: "2011-01-01" }, "ExampleUser", now), null);
  assert.equal(projectChatProfile({ ...member, birthdate: undefined, date_of_birth: "1985-06-29" }, "ExampleUser", now), null);
});

test("guest URL contract stays unchanged", () => {
  const url = buildChatUrl({ nick: "Guest", age: "25", sexe: "F", ville: "Paris" }, "origin-ticket");
  assert.equal(url, "https://chat.discut.org/chat?nick=Guest&age=25&sexe=F&ville=Paris&chatnow=1&ticket=origin-ticket#Accueil");
});

test("authenticated URL uses the existing path and only adds supplied credentials", () => {
  const details = { nick: "ExampleUser", age: "41", sexe: "M", ville: "Tunisie" };
  const url = new URL(buildAuthenticatedChatUrl(details, "one-time-token", "origin-ticket"));
  assert.equal(url.origin + url.pathname, "https://chat.discut.org/chat");
  assert.deepEqual([...url.searchParams], [
    ["nick", "ExampleUser"], ["age", "41"], ["sexe", "M"], ["ville", "Tunisie"],
    ["chatnow", "1"], ["token", "one-time-token"], ["ticket", "origin-ticket"],
  ]);
  assert.equal(url.hash, "#Accueil");
  assert.equal(new URL(buildAuthenticatedChatUrl(details, "one-time-token")).searchParams.has("ticket"), false);
});
