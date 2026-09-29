import Link from "next/link";

export function LegalNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="legal-section"><div className="container legal-layout"><aside><span className="eyebrow">Informations du site</span><h1>{title}</h1><p>Les informations officielles de cette page seront complétées avant la mise en ligne du service.</p><Link href="/contact" className="text-link">Contact</Link></aside><div className="legal-content"><div className="legal-status">Document en cours de finalisation</div>{children}</div></div></section>;
}
