import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";
import { deletedMessage } from "@/lib/auth/account-deletion";

export const metadata: Metadata = { title: "Compte supprimé", robots: { index: false, follow: false } };

// Reached only after the bridge confirmed Laravel's deletion; ?irc= picks the
// wording (NickServ removed, left to expiry, or still being verified).
export default async function AccountDeletedPage({ searchParams }: { searchParams: Promise<{ irc?: string | string[] }> }) {
  const { irc } = await searchParams;
  return <>
    <PageIntro eyebrow="Espace membre" title="Compte supprimé." description="Votre session a pris fin." />
    <section className="section auth-section"><div className="container"><div className="profile-card">
      <p role="status">{deletedMessage(irc)}</p>
      <Link className="button button-primary" href="/">Retour à l&apos;accueil</Link>
    </div></div></section>
  </>;
}
