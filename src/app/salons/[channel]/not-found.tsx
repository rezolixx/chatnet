import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";

export default function RoomNotFound() {
  return <><PageIntro eyebrow="Les salons Chatnet" title="Salon introuvable." description="Ce salon ne figure pas dans la liste publique des salons enregistrés." /><section className="section directory-section"><div className="container"><Link href="/salons" className="button button-outline">Retour aux salons</Link></div></section></>;
}
