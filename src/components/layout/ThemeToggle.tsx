"use client";

import { Icon } from "@/components/ui/Icons";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chatnet-theme", next); } catch { /* Theme still applies for this visit. */ }
  }

  return <button className="icon-button theme-toggle" type="button" onClick={toggle} aria-label="Changer le thème" title="Changer le thème"><span className="theme-icon-moon"><Icon name="moon" size={19} /></span><span className="theme-icon-sun"><Icon name="sun" size={19} /></span></button>;
}
