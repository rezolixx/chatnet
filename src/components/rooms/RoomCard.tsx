import type { PublicRoom } from "@/lib/api/types";
import Link from "next/link";
import { normalizeRoomName, publicRoomHref } from "@/lib/rooms";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icons";

export function RoomCard({ room }: { room: PublicRoom }) {
  const displayName = normalizeRoomName(room.name) ?? room.name;
  const symbol = Array.from(displayName)[0]?.toLocaleUpperCase("fr") ?? "#";

  const href = publicRoomHref(room.name);
  return <article className="room-card"><div className="room-card-top"><div className="room-symbol" aria-hidden="true">{symbol}</div></div><h3><Link href={href}>{displayName}</Link></h3><p>{room.topic ?? "Aucun sujet renseigné"}</p><div className="room-card-bottom"><span className="room-availability">Salon enregistré</span><ActionLink href={href} className="room-open" ariaLabel={`Voir le salon ${displayName}`}>Voir le salon <Icon name="arrow" size={18} /></ActionLink></div></article>;
}
