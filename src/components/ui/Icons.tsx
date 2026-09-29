import type { SVGProps } from "react";

type IconName = "arrow" | "menu" | "close" | "search" | "users" | "chat" | "shield" | "spark" | "globe" | "device" | "heart" | "sun" | "moon" | "chevron";
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
  };
  return <svg {...common}>{paths[name]}</svg>;
}
