import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { PublicMemberProfile } from "@/components/community/PublicMemberProfile";
import { getPublicMember } from "@/lib/api/public-member.server";
import { publicMemberHref, publicNickname } from "@/lib/api/public-member";

type Props = { params: Promise<{ nickname: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const nickname = publicNickname((await params).nickname);
  return { title: nickname ? `Profil de ${nickname}` : "Profil membre", alternates: { canonical: publicMemberHref(nickname) }, robots: { index: false, follow: true } };
}

export default async function MemberPage({ params }: Props) {
  const result = await getPublicMember((await params).nickname);
  if (result.status === "not-found") notFound();
  return <><PageIntro eyebrow="La communauté" title="Profil public." description="Découvrez les membres de la communauté Chatnet." /><section className="section auth-section"><div className="container">
    {result.status === "found" ? <PublicMemberProfile member={result.member} /> : <div className="profile-card" role="alert">Ce profil est temporairement indisponible. Réessayez plus tard.</div>}
  </div></section></>;
}
