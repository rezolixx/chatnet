import type { BlogArticle, BlogBlock, BlogImage } from "./types";

export const BLOG_SITE = "chatnet.fr";
export const BLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function string(value: unknown): value is string {
  return typeof value === "string";
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function parseBlocks(value: unknown): BlogBlock[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed: BlogBlock[] = [];
  for (const block of value) {
    if (!record(block)) return null;
    if ((block.type === "paragraph" || block.type === "quote") && string(block.text)) {
      parsed.push({ type: block.type, text: block.text });
    } else if (block.type === "heading" && (block.level === 2 || block.level === 3) && string(block.text)) {
      parsed.push({ type: "heading", level: block.level, text: block.text });
    } else if (block.type === "list" && typeof block.ordered === "boolean" && Array.isArray(block.items)
      && block.items.every(string)) {
      parsed.push({ type: "list", ordered: block.ordered, items: block.items });
    } else if (block.type === "table" && Array.isArray(block.headers) && block.headers.every(string)
      && Array.isArray(block.rows) && block.rows.every((row: unknown) => Array.isArray(row) && row.every(string))) {
      parsed.push({ type: "table", headers: block.headers, rows: block.rows });
    } else {
      return null;
    }
  }
  return parsed;
}

export function parseBlogImage(value: unknown, alt: unknown, apiOrigin: string): BlogImage | null {
  if (!string(value) || !value.trim() || value.startsWith("//")) return null;
  try {
    if (value.startsWith("/") && !value.startsWith("/storage/articles/")) return null;
    const url = new URL(value, apiOrigin);
    if (url.username || url.password || url.hash || (url.protocol !== "https:"
      && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    if (value.startsWith("/") && url.origin !== apiOrigin) return null;
    return { src: url.href, alt: string(alt) ? alt : "" };
  } catch {
    return null;
  }
}

/** Strictly accept public projections for Chatnet. Never render raw HTML from the API. */
export function parseBlogArticle(value: unknown, apiOrigin: string, now = Date.now()): BlogArticle | null {
  if (!record(value) || value.site_key !== BLOG_SITE || value.status !== "published"
    || !string(value.slug) || value.slug.length > 255 || !BLOG_SLUG.test(value.slug)
    || !string(value.title) || !value.title.trim() || !string(value.excerpt)
    || !string(value.updated_at) || !validDate(value.updated_at)) return null;
  const publishedAt = value.published_at;
  if (publishedAt !== null && (!string(publishedAt) || !validDate(publishedAt) || Date.parse(publishedAt) > now)) return null;
  const blocks = parseBlocks(value.blocks);
  if (!blocks) return null;
  return {
    slug: value.slug,
    title: value.title.trim(),
    excerpt: value.excerpt.trim(),
    cover: parseBlogImage(value.image, value.image_alt, apiOrigin),
    publishedAt,
    updatedAt: value.updated_at,
    seoTitle: string(value.seo_title) ? value.seo_title : undefined,
    seoDescription: string(value.seo_description) ? value.seo_description : undefined,
    blocks,
  };
}

export function parseBlogPage(value: unknown, apiOrigin: string, page: number): Omit<import("./types").BlogPage, "available"> | null {
  if (!record(value) || !Array.isArray(value.data) || !Number.isSafeInteger(value.total)
    || (value.total as number) < 0 || !Number.isSafeInteger(value.last_page)
    || (value.last_page as number) < 1) return null;
  const articles = value.data.map((row: unknown) => parseBlogArticle(row, apiOrigin));
  if (articles.some((article: BlogArticle | null) => !article)) return null;
  return { articles: articles as BlogArticle[], total: value.total as number,
    lastPage: value.last_page as number, valid: page <= (value.last_page as number) };
}

export function parseBlogSitemap(value: unknown): { url: string; lastModified?: Date }[] | null {
  if (!Array.isArray(value)) return null;
  const entries: { url: string; lastModified?: Date }[] = [];
  for (const item of value) {
    if (!record(item) || !string(item.url) ||
      !/^https:\/\/chatnet\.fr\/blog(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(item.url)) return null;
    const date = string(item.lastmod) ? new Date(item.lastmod) : undefined;
    entries.push({ url: item.url, lastModified: date && Number.isFinite(date.getTime()) ? date : undefined });
  }
  return entries;
}

export function articleReadingMinutes(article: BlogArticle): number {
  const text = article.blocks.flatMap((block) => block.type === "list" ? block.items
    : block.type === "table" ? [...block.headers, ...block.rows.flat()]
      : [block.text]).join(" ");
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200));
}
