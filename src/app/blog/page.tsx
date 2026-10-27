import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { Icon } from "@/components/ui/Icons";
import { blogPage } from "@/lib/blog/api.server";
import { pageMetadata } from "@/lib/metadata";

type Search = { page?: string | string[]; q?: string | string[] };
const description = "Conseils, guides et idées originales pour rencontrer du monde, choisir ses salons et discuter en confiance sur Chatnet.fr.";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const params = await searchParams;
  const base = pageMetadata("Blog : conseils et vie de la communauté", description, "/blog");
  const listing = await blogPage(1);
  if (!listing.available || listing.total === 0 || params.q !== undefined || params.page !== undefined) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/blog?${value}` : "/blog";
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  if ((params.q !== undefined && (typeof params.q !== "string" || params.q.length > 120))
    || (params.page !== undefined && (typeof params.page !== "string" || !/^[1-9]\d*$/.test(params.page)))) notFound();
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const page = params.page ? Number(params.page) : 1;
  if (!Number.isSafeInteger(page) || page > 10000) notFound();
  const { articles, total, lastPage, valid, available } = await blogPage(page, query);
  if (!valid) notFound();

  return <>
    <header className="chatnet-blog-hero">
      <div className="container chatnet-blog-hero-grid">
        <div className="chatnet-blog-hero-content">
          <span className="eyebrow"><span className="chatnet-blog-pulse" /> Le magazine de Chatnet</span>
          <h1>Plus que des messages.<br /><em>Des histoires à partager.</em></h1>
          <p>Idées, conseils et découvertes pour faire de chaque discussion un bon moment, où que vous soyez.</p>
          <Link href="/salons" className="button button-primary">Rejoindre les salons <Icon name="arrow" size={18} /></Link>
        </div>
        <div className="chatnet-blog-hero-art" aria-hidden="true"><span className="chatnet-blog-art-disc" /><div className="chatnet-blog-art-top"><Icon name="chat" size={36} /><span>LES MOTS NOUS<br />RAPPROCHENT<span className="chatnet-blog-dot">.</span></span></div><div className="chatnet-blog-art-bubble a">Bonjour ! <span>👋</span></div><div className="chatnet-blog-art-bubble b">Une belle discussion commence ici.</div><div className="chatnet-blog-art-orbit">CHATNET JOURNAL · DEPUIS 2026</div></div>
      </div>
    </header>

    <section className="container chatnet-blog-listing" aria-label="Articles du blog">
      <div className="chatnet-blog-toolbar">
        <div><span className="eyebrow">À découvrir</span><h2>{query ? "Résultats de la recherche" : "À lire en ce moment"}</h2><p>Des articles pensés pour la communauté francophone.</p></div>
        <form role="search" action="/blog" method="get" className="chatnet-blog-search">
          <label htmlFor="blog-search" className="sr-only">Rechercher un article</label><Icon name="search" size={20} /><input id="blog-search" name="q" type="search" placeholder="Rechercher un sujet…" maxLength={120} defaultValue={query} /><button type="submit" aria-label="Lancer la recherche"><Icon name="arrow" size={19} /></button>
        </form>
      </div>
      {query && <p className="chatnet-blog-results">{total} résultat{total > 1 ? "s" : ""} pour « {query} » <Link href="/blog">Effacer la recherche</Link></p>}

      {articles.length > 0 && <section aria-label="Articles récents" className="chatnet-blog-grid">{articles.map((article) => <ArticleCard key={article.slug} article={article} />)}</section>}

      {articles.length === 0 && <div className="chatnet-blog-empty"><div className="chatnet-blog-empty-icon"><Icon name={query ? "search" : "chat"} size={29} /></div><h2>{!available ? "Le blog est momentanément indisponible" : query ? "Aucun article trouvé" : "Les premiers articles arrivent bientôt"}</h2><p>{!available ? "Le service des articles ne répond pas pour le moment. Réessayez bientôt." : query ? "Essayez une autre recherche ou découvrez les salons de discussion." : "Notre équipe prépare des guides inédits. Les salons Chatnet vous attendent déjà !"}</p><Link href="/salons" className="button button-primary">Explorer les salons <Icon name="arrow" size={18} /></Link></div>}

      {available && lastPage > 1 && <nav className="chatnet-blog-pagination" aria-label="Pagination du blog">
        {page === 1 ? <span className="disabled">Précédent</span> : <Link href={pageHref(page - 1, query)}>Précédent</Link>}
        <span>Page {page} sur {lastPage}</span>
        {page === lastPage ? <span className="disabled">Suivant</span> : <Link href={pageHref(page + 1, query)}>Suivant</Link>}
      </nav>}
    </section>
  </>;
}
