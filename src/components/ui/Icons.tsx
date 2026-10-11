import type { SVGProps } from "react";

type IconName = "arrow" | "menu" | "close" | "search" | "users" | "chat" | "shield" | "spark" | "globe" | "device" | "heart" | "sun" | "moon" | "chevron" | "discord";
type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 20, ...props }: Props) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const, ...props };
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="M5 5l14 14M19 5 5 19" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="6.5" r="3.5" /><path d="M18 3.5a3.5 3.5 0 0 1 0 7M22 20v-2a4 4 0 0 0-3-3.87" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    device: <><rect x="3" y="4" width="14" height="11" rx="2" /><path d="M8 20h4M10 15v5" /><rect x="17" y="8" width="4" height="11" rx="1" /></>,
    heart: <path d="M20.5 8.5c0 4.5-8.5 10-8.5 10s-8.5-5.5-8.5-10a4.5 4.5 0 0 1 8.5-1.9 4.5 4.5 0 0 1 8.5 1.9Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
    moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    discord: <path fill="currentColor" stroke="none" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.01c.12.098.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
