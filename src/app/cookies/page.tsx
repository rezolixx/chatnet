import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/LegalNotice";

export const metadata: Metadata = { title: "Cookies", description: "Informations sur les cookies et préférences du site Chatnet.", alternates: { canonical: "/cookies" }, robots: { index: false, follow: true } };

export default function CookiesPage() {
  return <LegalNotice title="Cookies et préférences"><h2>Version actuelle du site</h2><p>Ce site de présentation n’intègre pas de mesure d’audience ni de publicité. Le thème choisi est gardé dans le stockage local du navigateur, sans cookie publicitaire.</p><h2>Évolutions du service</h2><p>Cette page sera mise à jour si de nouveaux outils ou services nécessitent des cookies ou un choix de consentement.</p></LegalNotice>;
}
