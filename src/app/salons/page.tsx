import type { Metadata } from "next";
import { RoomDirectory } from "@/components/rooms/RoomDirectory";
import { PageIntro } from "@/components/ui/PageIntro";
import { pageMetadata } from "@/lib/metadata";
import { getPublicRooms } from "@/lib/api/rooms.server";

export const metadata: Metadata = pageMetadata("Salons de discussion", "Explorez les salons de discussion francophones de Chatnet, par sujet et par centre d’intérêt.", "/salons");

export default async function RoomsPage() {
  const rooms = await getPublicRooms();
  return <><PageIntro eyebrow="Les salons Chatnet" title="Un salon pour chaque conversation." description="Découvrez les salons de discussion enregistrés et leurs sujets." /><section className="section directory-section"><div className="container">{rooms.length ? <RoomDirectory rooms={rooms} /> : <div className="empty-state"><h2>Les salons seront bientôt disponibles.</h2><p>Réessayez dans quelques instants.</p></div>}</div></section></>;
}
