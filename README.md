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

The homepage join form requests an origin ticket directly from Laravel in the visitor's browser and opens the Discut webchat in a new tab. The public endpoint constants and URL builder are in `src/lib/chat.ts`. Laravel must authorize the Chatnet origin in both its portal registry and CORS configuration for production origin attribution to work.

The form makes one same-origin request to `/api/location` for an optional Ville / Pays prefill. That route uses Cloudflare's `CF-IPCountry` header and, when available, `CF-IPCity`; it does not call an external geolocation provider. Enable Cloudflare IP Geolocation for country-only values or its visitor-location headers for city values. Without those headers, including on localhost, the field stays empty and editable. The response is private and uncached.

The homepage, community preview, and room directory read Laravel on the Next.js server. Only member nickname/avatar and channel name/topic reach rendered pages; unavailable API data has neutral fallbacks. Game previews remain editorial in `src/lib/games.ts`. No live presence, score, or account API is connected in this site. Legal pages are marked as drafts and excluded from search indexing until verified details are supplied.
