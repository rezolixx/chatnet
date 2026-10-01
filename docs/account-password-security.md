# Chatnet account security: password change

## Plan

Audit Discut/Laravel read-only, reuse its existing production-facing contract, add only the Chatnet form/BFF, validate, and open a PR. No backend, Anope, database, login, registration, avatar, Webchat, or public-profile changes; no merge or deployment.

Base: latest remote `main`, `708a094b37132894df5db9c42b53ac8c31663499`, fetched on 2026-10-01. Branch: `codex/account-password-security`.

## Existing contract (source audit)

Discut `frontend/src/app/parametres/page.js:254` calls **PUT https://laravel.discut.org/api/update-password** through `src/lib/axiosConfig.js` (credentials and XSRF enabled). Its JSON body has exactly one field: `new_password`. The settings UI has one new-password input, a confirmation-of-action modal (not a second password), a six-character client check, and an explicit frontend logout 1.5 seconds after success.

Laravel `backend/routes/api.php:80` maps this route to `AccountController::updatePassword` with `auth:sanctum`. `RouteServiceProvider` adds `/api`; API middleware includes stateful Sanctum and `throttle:api` (60 requests/minute per user or IP). The default web guard uses the `UserProfile` session provider. Stateful cookie requests require a recognized frontend origin, the Laravel session cookie, and valid `X-XSRF-TOKEN`/`XSRF-TOKEN`. This route is not exempt from CSRF. Sanctum can also authenticate bearer tokens; Chatnet uses its existing HttpOnly cookie bridge, not bearer tokens supplied by the browser.

The controller's only validation rule is **`new_password: required|string|min:6`**. No current-password check, confirmation rule, `confirmed`, complexity rule, or maximum length exists here. Other request fields are not validated or used by this action. Global `TrimStrings` excludes `current_password`, `password`, and `password_confirmation`, but not `new_password`; leading/trailing whitespace is therefore trimmed before validation and saving. Empty strings become null.

Exact controller responses:

| Status | JSON |
| --- | --- |
| 200 | `{"message":"Mot de passe mis a jour avec succes."}` |
| 401, controller fallback | `{"message":"Utilisateur non authentifie."}` |
| 422 | `{"message":"Donnees invalides.","errors":{"new_password":["<Laravel validation message(s)>"]}}` |
| 502, Anope error | `{"message":"Erreur lors de la mise a jour du mot de passe IRC (XML-RPC)."}` |
| 500, Anope exception | `{"message":"Erreur lors de la mise a jour du mot de passe IRC."}` |
| 500, local transaction exception | `{"message":"Erreur lors de la mise a jour locale du mot de passe."}` |

`errors` is exactly `$e->errors()`, not a custom string or boolean. Source config uses English; no local validation language override was found. Locked Laravel 10.48.29's default messages, with its default attribute formatter, are:

- Required: `The new password field is required.`
- String: `The new password field must be a string.`
- Minimum: `The new password field must be at least 6 characters.`

These are source-derived defaults, not a captured production response; deployed locale/overrides are unverified. Normal JSON authentication middleware rejection precedes the controller and uses `401 {"message":"Unauthenticated."}`. CSRF mismatch is framework HTTP 419; throttling is HTTP 429. Their exact deployed bodies/debug metadata were not captured and are not forwarded by Chatnet.

On success the existing controller normally calls Anope `SET PASSWORD`, then writes the hashed `user_profiles.password` and encrypted IRC credential inside a transaction. `PASSWORD_UPDATE_SKIP_ANOPE` can disable the existing Anope step. Chatnet does not change that toggle or call Anope directly. Anope succeeds before the local transaction: a later local failure can leave inconsistent credentials; this existing risk is unchanged and BFF failures do not trigger automatic retries. The older sibling `api` snapshot has the same endpoint/fields/results but additional exception/upstream-error logging; it was inspected read-only and was not modified. Production deployment equivalence to either local snapshot was not verified.

## Session behavior

The password controller does not explicitly logout, invalidate/rotate the session, revoke Sanctum tokens, update remember tokens, or delete other sessions.

However, `backend/config/sanctum.php:29` enables **Sanctum AuthenticateSession**. The locked version is 3.3.3. Its stateful-request middleware stores `password_hash_web`; a later request comparing that stored hash with the current user hash logs out that device, flushes the session, and returns 401 on mismatch. The controller updates via `DB::table`, leaving the request's authenticated model at the old hash, so its own stateful session also retains the old hash. Under this configured stateful path, the next request is rejected. Other sessions already carrying the old hash are rejected when next used; there is no blanket session-table/token deletion. This is a source-based conclusion, not a live password-change test.

