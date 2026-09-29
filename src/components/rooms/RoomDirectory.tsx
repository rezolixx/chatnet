"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icons";
import { RoomCard } from "@/components/rooms/RoomCard";
import type { PublicRoom } from "@/lib/api/types";

export function RoomDirectory({ rooms }: { rooms: PublicRoom[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => rooms.filter((room) => `${room.name} ${room.topic ?? ""}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))), [rooms, query]);
  return <><div className="directory-controls"><label className="search-field"><Icon name="search" size={19} /><span className="sr-only">Rechercher un salon</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Rechercher un salon ou un sujet" /></label></div><div className="directory-results"><div className="directory-count"><strong>{filtered.length} {filtered.length === 1 ? "salon enregistré" : "salons enregistrés"}</strong></div>{filtered.length ? <div className="room-grid">{filtered.map((room) => <RoomCard key={room.name} room={room} />)}</div> : <div className="empty-state"><h2>Aucun salon trouvé</h2><p>Essayez un autre mot ou une autre expression.</p><button type="button" className="button button-outline" onClick={() => setQuery("")}>Effacer la recherche</button></div>}</div></>;
}
