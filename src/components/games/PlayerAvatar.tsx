"use client";

import { useState } from "react";
import Image from "next/image";
import { identityAvatar } from "@/lib/games";
import type { PlayerIdentity } from "@/lib/games";

const SIZE_CLASS = { 32: "player-thumb", 72: "player-thumb player-thumb-large", 92: "player-thumb player-thumb-large player-avatar" } as const;

// Initial-letter avatar; a photo is layered on top only for a verified member
// account or, separately marked, the member who currently owns the registered
// nickname. The initial stays visible while the photo loads or if it fails.
export function PlayerAvatar({ nickname, identity = {}, size = 32 }: { nickname: string; identity?: PlayerIdentity; size?: keyof typeof SIZE_CLASS }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initial = Array.from(nickname)[0]?.toLocaleUpperCase("fr") ?? "?";
  const avatar = identityAvatar(identity);
  const photo = avatar && avatar !== failedAvatar ? avatar : null;

  return <span className={SIZE_CLASS[size]} aria-hidden="true" data-avatar={photo ? identity.account ? "member" : "nickname-owner" : "initial"}>
    <span>{initial}</span>
    {photo && <Image src={photo} alt="" width={size} height={size} unoptimized onError={() => setFailedAvatar(photo)} />}
  </span>;
}
