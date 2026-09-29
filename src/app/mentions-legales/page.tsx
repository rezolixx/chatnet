import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/LegalNotice";

export const metadata: Metadata = { title: "Mentions légales", description: "Informations légales relatives au site Chatnet.", alternates: { canonical: "/mentions-legales" }, robots: { index: false, follow: true } };

export default function LegalPage() {
  return <LegalNotice title="Mentions légales"><h2>Éditeur du site</h2><p>L’identité juridique, les coordonnées et les informations d’immatriculation de l’éditeur seront publiées ici dès leur confirmation.</p><h2>Hébergement</h2><p>Les coordonnées de l’hébergeur seront ajoutées lorsque l’infrastructure de publication sera définie.</p><h2>Propriété intellectuelle</h2><p>Le nom, les logos et les éléments visuels Chatnet présents sur ce site font partie de l’identité de la plateforme. Les conditions détaillées d’utilisation seront publiées avec les informations légales complètes.</p></LegalNotice>;
}
