import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import type { BlogArticle } from "@/lib/blog/types";
import { articleReadingMinutes } from "@/lib/blog/parse";

export function formatArticleDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function ArticleCard({ article }: { article: BlogArticle }) {
  const href = `/blog/${article.slug}`;
  return (
    <article className="chatnet-blog-card">
      <Link href={href} className="chatnet-blog-card-media" aria-label={`Lire : ${article.title}`} tabIndex={-1}>
        {article.cover ? (
          <Image src={article.cover.src} alt="" fill unoptimized sizes="(max-width: 720px) 100vw, (max-width: 1160px) 50vw, 380px" referrerPolicy="no-referrer" />
        ) : (
          <span className="chatnet-blog-card-placeholder" aria-hidden="true"><Icon name="chat" size={42} /><span>CHATNET<span className="chatnet-blog-dot">.</span></span></span>
        )}
      </Link>
      <div className="chatnet-blog-card-content">
        <span className="chatnet-blog-card-category">La vie en ligne</span>
        <h2><Link href={href}>{article.title}</Link></h2>
        <p>{article.excerpt}</p>
        <div className="chatnet-blog-card-footer">
          <span>{article.publishedAt ? formatArticleDate(article.publishedAt) : "Le magazine Chatnet"} · {articleReadingMinutes(article)} min</span>
          <Link href={href} aria-label={`Lire l’article ${article.title}`}><Icon name="arrow" size={19} /></Link>
        </div>
      </div>
    </article>
  );
}
