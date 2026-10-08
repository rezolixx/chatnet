# Chatnet website

Public, French-language Next.js site for chatnet.fr. The site uses the official assets already in `public/`.

## Run locally

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run typecheck
npm run build
```

## Integration settings

Copy `.env.example` to `.env.local` and set these values when the official destinations are known:

- `NEXT_PUBLIC_LOGIN_URL`: full HTTPS URL or local path for signing in. Without it, the sign-in action opens `/connexion`.
- `NEXT_PUBLIC_CONTACT_EMAIL`: published support email address. Without it, `/contact` clearly states that contact details are pending.
- `API_BASE_URL`: server-only Laravel origin for public member and registered-channel reads. Defaults to `https://laravel.discut.org`; do not prefix it with `NEXT_PUBLIC_`.
- `CHATNET_CLIENT_IP_SECRET`: server-only, the same value (at least 32 characters) as Laravel's `CHATNET_CLIENT_IP_SECRET`. The sign-in, registration and session-check bridge routes reach Laravel from this server's single address, so without it every visitor shares Laravel's per-address limits (5 sign-ins a minute for the whole site, and one visitor can lock everyone out). With it, they send the visitor's address (the last `X-Forwarded-For` entry, written by the Coolify edge proxy) in `X-Discut-Client-IP` with the secret in `X-Discut-Client-IP-Key`. Unset or shorter: nothing is sent.

The homepage join form requests an origin ticket directly from Laravel in the visitor's browser and opens the Discut webchat in a new tab. The public endpoint constants and URL builder are in `src/lib/chat.ts`. Laravel must authorize the Chatnet origin in both its portal registry and CORS configuration for production origin attribution to work.

Signed-in members join through Chat Identity V2. The click opens a named blank tab, then `POST /api/auth/chat/handoff` (same-origin BFF) derives age, gender and country from the Laravel member profile server-side and asks Laravel `/api/chat/identity/handoff` for a 60-second one-time code. The browser posts that code only in a hidden form body to `https://laravel.discut.org/api/chat/identity/handoff/redeem`, targeted at the opened tab; Laravel sets the 24-hour chat session cookie and redirects to the WebChat, which then signs in with SASL on every connection. When V2 is unavailable (network error or timeout, 403, 404, 409, 422, 429, 5xx), the same tab falls back to the legacy `/api/auth/chat/prepare` token URL for the same room. A 401/419 signs the member out locally instead; an invalid V2 success is an error, never a fallback.

Password recovery starts from the “Mot de passe oublié ?” link on `/connexion`. `/mot-de-passe-oublie` posts `{ email }` from the visitor's browser straight to Laravel `POST /api/forgot-password`, the same public, CSRF-exempt endpoint Discut uses; a same-origin proxy would put every visitor behind Laravel's shared per-IP `throttle:5,1`. Only the HTTP status is read: 200 and 404 (unknown address) show the same generic confirmation, 422 and 429 show fixed messages, and anything else is reported as unavailable. Laravel's email links to Discut's existing `/reset-password/{token}` page, which sets the shared Laravel and NickServ password; Chatnet has no reset page of its own until Laravel can address a Chatnet URL.

The form makes one same-origin request to `/api/location` for an optional Ville / Pays prefill. That route uses Cloudflare's `CF-IPCountry` header and, when available, `CF-IPCity`; it does not call an external geolocation provider. Enable Cloudflare IP Geolocation for country-only values or its visitor-location headers for city values. Without those headers, including on localhost, the field stays empty and editable. The response is private and uncached.

The homepage, community preview, and room directory read Laravel on the Next.js server. Only member nickname/avatar and channel name/topic reach rendered pages; unavailable API data has neutral fallbacks. Game previews remain editorial in `src/lib/games.ts`. No live presence, score, or account API is connected in this site. Legal pages are marked as drafts and excluded from search indexing until verified details are supplied.
