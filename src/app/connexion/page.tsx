import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion", alternates: { canonical: "/connexion" }, robots: { index: false, follow: true } };

export default async function LoginFallbackPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { registered } = await searchParams;
  return <><PageIntro eyebrow="Connexion" title="Retrouvez votre communauté." description="Accédez à votre compte Chatnet en toute simplicité." /><section className="section auth-section"><div className="container"><LoginForm registered={registered === "1"} /></div></section></>;
}
