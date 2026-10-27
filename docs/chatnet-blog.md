# Chatnet.fr blog integration

The Chatnet magazine uses the existing article editor at `https://www.discut.org/admin/articles`.
In that editor, select **chatnet.fr** when creating a new article. It has its own draft,
published and scheduled states; articles belonging to `discut.org` and `tchat.chat`
never appear on Chatnet. The existing `articles` table already has a `site_key` field.

## Public routes

| Route | Purpose |
| --- | --- |
| `/blog` | Searchable, paginated list (six articles per page) |
| `/blog/[slug]` | Article and related reading, JSON-LD, canonical + social metadata |
| `/sitemap.xml` | Existing public URLs plus only published Chatnet blog URLs |

The server fetches public article projections from the shared Laravel API:

- `GET /api/sites/chatnet.fr/articles?page=1&per_page=6&q=...`
- `GET /api/sites/chatnet.fr/articles/{slug}`
- `GET /api/sites/chatnet.fr/sitemap-feed`

`API_BASE_URL` is shared with the rest of Chatnet and defaults to
`https://laravel.discut.org`. It must be a trusted HTTPS origin (local HTTP allowed
for tests); do not set a public browser API token. All requests are server-side,
cookie-free, no-store, and time out after four seconds.

Pages reject a wrong `site_key`, drafts, future-dated posts, invalid slugs or
unsupported body blocks. The body is rendered as React text, never raw HTML.
On an API outage, the listing shows a temporary error and sets noindex;
article detail throws an error instead of returning a misleading 404. A real
unknown or unpublished article is 404. The sitemap retains existing static URLs
if the blog feed is unavailable and only accepts `https://chatnet.fr/blog...` URLs.

## Rollout and verification

1. Deploy `chatnet-api` first (add Chatnet to allowed sites/routes/sitemap).
2. Deploy `discut-frontend` second (shared admin site selector and dashboard rows).
3. Deploy `chatnet` last (public blog navigation, pages, sitemap).
4. Create one **draft** for Chatnet and verify it does not appear publicly.
5. Publish that article; check `/blog`, `/blog/<slug>`, title/canonical, and
   `/sitemap.xml`. Verify the existing Discut and Tchat articles are unchanged.
6. Test scheduled publication and unpublish, search, a second page, image fallback,
   and mobile rendering. Verify a wrong-site slug yields 404.

Local checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
When Turbopack's internal worker cannot open a local socket in a locked-down
CI/test sandbox, `npx next build --webpack` provides an independent production
compiler/typecheck fallback; the deployment's normal build remains unchanged.

No database migration is necessary if the existing multisite-blog migration has
already been applied for Tchat. Do not merge/deploy all three at once without
checking the API is ready; Coolify may deploy `main` automatically.
