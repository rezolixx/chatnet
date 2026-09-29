import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";
import { Icon } from "@/components/ui/Icons";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("À propos", "Découvrez l’idée derrière Chatnet : un lieu de conversation et de communauté pour les francophones.", "/a-propos");

export default function AboutPage() {
  return <><PageIntro eyebrow="À propos de Chatnet" title="Un endroit pour parler, simplement." description="Chatnet est pensé comme un espace de conversation francophone : des salons, des centres d’intérêt partagés et la liberté de faire connaissance." /><section className="section about-section"><div className="container about-grid"><div><span className="eyebrow">Notre intention</span><h2>Remettre la conversation au centre.</h2><p>Un message peut ouvrir une discussion. Une discussion peut créer un lien. Nous voulons rendre ces moments simples à trouver, sur mobile comme sur ordinateur.</p><p>Chatnet accueille les voix de toute la francophonie, avec une attention particulière à la convivialité et au respect.</p><Link href="/communaute" className="text-link">Découvrir notre communauté <Icon name="arrow" size={18} /></Link></div><div className="about-brand-panel"><div className="about-brand-art"><Image src="/brand/chatnet-cn-decorative.svg" alt="Monogramme décoratif Chatnet" width={385} height={259} sizes="(max-width: 768px) 260px, 385px" /></div><span>La conversation nous rapproche.</span></div></div></section></>;
}
