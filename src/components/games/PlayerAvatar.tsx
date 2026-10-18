"use client";

import { useState } from "react";
import Image from "next/image";

// Initial-letter avatar; a photo is layered on top only for a verified member
// account. The initial stays visible while the photo loads or if it fails.
export function PlayerAvatar({ nickname, avatar = null, size = 32 }: { nickname: string; avatar?: string | null; size?: 32 | 72 }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initial = Array.from(nickname)[0]?.toLocaleUpperCase("fr") ?? "?";
  const photo = avatar && avatar !== failedAvatar ? avatar : null;

  return <span className={`player-thumb${size === 72 ? " player-thumb-large" : ""}`} aria-hidden="true" data-avatar={photo ? "member" : "initial"}>
    <span>{initial}</span>
    {photo && <Image src={photo} alt="" width={size} height={size} unoptimized onError={() => setFailedAvatar(photo)} />}
  </span>;
}
