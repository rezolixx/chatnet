# Verified game identities (Quiz avatars)

Status: **all three parts are written, but none is merged or deployed. No player is verified
yet.** Until the Game System and Laravel changes below ship and their flags are on, every
leaderboard row keeps its initial-letter avatar. That is the correct result.

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

## Backend changes (on their own branches, not merged)

### A. GameBot and Game API (`rezolixx/chatnet-game-system`, branch `feat/verified-game-identities`)

- With `GAME_RECORD_IRC_ACCOUNT=true`, GameBot negotiates `CAP LS 302` →
  `CAP REQ :account-tag` → `CAP END`. Production runs UnrealIRCd 6, which supports it. The server
  then adds `@account=<NickCore display>` to every PRIVMSG from an identified user. The tag is
  set by the server, not by the user, and is read only after the server's `ACK`.
- Migration 004 (additive): a new side table `game_score_event_accounts`
  (`score_event_id` → `irc_account`). It is written in the same transaction as the winning score
  event. There is no `ALTER` on the score ledger and no backfill.
- With `GAME_API_EXPOSE_IRC_ACCOUNT=true`, `GET /api/leaderboards/:game` adds `ircAccount` to
  each entry. It is set only when **every** score event of the row carries the same account and
  those events add up to the row's points. Otherwise it is null, for example for nickname-only
  history, mixed accounts, or an unidentified win. Nothing is made up.
- Both flags are ignored, with a log line, until 004 is applied. Scoring, ranking and sorting
  are unchanged.

### B. Laravel (`rezolixx/chatnet-api`, branch `feat/games-verified-members`)

`POST /api/internal/games/verified-members`. Server to server, authenticated with the
`X-Chatnet-Games-Identity-Key` header (a shared secret of at least 32 characters, compared in
constant time), throttled to 120 requests a minute. It returns 404 while
`GAMES_VERIFIED_MEMBERS_ENABLED` is off.

Request: `{ "accounts": ["aYmen", ...] }` (at most 50).
For each account, `AnopeAccountRegistry::coreFor($account)` must be registered and unambiguous.
Exactly one profile must have `irc_account_uniqueid` equal to that `uniqueid`, and it must not be
disabled, suspended or banned. Otherwise the account is left out. Details are in that
repository's `docs/games-verified-members.md`.

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

Rollout, with each step switched off until the next one is ready:
1. Apply migration 004. Deploy the Game System, then set `GAME_RECORD_IRC_ACCOUNT=true` and
   restart GameBot. Its log shows `IRC account-tag enabled`.
2. Deploy Laravel and set `GAMES_IDENTITY_KEY` and `GAMES_VERIFIED_MEMBERS_ENABLED=true`.
3. Set `GAME_API_EXPOSE_IRC_ACCOUNT=true`. Check that `ircAccount` appears once an identified test
   player has scored.
4. Set `GAMES_VERIFIED_AVATARS=true` and the same `GAMES_IDENTITY_KEY` on Chatnet.

Existing rows, such as aYmen's current points, keep `ircAccount: null`, because their points were
scored before accounts were recorded. A verified photo appears only after a player's points all
come from identified wins. Showing a photo sooner would require a policy decision, for example
"latest win identified", which this design deliberately does not make.
