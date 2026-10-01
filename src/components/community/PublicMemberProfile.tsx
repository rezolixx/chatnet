import { MemberAvatar } from "./MemberAvatar";
import type { PublicMemberProfile as MemberProfile } from "@/lib/api/public-member";

export function PublicMemberProfile({ member }: { member: MemberProfile }) {
  const details = [["Âge", member.age === null ? null : `${member.age} ans`], ["Genre", member.gender], ["Pays", member.pays]];
  return <article className="profile-card">
    <div className="profile-head"><MemberAvatar member={{ nickname: member.nickname, avatar: member.avatar }} /><div className="profile-head-copy"><span className="eyebrow">Membre Chatnet</span><h2>{member.nickname}</h2></div></div>
    <div className="profile-grid">{details.map(([label, value]) => <div className="profile-detail" key={label}><span>{label}</span><strong>{value || "Non renseigné"}</strong></div>)}</div>
  </article>;
}
