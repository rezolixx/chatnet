# Verified game identities (Quiz avatars)

Status: **the Game API (commit `64d81487d251`, with the authenticated internal leaderboard) and
the Laravel resolver are deployed. The Chatnet side is merged but off (`GAMES_VERIFIED_AVATARS`
unset). No player is verified yet:** every current leaderboard row has `ircAccount: null`, because
its points were scored before accounts were recorded. Every row therefore keeps its initial-letter
avatar. That is the correct result.

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

## Backend changes (deployed)

### A. GameBot and Game API (`rezolixx/chatnet-game-system`, deployed at `64d81487d251`)

- With `GAME_RECORD_IRC_ACCOUNT=true`, GameBot negotiates `CAP LS 302` →
  `CAP REQ :account-tag` → `CAP END`. Production runs UnrealIRCd 6, which supports it. The server
  then adds `@account=<NickCore display>` to every PRIVMSG from an identified user. The tag is
  set by the server, not by the user, and is read only after the server's `ACK`.
- Migration 004 (additive): a new side table `game_score_event_accounts`
  (`score_event_id` → `irc_account`). It is written in the same transaction as the winning score
  event. There is no `ALTER` on the score ledger and no backfill.
- `GET /internal/leaderboards/:game`, authenticated with `Authorization: Bearer
  <INTERNAL_GAME_API_TOKEN>` (401 without a valid token, 404 when the Game API has no token
  configured), returns the public ranking plus `ircAccount` on each entry. It is set only when
  **every** score event of the row carries the same account and those events add up to the row's
  points. Otherwise it is null, for example for nickname-only history, mixed accounts, or an
  unidentified win. Nothing is made up. The public `GET /api/leaderboards/:game` never carries
  `ircAccount`.
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

- `src/lib/api/game-identities.server.ts`: `getVerifiedLeaderboard(game)`.
  1. The **public** `GET /api/leaderboards/:game` is the only source of the displayed rows, ranks,
     points and stats. Any `ircAccount` it might carry is dropped.
  2. When the feature is on, the server also reads `GET /internal/leaderboards/:game` with
     `Authorization: Bearer <INTERNAL_GAME_API_TOKEN>` (`fetchInternalLeaderboard` in
     `games.server.ts`, 4 s timeout, 60 s revalidation).
  3. An internal account is kept for a public row only when rank, nickname (exact case), points,
     games played and wins are identical on both boards. A score landing between the two requests
     therefore leaves the changed rows unverified instead of shifting a photo onto another player.
  4. The distinct accounts go to Laravel's verified-members endpoint, which matches them by
     `NickCore.uniqueid`, never by nickname. `{ verified, nickname, avatar, profileHref }` is
     attached to the matching rows only.
- Rows with `ircAccount: null` (historical or unverified scores) are never sent to Laravel and
  never get a photo. A member sharing the nickname does not change that.
- The token, account names and Laravel's answer never reach the browser: both modules are
  `server-only`, the token is not a `NEXT_PUBLIC_` variable, it is sent only to the Game API's
  internal route (not to the public route, nor to Laravel), and logs name the failure (`HTTP 401`,
  `INTERNAL_GAME_API_TOKEN missing or invalid`, timeout) but never the token, the header or an
  account.
- A disabled flag, a missing or malformed token, a refused token (401/404), an unavailable, slow or
  malformed internal API, or a failing resolver all keep the public leaderboard available, with
  initials. A failing public leaderboard is reported as before.
- Player pages (`/jeux/joueurs/...`) and their ranks keep using the public leaderboard only.

## Coolify variables (Chatnet.fr application)

Set on the Chatnet (Next.js) application only, as **runtime** variables. None of them may be marked
as a build variable or prefixed `NEXT_PUBLIC_`. Changing them needs a redeploy/restart of the
container.

| Variable | Value | Notes |
|---|---|---|
| `GAME_API_BASE_URL` | Game API origin, e.g. `https://jeux-api.chatnet.fr` | Already set. HTTPS required (HTTP only on localhost). The internal route uses the same origin. |
| `API_BASE_URL` | Laravel API origin | Already set. Hosts `/api/internal/games/verified-members`. |
| `INTERNAL_GAME_API_TOKEN` | **Same value** as the Game API's `INTERNAL_GAME_API_TOKEN` | Secret. 32 to 512 printable ASCII characters, no spaces (`openssl rand -hex 32`). Missing or invalid: no internal call, initials only. |
| `GAMES_IDENTITY_KEY` | **Same value** as Laravel's `GAMES_IDENTITY_KEY` | Secret, at least 32 characters. Sent as `X-Chatnet-Games-Identity-Key`. |
| `GAMES_VERIFIED_AVATARS` | `true` to enable, anything else (or unset) to keep it off | Leave unset until the check below. When off, neither the internal Game API nor Laravel is called. |

Enable, then verify:
1. Set `INTERNAL_GAME_API_TOKEN` and `GAMES_IDENTITY_KEY` (secrets), redeploy. Nothing changes yet.
2. Set `GAMES_VERIFIED_AVATARS=true`, redeploy.
3. Open `/jeux/classement`. Rows stay as before. Rows whose points are all identified wins show
   the member photo. Today, with every row historical, that is none of them.
4. The container logs must not show `[Chatnet Game API] internal leaderboard quiz unavailable`.
   `HTTP 401` means the two tokens differ. `HTTP 404` means the Game API has no token configured.
   `INTERNAL_GAME_API_TOKEN missing or invalid` means the Chatnet value is absent or malformed.
5. Rollback: set `GAMES_VERIFIED_AVATARS=false` (or remove it), redeploy.

## Rollout history

1. Apply migration 004. Deploy the Game System, then set `GAME_RECORD_IRC_ACCOUNT=true` and
   restart GameBot. Its log shows `IRC account-tag enabled`.
2. Deploy Laravel and set `GAMES_IDENTITY_KEY` and `GAMES_VERIFIED_MEMBERS_ENABLED=true`.
3. Set `INTERNAL_GAME_API_TOKEN` on the Game API. Check that the internal route answers 401
   without the token and 200 with it (done for `64d81487d251`).
4. Set the Coolify variables above on Chatnet.

Existing rows, such as aYmen's current points, keep `ircAccount: null`, because their points were
scored before accounts were recorded. A verified photo appears only after a player's points all
come from identified wins. Showing a photo sooner would require a policy decision, for example
"latest win identified", which this design deliberately does not make.
