"use client";

import { useState } from "react";
import Image from "next/image";
import type { PublicMember } from "@/lib/api/types";

export function MemberAvatar({ member }: { member: PublicMember }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initial = Array.from(member.nickname)[0]?.toLocaleUpperCase("fr") ?? "?";

  return <span className="member-avatar" title={member.nickname}>
    {member.avatar && member.avatar !== failedAvatar ? <Image src={member.avatar} alt={`Avatar de ${member.nickname}`} width={48} height={48} unoptimized onError={() => setFailedAvatar(member.avatar)} /> : <span aria-hidden="true">{initial}</span>}
  </span>;
}
