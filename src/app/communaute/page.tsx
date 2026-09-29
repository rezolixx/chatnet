import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { CommunityMembers } from "@/components/community/CommunityMembers";
import { getOnlineMemberPage, MAX_CHATNET_PAGE } from "@/lib/api/community.server";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icons";
import { joinHref } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("Communauté francophone", "Découvrez la communauté Chatnet, ses membres en ligne et un espace de conversation ouvert aux francophones.", "/communaute");

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const rawPage = (await searchParams).page;
  if (rawPage !== undefined && (typeof rawPage !== "string" || !/^[1-9]\d*$/.test(rawPage) || Number(rawPage) > MAX_CHATNET_PAGE)) redirect("/communaute");
  const page = rawPage === undefined ? 1 : Number(rawPage);
  const result = await getOnlineMemberPage(page);
  if (!result.failed && page > 1 && result.members.length === 0) {
    redirect(result.lastAvailablePage === 1 ? "/communaute" : `/communaute?page=${result.lastAvailablePage}`);
  }

  return <><PageIntro eyebrow="La communauté" title="Des horizons différents. Une conversation commune." description="Chatnet donne une place aux francophones pour faire connaissance, découvrir d’autres points de vue et partager ce qui les anime." /><section className="section community-page-section"><div className="container community-story"><div className="community-story-copy"><span className="eyebrow">L’esprit Chatnet</span><h2>On a tous quelque chose à raconter.</h2><p>Certains viennent pour parler musique. D’autres pour retrouver des gens de leur région, échanger une idée ou simplement passer un bon moment. Une communauté se construit conversation après conversation.</p><div className="story-tags"><span>Échanges spontanés</span><span>Centres d’intérêt</span><span>Rencontres</span></div></div><div className="community-story-art"><Image src="/brand/chatnet-cn-decorative.svg" alt="Monogramme de la communauté Chatnet" width={260} height={175} sizes="(max-width: 768px) 180px, 260px" /><span>FR</span><span>BE</span><span>QC</span><span>MA</span></div></div></section><CommunityMembers members={result.members} page={page} hasNext={result.hasNext} unavailable={result.failed} /><section className="section community-reach"><div className="container"><div className="reach-heading"><span className="eyebrow">Sans frontières</span><h2>Le français nous réunit.</h2><p>De la France au Québec, du Maghreb à l’Afrique francophone, de la Belgique à la Suisse : la communauté trouve sa richesse dans la diversité de ses voix.</p></div><div className="reach-grid"><div><strong>Partout</strong><span>Des rencontres sans frontière géographique.</span></div><div><strong>En français</strong><span>Un langage commun, mille façons de s’exprimer.</span></div><div><strong>À votre rythme</strong><span>Rejoignez le sujet qui vous inspire.</span></div></div></div></section><section className="section values-page" id="valeurs"><div className="container"><span className="eyebrow">Nos valeurs</span><h2>Une bonne discussion commence par le respect.</h2><div className="values-cards"><article><Icon name="heart" size={27} /><h3>Convivialité</h3><p>Accueillir les nouveaux venus et faire de la place aux différences.</p></article><article><Icon name="shield" size={27} /><h3>Attention aux autres</h3><p>Une conversation agréable se construit avec bienveillance et modération.</p></article><article><Icon name="users" size={27} /><h3>Esprit de communauté</h3><p>Partager, écouter et laisser chacun participer à sa manière.</p></article></div><ActionLink href={joinHref} className="button button-primary">Découvrir les salons <Icon name="arrow" size={18} /></ActionLink></div></section></>;
}
