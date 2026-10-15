import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";
import { Icon } from "@/components/ui/Icons";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "Contact & assistance",
  "Une question, un problème d’accès ou un signalement sur Chatnet ? Contactez l’équipe via votre espace membre.",
  "/contact"
);

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Nous contacter"
        title="Une question ou un signalement ?"
        description="L’équipe Chatnet vous accompagne pour vos questions, suggestions et signalements. Envoyez-nous un message depuis votre compte membre."
      />

      <section className="py-12 sm:py-20">
        <div className="container">
          <div className="mx-auto w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
                  <Icon name="shield" size={22} />
                </div>
                <h2 className="text-xl font-bold text-foreground">Assistance membre</h2>
                <p className="text-sm leading-relaxed text-muted">
                  Vous avez un compte Chatnet ? Envoyez une demande directement depuis votre profil :
                  problème d’accès, question technique, suggestion ou signalement.
                </p>
              </div>

              <Link href="/assistance" className="button button-primary flex w-full items-center justify-center gap-2 text-sm">
                Ouvrir un ticket d’assistance
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
