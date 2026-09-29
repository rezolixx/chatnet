import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/salons", "/communaute", "/jeux", "/a-propos", "/contact"];
  return paths.map((path) => ({ url: `${site.url}${path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}
