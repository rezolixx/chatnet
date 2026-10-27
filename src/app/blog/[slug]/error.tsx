"use client";

import Link from "next/link";

export default function BlogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="container chatnet-blog-empty" role="alert"><h1>L’article est momentanément indisponible</h1><p>Nous n’arrivons pas à joindre le service des articles. Votre salon de discussion reste accessible.</p><div className="chatnet-blog-empty-actions"><button className="button button-primary" onClick={reset}>Réessayer</button><Link href="/blog" className="button button-outline">Retour au blog</Link></div></div>;
}
