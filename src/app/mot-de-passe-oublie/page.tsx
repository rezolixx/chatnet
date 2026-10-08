import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Mot de passe oublié", alternates: { canonical: "/mot-de-passe-oublie" }, robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return <><PageIntro eyebrow="Mot de passe oublié" title="Retrouvez l’accès à votre compte." description="Recevez par e-mail un lien pour choisir un nouveau mot de passe." /><section className="section auth-section"><div className="container"><ForgotPasswordForm /></div></section></>;
}
