import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { ProfileContent } from "@/components/auth/ProfileContent";

export const metadata: Metadata = { title: "Mon profil", alternates: { canonical: "/profil" }, robots: { index: false, follow: true } };

export default function ProfilePage() {
  return <><PageIntro eyebrow="Espace membre" title="Mon profil." description="Retrouvez les informations de votre compte Chatnet." /><section className="section auth-section"><div className="container"><ProfileContent /></div></section></>;
}
