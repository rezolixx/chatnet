import Link from "next/link";
import { site } from "@/lib/site";

type Crumb = { label: string; href: string };

export function breadcrumbSchema(items: Crumb[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: `${site.url}${item.href}` })) };
}

/** Visible trail plus BreadcrumbList JSON-LD; the last item is the current page. */
export function GamesBreadcrumb({ items, schema = true }: { items: Crumb[]; schema?: boolean }) {
  return <>{schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(items)).replace(/</g, "\\u003c") }} />}<nav className="games-breadcrumb" aria-label="Fil d’Ariane"><ol>{items.map((item, index) => <li key={item.href}>{index === items.length - 1 ? <span aria-current="page">{item.label}</span> : <Link href={item.href}>{item.label}</Link>}</li>)}</ol></nav></>;
}
