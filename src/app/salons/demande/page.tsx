import type { Metadata } from "next";
import { PageIntro } from "@/components/ui/PageIntro";
import { ChannelRequestForm } from "@/components/rooms/ChannelRequestForm";
import "./channel-request.css";

export const metadata: Metadata = {
  title: "Demander un salon IRC",
  description: "Proposez la création d’un salon IRC à l’équipe Chatnet.",
  alternates: { canonical: "/salons/demande" },
  robots: { index: false, follow: true },
};

export default function ChannelRequestPage() {
  return <><PageIntro eyebrow="Les salons Chatnet" title="Demander un salon" description="Vous avez une idée de salon ? Faites votre demande à l’équipe de modération." /><section className="section auth-section"><div className="container"><div className="auth-card assistance-card channel-request-card"><ChannelRequestForm /></div></div></section></>;
}
