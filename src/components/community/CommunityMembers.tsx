import Link from "next/link";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import type { PublicOnlineMember } from "@/lib/api/types";

export function CommunityMembers({ members, page, hasNext, unavailable }: { members: PublicOnlineMember[]; page: number; hasNext: boolean; unavailable: boolean }) {
  return <section className="section community-members"><div className="container">
    <span className="eyebrow">La communauté</span>
    <h2>Membres en ligne</h2>
    {members.length ? <div className="member-preview-grid">{members.map((member) => <div className="member-preview-card" key={member.nickname}><span className="member-avatar-mark"><MemberAvatar member={member} /><span className="member-online-dot" role="img" aria-label="En ligne" title="En ligne" /></span><span>{member.nickname}</span></div>)}</div> : <p className="data-note">{unavailable ? "Les membres en ligne ne sont pas disponibles pour le moment." : "Aucun membre n’est visible en ligne pour le moment."}</p>}
    {(page > 1 || hasNext) && !unavailable && <nav className="member-pagination" aria-label="Pagination des membres en ligne">
      {page > 1 ? <Link href={page === 2 ? "/communaute" : `/communaute?page=${page - 1}`}>← Précédent</Link> : <span aria-disabled="true">← Précédent</span>}
      <span className="member-pagination-current" aria-current="page">Page {page}</span>
      {hasNext ? <Link href={`/communaute?page=${page + 1}`}>Suivant →</Link> : <span aria-disabled="true">Suivant →</span>}
    </nav>}
  </div></section>;
}
