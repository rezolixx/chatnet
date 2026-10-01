import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";

export const metadata: Metadata = { title: "Mot de passe modifié", robots: { index: false, follow: false } };

export default function PasswordChangedPage() {
  return <>
    <PageIntro eyebrow="Sécurité du compte" title="Mot de passe modifié." description="Votre session a expiré. Reconnectez-vous avec votre nouveau mot de passe." />
    <section className="section auth-section"><div className="container"><div className="profile-card">
      <p role="status">Votre mot de passe a été modifié avec succès.</p>
      <a className="button button-primary" href="/connexion">Se reconnecter</a>
    </div></div></section>
  </>;
}
