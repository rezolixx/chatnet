import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Navbar } from "@/components/layout/Navbar";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Footer } from "@/components/layout/Footer";
import { site } from "@/lib/site";
import "./globals.css";

const geist = localFont({ src: "../assets/geist-latin.woff2", display: "swap", variable: "--font-geist", weight: "100 900" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Chatnet — Chat en ligne et communauté francophone", template: "%s | Chatnet" },
  description: site.description,
  applicationName: "Chatnet",
  alternates: { canonical: site.url },
  openGraph: { type: "website", locale: "fr_FR", siteName: "Chatnet", url: site.url, title: "Chatnet — Chat en ligne et communauté francophone", description: site.description, images: [{ url: "/social/chatnet-og-1200x630.jpg", width: 1200, height: 630, alt: "Logo Chatnet" }] },
  twitter: { card: "summary_large_image", title: "Chatnet — Chat en ligne et communauté francophone", description: site.description, images: ["/social/chatnet-og-1200x630.jpg"] },
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }], apple: "/apple-touch-icon.png" },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#071d37" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" className={geist.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('chatnet-theme');document.documentElement.dataset.theme=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}" }} /></head><body><a className="skip-link" href="#main-content">Aller au contenu</a><AuthProvider><Navbar /><main id="main-content">{children}</main><Footer /></AuthProvider></body></html>;
}
