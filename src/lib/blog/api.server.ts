import "server-only";
import { apiBaseUrl, logApiFailure } from "@/lib/api/client.server";
import { BLOG_SLUG, BLOG_SITE, parseBlogArticle, parseBlogPage, parseBlogSitemap } from "./parse";
import type { BlogArticle, BlogPage } from "./types";

function blogApiOrigin(): string {
  return apiBaseUrl();
}

async function getBlogApi(path: string): Promise<{ payload: unknown; origin: string } | null> {
  const origin = blogApiOrigin();
  const response = await fetch(`${origin}/api/sites/${BLOG_SITE}${path}`, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Blog API HTTP ${response.status}`);
  return { payload: await response.json() as unknown, origin };
}

export async function blogPage(page: number, query = "", perPage = 6): Promise<BlogPage> {
  try {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (query) params.set("q", query);
    const response = await getBlogApi(`/articles?${params.toString()}`);
    const pageData = response ? parseBlogPage(response.payload, response.origin, page) : null;
    if (!pageData) throw new Error("Invalid blog page or API route unavailable");
    return { ...pageData, available: true };
  } catch (error) {
    logApiFailure("chatnet blog page", error);
    return { articles: [], total: 0, lastPage: 1, valid: true, available: false };
  }
}

/** Returns null for a real 404; throws on API failures so the page never emits a false 404. */
export async function blogArticle(slug: string): Promise<BlogArticle | null> {
  if (!BLOG_SLUG.test(slug) || slug.length > 255) return null;
  const response = await getBlogApi(`/articles/${encodeURIComponent(slug)}`);
  if (!response) return null;
  const article = parseBlogArticle(response.payload, response.origin);
  if (!article || article.slug !== slug) throw new Error("Invalid Chatnet article projection");
  return article;
}

export async function blogSitemap(): Promise<{ url: string; lastModified?: Date }[]> {
  const response = await getBlogApi("/sitemap-feed");
  const entries = response ? parseBlogSitemap(response.payload) : null;
  if (!entries) throw new Error("Chatnet blog sitemap unavailable or invalid");
  return entries;
}
