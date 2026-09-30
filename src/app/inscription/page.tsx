import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Inscription", alternates: { canonical: "/inscription" }, robots: { index: false, follow: true } };

export default function RegistrationPage() {
  return <><PageIntro eyebrow="Inscription" title="Rejoignez la communauté." description="Créez votre compte membre Chatnet." /><section className="section auth-section"><div className="container"><RegisterForm /></div></section></>;
}
