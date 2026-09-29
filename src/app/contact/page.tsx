import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { contactEmail } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("Contact", "Contacter l’équipe Chatnet et trouver les informations de contact officielles.", "/contact");

export default function ContactPage() {
  return <><PageIntro eyebrow="Contact" title="Parlons-en." description="Une question sur Chatnet, une idée ou un sujet à nous signaler ? Retrouvez ici le canal de contact officiel dès sa publication." /><section className="section simple-page-section"><div className="container"><div className="info-card"><h2>Nous contacter</h2>{contactEmail ? <><p>Écrivez-nous à cette adresse :</p><a className="text-link" href={`mailto:${contactEmail}`}>{contactEmail}</a></> : <p>L’adresse de contact officielle n’est pas encore publiée. Elle sera ajoutée ici avant l’ouverture du service.</p>}</div></div></section></>;
}
