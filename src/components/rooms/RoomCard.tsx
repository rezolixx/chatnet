import type { PublicRoom } from "@/lib/api/types";
import { roomHref } from "@/lib/site";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icons";

export function RoomCard({ room }: { room: PublicRoom }) {
  const displayName = room.name.replace(/^#/, "");
  const symbol = Array.from(displayName)[0]?.toLocaleUpperCase("fr") ?? "#";

  return <article className="room-card"><div className="room-card-top"><div className="room-symbol" aria-hidden="true">{symbol}</div></div><h3>{displayName}</h3><p>{room.topic ?? "Salon de discussion francophone"}</p><div className="room-card-bottom"><span className="room-availability">Salon enregistré</span><ActionLink href={roomHref()} className="room-open" ariaLabel="Ouvrir le formulaire pour rejoindre le chat"><Icon name="arrow" size={18} /></ActionLink></div></article>;
}
