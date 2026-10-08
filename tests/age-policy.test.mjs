import assert from "node:assert/strict";
import test from "node:test";
import { MAX_AGE, MIN_AGE, PROFILE_BIRTHDATE_INVALID, ageFromBirthdate, birthdateRefusal, isAllowedAge } from "../src/lib/auth/age-policy.ts";
import { hasRefusedBirthdate, projectChatProfile } from "../src/lib/auth/chat-profile.ts";
import { validateProfileUpdate } from "../src/lib/auth/profile-update.ts";
import { validateRegistration } from "../src/lib/auth/registration.ts";

// One 16-120 age policy, as Laravel's AgePolicy: completed years on today's UTC date.
const on = (date) => new Date(`${date}T12:00:00Z`);
const today = on("2026-10-08");

test("bounds and the server code are Laravel's", () => {
  assert.equal(MIN_AGE, 16);
  assert.equal(MAX_AGE, 120);
  assert.equal(PROFILE_BIRTHDATE_INVALID, "PROFILE_BIRTHDATE_INVALID");
});

test("ages 15, 16, 120, 121 and 126 at the exact boundaries", () => {
  for (const [birthdate, age, refusal] of [
    ["2010-10-09", 15, "tooYoung"],
    ["2010-10-08", 16, null],
    ["1906-10-08", 120, null],
    ["1905-10-09", 120, null],
    ["1905-10-08", 121, "tooOld"],
    ["1900-01-01", 126, "tooOld"],
  ]) {
    assert.equal(ageFromBirthdate(birthdate, today), age, birthdate);
    assert.equal(birthdateRefusal(birthdate, today), refusal, birthdate);
    assert.equal(isAllowedAge(age), refusal === null, birthdate);
  }
});

test("29 February birthdays fall on 1 March in common years", () => {
  assert.equal(ageFromBirthdate("2008-02-29", on("2024-02-29")), 16);
  assert.equal(ageFromBirthdate("2008-02-29", on("2024-02-28")), 15);
  assert.equal(ageFromBirthdate("1904-02-29", on("2025-02-28")), 120);
  assert.equal(ageFromBirthdate("1904-02-29", on("2025-03-01")), 121);
  assert.equal(ageFromBirthdate("2012-03-01", on("2028-02-29")), 15);
});

test("invalid, missing and future birthdates", () => {
  for (const value of ["2023-02-29", "1990-13-01", "0000-00-00", "1990-5-15", "15/05/1990", "1990-05-15T00:00:00Z", 19900515, {}]) {
    assert.equal(ageFromBirthdate(value, today), null, String(value));
    assert.equal(birthdateRefusal(value, today), "invalid", String(value));
  }
  for (const value of [undefined, null, ""]) assert.equal(birthdateRefusal(value, today), "missing");
  assert.equal(birthdateRefusal("2026-10-09", today), "future");
  // Two-digit years are real years, not 1900 + n.
  assert.equal(ageFromBirthdate("0050-01-01", today), 1976);
});

test("today is the UTC date", () => {
  assert.equal(ageFromBirthdate("2010-10-08", new Date("2026-10-08T01:30:00+02:00")), 15);
  assert.equal(ageFromBirthdate("2010-10-08", new Date("2026-10-07T23:30:00-07:00")), 16);
});

test("chat profile: refused birthdates are told apart from incomplete or foreign profiles", () => {
  const member = { nickname: "Member_01", birthdate: "1990-05-17", gender: "Femme", pays: "France" };
  for (const birthdate of ["1900-01-01", "2010-10-09", "2027-01-01", "2023-02-29"]) {
    assert.equal(projectChatProfile({ ...member, birthdate }, "Member_01", today), null);
    assert.equal(hasRefusedBirthdate({ ...member, birthdate }, "Member_01", today), true, birthdate);
  }
  assert.equal(projectChatProfile({ ...member, birthdate: "2010-10-08" }, "Member_01", today)?.age, 16);
  assert.equal(projectChatProfile({ ...member, birthdate: "1906-10-08" }, "Member_01", today)?.age, 120);
  for (const [value, nickname] of [[member, "Member_01"], [{ ...member, birthdate: undefined }, "Member_01"], [{ ...member, birthdate: "1900-01-01" }, "Other"], [null, "Member_01"]]) {
    assert.equal(hasRefusedBirthdate(value, nickname, today), false);
  }
});

test("registration refuses ages over 120 with a precise message", () => {
  const valid = { nickname: "Member_01", email: "member@example.com", gender: "Femme", pays: "France", password: "secret1234" };
  for (const [birthdate, message] of [
    ["2010-10-08", undefined],
    ["1906-10-08", undefined],
    ["2010-10-09", "Vous devez avoir au moins 16 ans."],
    ["1905-10-08", "La date de naissance indique un âge de plus de 120 ans. Vérifiez-la."],
    ["1900-01-01", "La date de naissance indique un âge de plus de 120 ans. Vérifiez-la."],
    ["2027-01-01", "Entrez une date de naissance valide."],
    ["2023-02-29", "Entrez une date de naissance valide."],
    ["", "Entrez votre date de naissance."],
  ]) {
    assert.equal(validateRegistration({ ...valid, birthdate }, undefined, today).errors.birthdate, message, birthdate);
  }
});

test("profile edits keep the same rule and message", () => {
  for (const birthdate of ["1900-01-01", "1905-10-08", "2010-10-09", "2027-01-01"]) {
    assert.deepEqual(validateProfileUpdate({ birthdate }, today).errors, { birthdate: "Entrez une date valide pour un membre de 16 à 120 ans." });
  }
  for (const birthdate of ["2010-10-08", "1906-10-08"]) assert.equal(validateProfileUpdate({ birthdate }, today).input?.birthdate, birthdate);
});
