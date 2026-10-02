import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { AssistanceContent } from "@/components/support/AssistanceContent";
import { SESSION_COOKIE, XSRF_COOKIE } from "@/lib/auth/cookies.server";
import { laravelMe } from "@/lib/auth/laravel.server";
import { contactIdentity } from "@/lib/support/contact";

export const metadata: Metadata = { title: "Assistance", alternates: { canonical: "/assistance" }, robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function AssistancePage() {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  const xsrf = store.get(XSRF_COOKIE)?.value;
  if (!session || !xsrf) redirect("/connexion");
  const verified = await laravelMe({ session, xsrf }).catch(() => null);
  if (verified?.response.status === 401 || verified?.response.status === 419) redirect("/connexion");
  const identity = verified?.response.ok ? contactIdentity(await verified.response.json().catch(() => null)) : null;
  return <><PageIntro eyebrow="Espace membre" title="Assistance." description="Envoyez un message à l’équipe Chatnet depuis votre compte." /><section className="section auth-section"><div className="container"><AssistanceContent available={!!identity} /></div></section></>;
}
