import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/LegalNotice";

export const metadata: Metadata = { title: "Politique de confidentialité", description: "Informations sur la confidentialité du site Chatnet.", alternates: { canonical: "/confidentialite" }, robots: { index: false, follow: true } };

export default function PrivacyPage() {
  return <LegalNotice title="Politique de confidentialité"><h2>Entrée dans le chat</h2><p>Le champ Ville / Pays peut être prérempli à partir d’une localisation approximative associée à votre adresse IP, si l’infrastructure transmet ces informations. Vous pouvez modifier cette valeur avant de rejoindre le chat.</p><p>Le formulaire de la page d’accueil demande un ticket à laravel.discut.org depuis votre navigateur. Si la demande réussit, votre pseudo, votre âge, le code de genre choisi, votre ville ou pays et ce ticket sont transmis à chat.discut.org dans l’adresse du nouvel onglet. Le ticket n’est pas enregistré par ce site.</p><h2>Préférence d’affichage</h2><p>Votre choix de thème clair ou sombre est enregistré localement dans votre navigateur. Il sert uniquement à conserver votre préférence d’affichage.</p><h2>Informations à compléter</h2><p>Cette page sera complétée avec les informations vérifiées sur les données traitées par le service de chat, leur durée de conservation, les éventuels prestataires et les moyens d’exercer vos droits.</p></LegalNotice>;
}
