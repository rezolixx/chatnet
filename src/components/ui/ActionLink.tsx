import Link from "next/link";
import type { ReactNode } from "react";

type Props = { href: string; children: ReactNode; className?: string; ariaLabel?: string };

export function ActionLink({ href, children, className = "", ariaLabel }: Props) {
  const props = { className, "aria-label": ariaLabel };
  return href.startsWith("/") ? (
    <Link href={href} {...props}>{children}</Link>
  ) : (
    <a href={href} {...props}>{children}</a>
  );
}
