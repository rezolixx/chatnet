// One age policy for registration, profile edits and member chat entry:
// 16 to 120 completed years on today's UTC date, from the profile birthdate.
// Same rule as Laravel's AgePolicy (authoritative) and discut.org. Someone
// born on 29 February has their birthday on 1 March in other years.
export const MIN_AGE = 16;
export const MAX_AGE = 120;

// Laravel's code when chat entry is refused for the profile birthdate.
export const PROFILE_BIRTHDATE_INVALID = "PROFILE_BIRTHDATE_INVALID";

export type BirthdateRefusal = "missing" | "invalid" | "future" | "tooYoung" | "tooOld";

function birthdateNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // setUTCFullYear: Date.UTC would read years 0 to 99 as 1900 to 1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return year * 10000 + month * 100 + day;
}

/** Completed years on now's UTC date; null for a date that does not exist or is after it. */
export function ageFromBirthdate(value: unknown, now = new Date()): number | null {
  const born = birthdateNumber(value);
  if (born === null) return null;
  const today = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  // YYYYMMDD numbers: the difference's ten-thousands are the completed years.
  return born > today ? null : Math.floor((today - born) / 10000);
}

export function isAllowedAge(age: unknown): age is number {
  return typeof age === "number" && Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE;
}

/** Null when the birthdate is accepted, otherwise why not. */
export function birthdateRefusal(value: unknown, now = new Date()): BirthdateRefusal | null {
  if (value === null || value === undefined || value === "") return "missing";
  if (birthdateNumber(value) === null) return "invalid";
  const age = ageFromBirthdate(value, now);
  if (age === null) return "future";
  if (age < MIN_AGE) return "tooYoung";
  if (age > MAX_AGE) return "tooOld";
  return null;
}
