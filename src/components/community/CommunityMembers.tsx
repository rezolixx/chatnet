import Link from "next/link";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import type { PublicOnlineMember } from "@/lib/api/types";
import { publicMemberHref } from "@/lib/api/public-member";

export function CommunityMembers({ members, page, hasNext, unavailable }: { members: PublicOnlineMember[]; page: number; hasNext: boolean; unavailable: boolean }) {
  return <section className="section community-members"><div className="container">
    <span className="eyebrow">La communauté</span>
    <h2>Membres en ligne</h2>
    {members.length ? <div className="member-preview-grid">{members.map((member) => {
      const href = publicMemberHref(member.nickname);
      const content = <><span className="member-avatar-mark"><MemberAvatar member={member} /><span className="member-online-dot" role="img" aria-label="En ligne" title="En ligne" /></span><span>{member.nickname}</span></>;
      return href ? <Link href={href} className="member-preview-card" key={member.nickname} aria-label={`Voir le profil de ${member.nickname}`}>{content}</Link> : <div className="member-preview-card" key={member.nickname}>{content}</div>;
    })}</div> : <p className="data-note">{unavailable ? "Les membres en ligne ne sont pas disponibles pour le moment." : "Aucun membre n’est visible en ligne pour le moment."}</p>}
    {(page > 1 || hasNext) && !unavailable && <nav className="member-pagination" aria-label="Pagination des membres en ligne">
      {page > 1 ? <Link href={page === 2 ? "/communaute" : `/communaute?page=${page - 1}`}>← Précédent</Link> : <span aria-disabled="true">← Précédent</span>}
      <span className="member-pagination-current" aria-current="page">Page {page}</span>
      {hasNext ? <Link href={`/communaute?page=${page + 1}`}>Suivant →</Link> : <span aria-disabled="true">Suivant →</span>}
    </nav>}
  </div></section>;
}
