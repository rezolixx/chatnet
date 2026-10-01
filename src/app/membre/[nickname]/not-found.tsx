import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";

export default function MemberNotFound() {
  return <><PageIntro eyebrow="La communauté" title="Profil introuvable." description="Ce profil membre n’est pas disponible." /><section className="section auth-section"><div className="container"><div className="profile-card"><Link href="/communaute" className="button button-outline">Retour à la communauté</Link></div></div></section></>;
}
