import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { indexablePaths } from "@/lib/seo/indexable";
import { blogSitemap } from "@/lib/blog/api.server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const existing: MetadataRoute.Sitemap = indexablePaths.map((path) => ({
    url: `${site.url}${path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7,
  }));
  try {
    const entries = await blogSitemap();
    return [...existing, ...entries.map(({ url, lastModified }) => ({ url, lastModified, changeFrequency: "weekly" as const, priority: url.endsWith("/blog") ? 0.8 : 0.7 }))];
  } catch (error) {
    // Never substitute foreign-site, unpublished or invented URLs if the feed fails.
    console.warn("[Chatnet SEO] blog sitemap temporarily unavailable", error instanceof Error ? error.message : "unknown");
    return existing;
  }
}
