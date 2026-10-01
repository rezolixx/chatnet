# Public Chatnet member profile

## Read-only audit

The implementation starts at `origin/main` commit `0a7927c105086226fd9d97db42376491811d3218` (2026-10-01). Only this Chatnet repository is changed.

### Existing Laravel contract

Inspected sibling `../backend/routes/api.php`, `app/Http/Controllers/MemberController.php`, `app/Models/UserProfile.php` and `app/Http/Controllers/AuthController.php`. Also compared the member controller in the older Discut `../../api` application.

- Existing unauthenticated routes: **GET `/api/members`** and **GET `/api/members/{nickname}`**. No new endpoint or authenticated `/api/me` lookup is introduced.
- `MemberController::showByNickname` trims and lowercases the nickname, performs a bound case-insensitive lookup, and uses `firstOrFail()`.
- Success returns the `UserProfile` model directly, with normalized `avatar` and computed `is_online`. `UserProfile` hides `password` and `remember_token`, but does not hide all other account fields. Chatnet must therefore explicitly project this response.
- Missing member: HTTP 404, `{"message":"Utilisateur non trouvé"}`. Internal failure: HTTP 500, `{"message":"Erreur interne du serveur."}`. Neither upstream message nor raw object is forwarded to the page.
- The list selects `id`, `nickname`, `avatar`, `pays`, `birthdate`, `gender`, `created_at` and `last_seen_at`, and returns Laravel pagination.

### Existing Discut behavior

Inspected `../../frontend/src/app/compte/[nickname]/page.js` and its `layout.tsx`. The public route is `/compte/[nickname]`; the page requests `/members/${nickname}` relative to its configured Laravel API base (line 218). It shows nickname, avatar, age, gender and country. Lines 76–86 calculate whole-year age using `dayjs().diff(dayjs(birthdate), 'year')`, with invalid/negative values omitted. Leap-day anniversary behavior was checked against the existing installed Dayjs: February 29 birthdays reach the next whole year on February 28 in a non-leap year.

Description is optional in Discut, not required by the public contract, so this page omits it. Discut uses `noindex, follow` for member profiles.

### Chatnet conventions

Inspected `src/lib/api/{client.server,community.server,types}.ts`, `src/components/community/{CommunityMembers,MemberAvatar}.tsx`, `src/app/{layout,communaute/page,profil/page}.tsx`, `src/components/auth/ProfileContent.tsx`, `src/app/globals.css`, `src/lib/seo/indexable.ts` and `src/lib/chat.ts`.

The existing server-only API helper uses the configured Laravel origin, an Accept header, and a bounded timeout. Public community members previously exposed nickname/avatar only. This change shares that existing normalization, preserves community pagination/presence and reuses `MemberAvatar` and the authenticated profile's responsive card styles. `/profil` remains unchanged; its `noindex, follow` policy is reused. Member URLs are not added to the public sitemap/IndexNow path list.

### External WebChat integration (deferred)

WebChat is a separate Next.js application at `../../webchat`, outside this Chatnet repository. No WebChat files are changed.

- `../../webchat/src/app/chat/page.jsx:1797–1826`: `handleToggleProfileSidebar` toggles the profile sidebar and requests WHOIS for a registered nickname when cached data is stale.
- `page.jsx:4794`: nickname click calls that handler. `page.jsx:4879`: mounts `ProfileSidebar`.
- **`../../webchat/src/app/chat/components/ProfileSidebar.js:220–223`**: the account/nickname guard wraps the existing external profile anchor, `https://www.discut.org/compte/${data.nick || nick}`, labeled `Voir le profil discut.org`, with `target="_blank"` and `rel="noopener noreferrer"`.

A future WebChat-only change should use `https://chatnet.fr/membre/${encodeURIComponent(data.nick || nick)}` and label `Voir le profil Chatnet`, retaining that guard, target/rel, WHOIS/cache logic, nick selection, room/presence/authentication and join behavior.

## Implementation and privacy boundary

New public route: **`/membre/[nickname]`**. It requires no Chatnet session. The detail lookup is server-side and uncached so an unknown/deleted member does not reuse a cached profile. Incoming cookies/authorization are not forwarded.

Exactly these fields can reach the public view: **`nickname`, `avatar`, `age`, `gender`, `pays`**. `age` is calculated server-side from a valid date-only `birthdate`, using UTC calendar anniversaries and Discut's whole-year/leap-day behavior. The exact birthdate, email, passwords, sessions/tokens, IDs, description, timestamps and all other raw fields are discarded. Optional malformed fields become the existing neutral fallback. Avatar normalization reuses the community helper; detail avatars additionally reject credentials in URLs and oversized values. The avatar client component receives only nickname/avatar.

Nickname segments are trimmed and bounded to 50 Unicode code points, matching the current auth contract's maximum, without imposing new registration rules on legacy nicknames. Separators, encoded-segment ambiguity and control/format characters are rejected before fetching. Valid names are URL-encoded; the returned identity must match case-insensitively. Invalid inputs and Laravel 404 use Next `notFound()` with neutral copy. Malformed or unavailable upstream responses show a neutral temporary-unavailable state. There is no route loading boundary that could prematurely stream HTTP 200 before a missing-member lookup completes.

Community cards link to the new route, retain online indicators/pagination, and gain a visible keyboard focus outline. Unsafe legacy names remain non-link cards. No edit controls or Description field are rendered.

## Changed files

- `src/app/membre/[nickname]/{page,not-found}.tsx`: server page, metadata, neutral 404.
- `src/components/community/PublicMemberProfile.tsx`: public card.
- `src/components/community/CommunityMembers.tsx`: native profile links.
- `src/lib/api/{members,public-member,public-member.server}.ts`: shared normalization, allowlist/input/age projection and public lookup.
- `src/lib/api/community.server.ts`: reuse/re-export normalization with existing behavior.
- `src/app/globals.css`: focus outline only.
- `tests/helpers/public-member.mjs`, `tests/public-member-profile.test.mjs`: focused coverage.
- This audit document.

## Validation

- `npm test`: **59 passed**, including 10 new public-profile tests (projection/privacy, malformed data, avatar fallback, dates/leap boundaries, unsafe segments/no request, exact public request, 404/unavailable behavior, rendered page/noindex, community links and authenticated-profile separation).
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`: passed. Build's existing public data fallback warnings occurred when the external API was unavailable in the validation environment; no live-production availability claim is made.
- Local production-server checks with a mock Laravel HTTP API: public detail 200; missing and invalid segments 404; upstream failure/malformed identity neutral; community profile link present. Synthetic private fields and exact birthdate did not appear in HTML/RSC output. Incoming synthetic cookies and authorization were absent from upstream requests.
- Browser inspection at 1440×900 and 390×844: profile fits the page without horizontal overflow; details switch to one column on mobile; initial avatar fallback renders.
- Diff comparison against `origin/main` confirms `/profil`, auth components/routes/library, `MemberAvatar`, join URL and Chatnet chat components are unchanged.

Backend changes = **0**. Database changes = **0**. Anope changes = **0**. WebChat changes = **0**. Merge = **0**. Deployment = **0**.
