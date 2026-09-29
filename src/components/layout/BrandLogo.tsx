import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand-logo ${light ? "brand-logo-light" : ""}`} aria-label="Chatnet, accueil">
      <Image className="brand-logo-default" src="/brand/chatnet-logo-horizontal-400px.png" alt="Chatnet.fr" width={200} height={39} priority />
      <Image className="brand-logo-white" src="/brand/chatnet-logo-monochrome-white.png" alt="" width={200} height={35} priority />
    </Link>
  );
}
