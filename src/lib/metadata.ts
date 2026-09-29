import type { Metadata } from "next";
import { site } from "@/lib/site";

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = `${site.url}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Chatnet`, description, url, type: "website", images: [{ url: "/social/chatnet-og-1200x630.jpg", width: 1200, height: 630, alt: "Logo Chatnet" }] },
    twitter: { card: "summary_large_image", title: `${title} | Chatnet`, description, images: ["/social/chatnet-og-1200x630.jpg"] },
  };
}
