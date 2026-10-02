import type { Metadata } from "next";
import { RoomDirectory } from "@/components/rooms/RoomDirectory";
import { PageIntro } from "@/components/ui/PageIntro";
import { pageMetadata } from "@/lib/metadata";
import { getPublicRoomsResult } from "@/lib/api/rooms.server";

export const metadata: Metadata = pageMetadata("Salons de discussion", "Explorez les salons de discussion francophones de Chatnet, par sujet et par centre d’intérêt.", "/salons");

export default async function RoomsPage() {
  const result = await getPublicRoomsResult();
  return <><PageIntro eyebrow="Les salons Chatnet" title="Un salon pour chaque conversation." description="Découvrez les salons de discussion enregistrés et leurs sujets." /><section className="section directory-section"><div className="container">{result.status === "unavailable" ? <div className="empty-state" role="alert"><h2>Les salons sont temporairement indisponibles.</h2><p>Réessayez dans quelques instants.</p></div> : result.rooms.length ? <RoomDirectory rooms={result.rooms} /> : <div className="empty-state"><h2>Aucun salon enregistré pour le moment.</h2><p>Revenez consulter la liste plus tard.</p></div>}</div></section></>;
}
