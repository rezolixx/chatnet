import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { ArticleCard, formatArticleDate } from "@/components/blog/ArticleCard";
import { Icon } from "@/components/ui/Icons";
import { blogArticle, blogPage } from "@/lib/blog/api.server";
import { articleReadingMinutes } from "@/lib/blog/parse";
import { site } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await blogArticle(slug);
  if (!article) notFound();
  const url = `${site.url}/blog/${article.slug}`;
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: "article", locale: "fr_FR", siteName: site.name, title, description, url,
      publishedTime: article.publishedAt ?? undefined, modifiedTime: article.updatedAt,
      images: article.cover ? [{ url: article.cover.src, alt: article.cover.alt }] : [{ url: "/social/chatnet-og-1200x630.jpg", width: 1200, height: 630, alt: "Chatnet" }] },
    twitter: { card: "summary_large_image", title, description, images: [article.cover?.src || "/social/chatnet-og-1200x630.jpg"] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await blogArticle(slug);
  if (!article) notFound();
  const url = `${site.url}/blog/${article.slug}`;
  const listing = await blogPage(1, "", 5);
  const related = listing.articles.filter((item) => item.slug !== slug).slice(0, 3);
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "BlogPosting", "@id": `${url}#article`, headline: article.title,
      description: article.seoDescription || article.excerpt,
      ...(article.cover ? { image: article.cover.src } : {}),
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      dateModified: article.updatedAt, inLanguage: "fr-FR", mainEntityOfPage: url,
      publisher: { "@type": "Organization", name: "Chatnet", url: site.url } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: site.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ] },
  ] };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <div className="container"><nav className="chatnet-blog-breadcrumb" aria-label="Fil d’Ariane"><Link href="/">Accueil</Link><Icon name="chevron" size={16} /><Link href="/blog">Blog</Link><Icon name="chevron" size={16} /><span aria-current="page">{article.title}</span></nav></div>
    <article className="chatnet-blog-article">
      <header className="container chatnet-blog-article-header">
        <span className="eyebrow">Le magazine Chatnet</span><h1>{article.title}</h1><p>{article.excerpt}</p>
        <div className="chatnet-blog-article-meta"><span className="chatnet-blog-author-icon"><Icon name="chat" size={19} /></span><span>La rédaction Chatnet</span><span aria-hidden="true">·</span>{article.publishedAt && <><time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time><span aria-hidden="true">·</span></>}<span>{articleReadingMinutes(article)} min de lecture</span></div>
      </header>
      {article.cover && <div className="container"><div className="chatnet-blog-article-cover"><Image src={article.cover.src} alt={article.cover.alt} width={1200} height={1200} unoptimized priority referrerPolicy="no-referrer" sizes="(max-width: 1200px) 100vw, 1160px" /></div></div>}
      <div className="container chatnet-blog-article-columns"><ArticleBody blocks={article.blocks} /><aside className="chatnet-blog-article-aside"><div><Icon name="chat" size={28} /></div><h2>Et si on en parlait ensemble ?</h2><p>Les meilleures conversations commencent souvent par une idée partagée.</p><Link href="/salons" className="button button-primary">Rejoindre un salon <Icon name="arrow" size={17} /></Link></aside></div>
    </article>
    {related.length > 0 && <section className="container chatnet-blog-related" aria-labelledby="related-title"><div className="chatnet-blog-related-head"><div><span className="eyebrow">Poursuivez votre lecture</span><h2 id="related-title">D’autres idées à découvrir</h2></div><Link className="text-link" href="/blog">Tous les articles <Icon name="arrow" size={18} /></Link></div><div className="chatnet-blog-grid">{related.map((item) => <ArticleCard key={item.slug} article={item} />)}</div></section>}
  </>;
}