Official sources checked against the lockfile: [Sanctum AuthenticateSession 3.3.3](https://github.com/laravel/sanctum/blob/v3.3.3/src/Http/Middleware/AuthenticateSession.php), [stateful middleware](https://github.com/laravel/sanctum/blob/v3.3.3/src/Http/Middleware/EnsureFrontendRequestsAreStateful.php), [Laravel validation messages](https://github.com/laravel/framework/blob/v10.48.29/src/Illuminate/Translation/lang/en/validation.php), [exception handler](https://github.com/laravel/framework/blob/v10.48.29/src/Illuminate/Foundation/Exceptions/Handler.php).

The source default stateful domain list does not include `chatnet.fr`; the existing bridge already sends that Origin and requires production `SANCTUM_STATEFUL_DOMAINS` configuration. Production recognition, session expiry, provider availability, and cookies remain unverified. No production account password was changed during this work.

The separate Breeze **PUT /password** accepts `current_password`, `password`, and `password_confirmation`, under web auth/CSRF, with `required|current_password` and `required|Password::defaults()|confirmed`. Success is a redirect with session status `password-updated`, not the Discut JSON contract. It only updates the Laravel model password and omits IRC credential/Anope synchronization, so it is not substituted for the Discut endpoint.

## Files inspected

Paths below are relative to `projet chatnet` except where stated:

- `backend/routes/{api,web,auth}.php`
- `backend/app/Http/Controllers/Api/{AccountController,LogoutController}.php`
- `backend/app/Http/Controllers/Auth/PasswordController.php`
- `backend/app/Http/Kernel.php`
- `backend/app/Http/Middleware/{Authenticate,TrimStrings,VerifyCsrfToken}.php`
- `backend/app/Exceptions/Handler.php`
- `backend/app/Providers/{RouteServiceProvider,AuthServiceProvider}.php`
- `backend/app/Models/UserProfile.php`
- `backend/config/{auth,sanctum,app}.php`, `backend/composer.{json,lock}`
- Sibling `../frontend/src/app/parametres/page.js` and `../frontend/src/lib/axiosConfig.js`
- Sibling `../api/routes/api.php` and `../api/app/Http/Controllers/Api/AccountController.php`
- Chatnet `src/lib/auth/{cookies.server,laravel.server,origin.server,types}.ts`
- Chatnet auth login/me/profile-update routes, AuthProvider, ProfileContent, ProfileEditForm, AvatarEditor, `/profil` and `/connexion` pages, profile CSS, existing account tests, package/TypeScript configuration.

## Implementation summary

The user confirmed using the existing contract with a new-password field and local confirmation, omitting an unverifiable current-password input. `/profil` now reuses the profile panel/field/button styles. Passwords remain in ephemeral component state, are cleared after each submitted attempt, and are never logged, persisted, placed in URLs, or returned.

**POST /api/auth/password** requires trusted Origin, both bridge cookies, verified Laravel `/api/me` identity, and the existing profile nickname header (rejecting stale account identity). It rejects unknown fields, bounds JSON to 8 KiB and password length to 1024 UTF-16 units as Chatnet transport limits, refreshes CSRF, and forwards only `{new_password}` using the existing **PUT** contract. It preserves upstream cookie rotation through HttpOnly bridge cookies and projects errors to fixed messages. The mutation disallows redirects and never retries. Network/provider/local failures return an unconfirmed outcome without exposing upstream data.

After confirmed HTTP 200, a `/api/me` read distinguishes active, expired, or temporarily unverifiable sessions. Expiration clears the bridge and sends the user to a dedicated confirmation page with a reconnection link; the full navigation resets stale client auth state without modifying login. A still-active session is retained. A failed follow-up read preserves confirmed password success and does not invent a logout.

Files changed: `src/lib/auth/password.ts`, `src/app/api/auth/password/route.ts`, `src/components/auth/PasswordChangeForm.tsx`, `src/components/auth/ProfileContent.tsx` (import and mount only), `src/app/profil/securite/confirme/page.tsx`, `tests/password-change.test.mjs`, `tests/helpers/auth-route.mjs`, and this audit.

Tests execute the actual Next routes and bridge helpers with mocked upstream fetch; no live credentials, Anope commands, or database writes. Coverage includes guest/forged-session/Origin refusal, unknown fields, exact forwarding, CSRF/cookie rotation, stale identity, safe 422/success/failure payloads, session expiration/retention, no mutation retries, and existing login/me behavior. Existing avatar/profile tests are retained.

Validation: `npm test` passed 44 tests (13 new password/security tests); `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The build used the existing member/channel fallback when upstream fetches were unavailable. Node's existing module-type warnings remain. Live authenticated/browser password-change behavior was not verified with a production account.

Backend changes = 0; database/schema/development data changes = 0; merge = 0; deployment = 0. This account request path adds no streaming, buffering, goroutines, or real-time pipeline changes.
