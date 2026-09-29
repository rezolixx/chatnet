import Image from "next/image";
import Link from "next/link";
import { ChatJoinForm } from "@/components/chat/ChatJoinForm";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import { Icon } from "@/components/ui/Icons";
import type { PublicOnlineMember } from "@/lib/api/types";

export function Hero({ members }: { members: PublicOnlineMember[] }) {
  return <section className="hero"><div className="container hero-grid">
    <div className="hero-copy">
      <span className="hero-kicker"><span className="kicker-line" /> Votre espace de discussion francophone</span>
      <h1>Les belles conversations commencent <em>ici.</em></h1>
      <p>Rejoignez des salons, partagez vos centres d’intérêt et faites de nouvelles rencontres. Chatnet vous donne une place pour discuter librement, en français, où que vous soyez.</p>
      <div className="hero-actions"><Link href="/salons" className="button button-outline button-large">Découvrir les salons <Icon name="arrow" size={18} /></Link></div>
      <div className="hero-footnote">{members.length > 0 && <div className="hero-avatar-stack">{members.slice(0, 3).map((member) => <span className="hero-member-avatar" key={member.nickname}><MemberAvatar member={member} /><span className="member-online-dot" role="img" aria-label="En ligne" title="En ligne" /></span>)}</div>}<span>{members.length ? "Des membres sont en ligne maintenant." : "Retrouvez la communauté sur Chatnet."}</span></div>
    </div>
    <div className="hero-art hero-join-panel"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><ChatJoinForm /><Image className="hero-monogram hero-monogram-light" src="/brand/chatnet-cn-monogram.png" alt="" width={210} height={141} /><Image className="hero-monogram hero-monogram-dark" src="/brand/chatnet-cn-decorative.svg" alt="" width={210} height={141} /></div>
  </div></section>;
}
