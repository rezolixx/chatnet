import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { site } from "@/lib/site";

const legal = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Conditions d’utilisation", href: "/conditions" },
  { label: "Cookies", href: "/cookies" },
];

export function Footer() {
  return <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><BrandLogo light /><p>Un espace pour parler, se rencontrer et partager en français, où que l’on soit.</p><span className="footer-tag">La conversation nous rapproche.</span></div><div><h2>Explorer</h2><ul>{site.nav.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}<li><Link href="/contact">Contact</Link></li></ul></div><div><h2>Informations</h2><ul>{legal.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul></div><div className="footer-note"><h2>Restons en contact</h2><p>Les liens vers les réseaux de Chatnet seront ajoutés dès leur publication officielle.</p><Link href="/contact" className="footer-contact">Nous contacter <span aria-hidden="true">↗</span></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} chatnet.fr</span><span>Une communauté francophone, ouverte sur le monde.</span></div></footer>;
}
