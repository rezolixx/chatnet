import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { contactEmail } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("Contact", "Une question sur Chatnet ? Consultez cette page pour connaître le canal de contact officiel dès sa publication.", "/contact");

export default function ContactPage() {
  return <><PageIntro eyebrow="Contact" title="Parlons-en." description="Une question sur Chatnet, une idée ou un sujet à nous signaler ? Retrouvez ici le canal de contact officiel dès sa publication." /><section className="section simple-page-section"><div className="container"><div className="info-card"><h2>Nous contacter</h2>{contactEmail ? <><p>Écrivez-nous à cette adresse :</p><a className="text-link" href={`mailto:${contactEmail}`}>{contactEmail}</a></> : <p>L’adresse de contact officielle sera publiée ici prochainement.</p>}</div></div></section></>;
}
