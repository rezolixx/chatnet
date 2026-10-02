import { Hero } from "@/components/home/Hero";
import { HomeContent } from "@/components/home/HomeContent";
import { HomeSeoContent } from "@/components/home/HomeSeoContent";
import { HomeFaq, homeFaq } from "@/components/home/HomeFaq";
import { site } from "@/lib/site";
import { getPublicOnlineMembers } from "@/lib/api/community.server";
import { getPublicRoomsResult } from "@/lib/api/rooms.server";

export default async function HomePage() {
  const [members, rooms] = await Promise.all([getPublicOnlineMembers(3), getPublicRoomsResult()]);
  const websiteSchema = { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, inLanguage: "fr", description: site.description };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaq.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <Hero members={members} />
    <HomeContent rooms={rooms.status === "available" ? rooms.rooms.slice(0, 6) : []} roomsUnavailable={rooms.status === "unavailable"} />
    <HomeSeoContent />
    <HomeFaq />
  </>;
}
