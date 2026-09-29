"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icons";
import { joinHref, site } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); router.refresh(); setOpen(false); }
    finally { setLoggingOut(false); }
  }

  const accountAction = loading
    ? <span className="nav-auth-placeholder" aria-label="Vérification de la session" />
    : user
      ? <div className="nav-account"><span className="nav-account-person"><MemberAvatar member={user} /><span>{user.nickname}</span></span><button type="button" className="nav-logout" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Déconnexion…" : "Se déconnecter"}</button></div>
      : <Link href="/connexion" className="nav-login">Se connecter</Link>;
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <BrandLogo />
        <nav className="desktop-nav" aria-label="Navigation principale">
          {site.nav.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? "nav-link active" : "nav-link"} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <div className="nav-auth-desktop">{accountAction}</div>
          <ActionLink href={joinHref} className="button button-primary nav-join">Rejoindre Chatnet <Icon name="arrow" size={16} /></ActionLink>
          <button className="icon-button menu-toggle" type="button" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}><Icon name={open ? "close" : "menu"} /></button>
        </div>
      </div>
      <nav id="mobile-navigation" className={`mobile-nav ${open ? "open" : ""}`} aria-label="Navigation mobile" inert={!open}>
        <div className="container mobile-nav-inner">
          {site.nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={pathname === item.href ? "mobile-nav-link active" : "mobile-nav-link"} aria-current={pathname === item.href ? "page" : undefined}>{item.label}<Icon name="chevron" size={18} /></Link>)}
          <div className="mobile-nav-actions"><div className="nav-auth-mobile">{accountAction}</div><ActionLink href={joinHref} className="button button-primary">Rejoindre Chatnet</ActionLink></div>
        </div>
      </nav>
    </header>
  );
}
