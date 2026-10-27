import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseBlogArticle, parseBlogImage, parseBlogPage, parseBlogSitemap, articleReadingMinutes } from "../src/lib/blog/parse.ts";
import { site } from "../src/lib/site.ts";

const origin = "https://laravel.discut.org";
const now = Date.parse("2026-10-27T12:00:00Z");
const row = (overrides = {}) => ({
  site_key: "chatnet.fr", status: "published", slug: "guide-chatnet", title: "Guide Chatnet",
  excerpt: "Guide pour la communauté", image: "/storage/articles/cover.webp", image_alt: "Couverture",
  published_at: "2026-10-26T12:00:00Z", updated_at: "2026-10-27T10:00:00Z",
  seo_title: "Guide officiel Chatnet", seo_description: "Notre guide",
  blocks: [{ type: "heading", level: 2, text: "Bienvenue" }, { type: "paragraph", text: "Bonjour la communauté" }],
  ...overrides,
});

test("Chatnet site is present in public navigation", () => {
  assert.equal(site.nav.find(({ href }) => href === "/blog")?.label, "Blog");
});

test("only public Chatnet projections are accepted", () => {
  const parsed = parseBlogArticle(row(), origin, now);
  assert.equal(parsed?.slug, "guide-chatnet");
  assert.equal(parsed?.seoTitle, "Guide officiel Chatnet");
  assert.equal(parsed?.cover?.src, "https://laravel.discut.org/storage/articles/cover.webp");
  assert.equal(articleReadingMinutes(parsed), 1);
  assert.equal(parseBlogArticle(row({ site_key: "discut.org" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ site_key: "tchat.chat" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ status: "draft" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ published_at: "2026-11-03T00:00:00Z" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ published_at: "invalid" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ slug: "../admin" }), origin, now), null);
  assert.equal(parseBlogArticle(row({ blocks: [{ type: "html", html: "<script>bad</script>" }] }), origin, now), null);
});

test("public body is rendered only from safe structured blocks", () => {
  assert.equal(parseBlogArticle(row({ blocks: [{ type: "heading", level: 1, text: "unsafe" }] }), origin, now), null);
  assert.equal(parseBlogArticle(row({ blocks: [{ type: "table", rows: [{ unsafe: true }], headers: [] }] }), origin, now), null);
  assert.equal(parseBlogArticle(row({ blocks: [{ type: "list", ordered: false, items: ["Bonjour", "Tous"] }] }), origin, now)?.blocks[0].type, "list");
  const source = readFileSync(new URL("../src/components/blog/ArticleBody.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|eval\(/);
});

test("image URLs reject executable schemes, traversal and unapproved paths", () => {
  assert.equal(parseBlogImage("javascript:alert(1)", "", origin), null);
  assert.equal(parseBlogImage("//attacker.test/tracker", "", origin), null);
  assert.equal(parseBlogImage("/admin/debug", "", origin), null);
  assert.equal(parseBlogImage("/storage/articles/a.jpg", "", origin)?.src, `${origin}/storage/articles/a.jpg`);
  assert.equal(parseBlogImage("https://images.example.test/photo.jpg", "External", origin)?.alt, "External");
});

test("rejects mixed-site pages rather than truncating results or leaking pagination", () => {
  assert.deepEqual(parseBlogPage({ data: [row()], total: 1, last_page: 1 }, origin, 1)?.articles.map(({ slug }) => slug), ["guide-chatnet"]);
  assert.equal(parseBlogPage({ data: [row(), row({ site_key: "tchat.chat" })], total: 2, last_page: 1 }, origin, 1), null);
  assert.equal(parseBlogPage({ data: [row()], total: -1, last_page: 1 }, origin, 1), null);
  assert.equal(parseBlogPage({ data: [row()], total: 1, last_page: 1 }, origin, 2)?.valid, false);
});

test("sitemap only accepts Chatnet blog URLs", () => {
  const sitemap = parseBlogSitemap([{ url: "https://chatnet.fr/blog" }, { url: "https://chatnet.fr/blog/guide-chatnet", lastmod: "2026-10-27T00:00:00Z" }]);
  assert.equal(sitemap?.length, 2);
  assert.equal(sitemap?.[1].lastModified?.toISOString(), "2026-10-27T00:00:00.000Z");
  for (const url of ["https://www.discut.org/blog/guide", "https://tchat.chat/blog/guide", "http://chatnet.fr/blog", "https://chatnet.fr/admin", "https://chatnet.fr/blog/../login", "https://chatnet.fr/blog/guide?q=x"]) {
    assert.equal(parseBlogSitemap([{ url }]), null, url);
  }
});

test("SEO and API integration guardrails remain present", () => {
  const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const api = source("lib/blog/api.server.ts");
  assert.match(api, /credentials: "omit"/);
  assert.match(api, /redirect: "error"/);
  assert.match(api, /cache: "no-store"/);
  assert.match(api, /\/api\/sites\/\$\{BLOG_SITE\}/);
  const detail = source("app/blog/[slug]/page.tsx");
  assert.match(detail, /BlogPosting/);
  assert.match(detail, /BreadcrumbList/);
  assert.match(detail, /canonical/);
  const listing = source("app/blog/page.tsx");
  assert.match(listing, /robots: \{ index: false/);
  assert.match(source("app/sitemap.ts"), /blogSitemap/);
});
