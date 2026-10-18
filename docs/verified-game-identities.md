# Verified game identities (Quiz avatars)

Status: **the Chatnet side is ready and off by default. No player is verified yet**, because the
Game System does not record which services account scored. Until the two changes below ship,
every leaderboard row keeps its initial-letter avatar. That is the correct result.

## Why nicknames are not enough

The Game System (`chatnet-game-system`) uses the IRC nickname as the player's identity
(`players.nickname_normalized`, docs/irc-bot.md § Identité): whoever holds `aYmen` on IRC
gets `aYmen`'s scores, whether or not they are identified to NickServ. The member photo on
`/communaute` belongs to a Laravel `user_profiles` row. The only verified link between that
row and IRC is `user_profiles.irc_account_uniqueid` = Anope `NickCore.uniqueid` (Chat Identity V2).

So "the `aYmen` row of the Quiz is the member `aYmen`" can only be shown by:

1. the services account (`NickCore`) that was logged in when the points were scored, as reported
   by the IRC server, **and**
2. Laravel confirming that this account's current `NickCore.uniqueid` is the one bound to a member.

Laravel already has step 2 (`ChatIdentityService::verifyIrcBinding`, `AnopeAccountRegistry::coreFor`).
**Step 1 is the missing link.** GameBot never asks the server for account information (no
`CAP REQ`), and `score_events` and `players` have no account column. The nickname-based endpoints
`/api/members/{nickname}` and `/api/irc-profile/avatar/{accountName}` (which also matches
`user_profiles.nickname`) are not verification and are not used here.

## Proposed changes (not applied: production-sensitive, need approval)

### A. GameBot and Game API (`chatnet-game-system`)

- On connect, `CAP REQ :account-tag` (production runs UnrealIRCd 6, which supports it). With it,
  the server adds `@account=<NickCore display>` to every PRIVMSG from an identified user.
  Without the tag the user is not identified. This is server-asserted, not user-supplied.
- Migration 004 (additive): nullable `score_events.irc_account VARCHAR(30)`. The winning
  answer's `account` tag goes there, or NULL. No existing row is changed or backfilled.
- `GET /api/leaderboards/:game`: optional `ircAccount` per entry. Set it only when **every**
  scoring event of that player in that game carries the same account. Otherwise it is null,
  for example for history that only has nicknames, mixed accounts, or an unidentified win.
  Historical rows therefore stay unverified until the policy is revisited. Nothing is made up.
- Feature flag (for example `GAME_RECORD_IRC_ACCOUNT`) on the bot. Scoring, ranking and sorting
  stay the same.

### B. Laravel (`chatnet-api`)

`POST /api/internal/games/verified-members`. Server to server, authenticated with the
`X-Chatnet-Games-Identity-Key` header (shared secret, constant-time compare, like the gateway's
internal routes), throttled, and behind a feature flag.

Request: `{ "accounts": ["aYmen", ...] }` (at most 50).
For each account: `AnopeAccountRegistry::coreFor($account)` must be registered and unambiguous.
Exactly one active `user_profiles` row must have `irc_account_uniqueid` equal to that `uniqueid`.
Otherwise the account is left out of the response.

Response, public fields only, never the `uniqueid`, email or token:

```json
{ "members": [{ "account": "aYmen", "nickname": "aYmen", "avatar": "https://…/avatar.webp" }] }
```

`avatar` is `UserProfile::avatarUrl(...)`, the same value that `/api/members/{nickname}` gives
`/communaute`.

The binding is checked on every call, so a stale link (a NickCore dropped and registered again,
or a member unbound or deactivated) disappears within the page's 60-second revalidation.

## Chatnet side (this repository)

- `src/lib/api/game-identities.server.ts`: `getVerifiedLeaderboard(game)`. It reads
  `ircAccount` from the leaderboard on the server, posts the distinct accounts to Laravel and
  attaches `{ verified, nickname, avatar, profileHref }` to the matching rows only.
- Account names, the key and Laravel's answer never reach the browser. Rows, ranks and stats
  are the same as `getLeaderboard`.
- A disabled, failing, slow (2.5 s timeout) or malformed resolver keeps the leaderboard
  available, with initials.
- An answer is ignored when its account was not requested or appears twice, or when its
  nickname cannot make a safe `/membre/…` link. Unsafe avatars become null, so the initial shows.
- Settings (server only):
  - `GAMES_VERIFIED_AVATARS=true` turns the resolver on.
  - `GAMES_IDENTITY_KEY` is the shared secret, at least 32 characters. Without it, the resolver
    stays off.

Rollout: deploy B (flag off), deploy A, check that `ircAccount` appears for an identified test
player, then set both Chatnet settings.
