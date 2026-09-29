import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/LegalNotice";

export const metadata: Metadata = { title: "Conditions d’utilisation", description: "Conditions d’utilisation de Chatnet.", alternates: { canonical: "/conditions" }, robots: { index: false, follow: true } };

export default function TermsPage() {
  return <LegalNotice title="Conditions d’utilisation"><h2>Publication à compléter</h2><p>Les conditions applicables au chat, aux comptes et aux futurs jeux doivent être vérifiées et publiées ici. Ce texte provisoire ne remplace pas ces conditions.</p><h2>Esprit de la communauté</h2><p>Chatnet présente un espace de conversation fondé sur le respect, la convivialité et l’attention portée aux autres.</p></LegalNotice>;
}
