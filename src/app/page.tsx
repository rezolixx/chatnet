import { Hero } from "@/components/home/Hero";
import { HomeContent } from "@/components/home/HomeContent";
import { site } from "@/lib/site";
import { getPublicOnlineMembers } from "@/lib/api/community.server";
import { getPublicRooms } from "@/lib/api/rooms.server";

export default async function HomePage() {
  const [members, rooms] = await Promise.all([getPublicOnlineMembers(3), getPublicRooms()]);
  const websiteSchema = { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, inLanguage: "fr", description: site.description };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} /><Hero members={members} /><HomeContent rooms={rooms.slice(0, 6)} /></>;
}
