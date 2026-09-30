import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { indexablePaths } from "@/lib/seo/indexable";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({ url: `${site.url}${path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}
