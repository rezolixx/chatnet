import Link from "next/link";
import { Icon } from "@/components/ui/Icons";

type Props = {
  title?: string;
  description?: string;
  guidance?: string;
  destination?: { href: string; label: string };
};

function NotFoundIllustration() {
  const four = "M169 65h46v112h25v37h-25v39h-43v-39H86v-34Zm3 55-44 57h44Z";
  const zero = "M320 65c-45 0-68 34-68 94s23 94 68 94 68-34 68-94-23-94-68-94Zm0 40c19 0 27 18 27 54s-8 54-27 54-27-18-27-54 8-54 27-54Z";
  return <svg className="not-found-illustration" viewBox="0 0 640 300" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="not-found-digits" x1="0" y1="0" x2="0.25" y2="1">
        <stop className="not-found-gradient-top" /><stop offset="1" className="not-found-gradient-bottom" />
      </linearGradient>
      <radialGradient id="not-found-glow"><stop stopColor="var(--cyan)" stopOpacity=".18" /><stop offset="1" stopColor="var(--cyan)" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="320" cy="170" rx="270" ry="128" fill="url(#not-found-glow)" />
    <ellipse cx="320" cy="272" rx="218" ry="12" className="not-found-ground" />
    <g className="not-found-clouds">
      <path d="M48 95h59a13 13 0 0 0 0-26h-3a20 20 0 0 0-38-7 14 14 0 0 0-21 13 10 10 0 0 0 3 20Z" />
      <path d="M538 190h52a11 11 0 0 0 0-22h-2a17 17 0 0 0-33-6 13 13 0 0 0-19 11 9 9 0 0 0 2 17Z" />
      <path d="M214 32h36a8 8 0 0 0 0-16 12 12 0 0 0-23-4 9 9 0 0 0-14 8 6 6 0 0 0 1 12Z" opacity=".7" />
    </g>
    <g className="not-found-digit-depth" transform="translate(0 9)" fillRule="evenodd">
      <path d={four} /><path d={zero} /><path d={four} transform="translate(314)" />
    </g>
    <g fill="url(#not-found-digits)" fillRule="evenodd">
      <path d={four} /><path d={zero} /><path d={four} transform="translate(314)" />
    </g>
    <g className="not-found-face" fill="none" strokeWidth="4" strokeLinecap="round">
      <path d="M310 148v4m20-4v4m-19 21q9 9 18 0" />
    </g>
    <g className="not-found-bubble">
      <path d="M447 13h35a15 15 0 0 1 15 15v19a15 15 0 0 1-15 15h-20l-15 11 3-11h-3a15 15 0 0 1-15-15V28a15 15 0 0 1 15-15Z" />
      <path className="not-found-question" d="M459 31a7 7 0 1 1 9 7c-3 1-4 3-4 6m0 8v.1" fill="none" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  </svg>;
}

export function NotFoundContent({
  title = "Page introuvable",
  description = "La page que vous recherchez n’existe pas ou a peut-être été déplacée.",
  guidance = "Vous pouvez retourner à l’accueil ou explorer les salons.",
  destination = { href: "/salons", label: "Voir les salons" },
}: Props) {
  return <section className="not-found" aria-labelledby="not-found-title">
    <div className="not-found-content">
      <NotFoundIllustration />
      <span className="sr-only">Erreur 404</span>
      <h1 id="not-found-title">{title}</h1>
      <p className="not-found-description">{description}</p>
      <p className="not-found-guidance">{guidance}</p>
      <div className="not-found-actions">
        <Link href="/" className="button button-primary button-large">Retour à l’accueil <Icon name="arrow" size={18} /></Link>
        <Link href={destination.href} className="button button-outline button-large">{destination.label}</Link>
      </div>
    </div>
  </section>;
}
