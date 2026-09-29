"use client";

import { useState } from "react";
import Image from "next/image";
import type { PublicMember } from "@/lib/api/types";

export function MemberAvatar({ member }: { member: PublicMember }) {
  const [imageAvailable, setImageAvailable] = useState(true);
  const initial = Array.from(member.nickname)[0]?.toLocaleUpperCase("fr") ?? "?";

  return <span className="member-avatar" title={member.nickname}>
    {member.avatar && imageAvailable ? <Image src={member.avatar} alt={`Avatar de ${member.nickname}`} width={48} height={48} unoptimized onError={() => setImageAvailable(false)} /> : <span aria-hidden="true">{initial}</span>}
  </span>;
}
