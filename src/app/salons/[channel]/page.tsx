import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { ChatJoinForm } from "@/components/chat/ChatJoinForm";
import { getPublicRoom } from "@/lib/api/rooms.server";
import { pageMetadata } from "@/lib/metadata";
import { normalizeRoomName, normalizeRoomRouteParam, publicRoomHref, roomJoinName } from "@/lib/rooms";

type Props = { params: Promise<{ channel: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel } = await params;
  const result = await getPublicRoom(channel);
  const name = result.status === "found" ? normalizeRoomName(result.room.name) : null;
  return {
    ...pageMetadata(name ? `Salon #${name}` : "Salon de discussion", name ? `Consultez le sujet du salon #${name} et ouvrez le chat depuis Chatnet.` : "Consultez les salons de discussion Chatnet.", publicRoomHref(result.status === "found" ? result.room.name : normalizeRoomRouteParam(channel))),
    robots: { index: false, follow: true },
  };
}

export default async function RoomPage({ params }: Props) {
  const result = await getPublicRoom((await params).channel);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <><PageIntro eyebrow="Les salons Chatnet" title="Salon indisponible." description="Les informations du salon ne peuvent pas être chargées pour le moment." /><section className="section directory-section"><div className="container"><div className="empty-state" role="alert"><p>Réessayez dans quelques instants.</p><Link href="/salons" className="button button-outline">Retour aux salons</Link></div></div></section></>;
  const { room } = result;
  const name = normalizeRoomName(room.name)!;
  const selectedRoom = roomJoinName(room.name);
  return <><PageIntro eyebrow="Salon enregistré" title={`#${name}`} description="Découvrez le sujet de ce salon de discussion." /><section className="section directory-section"><div className="container"><Link href="/salons" className="button button-outline room-back">Retour aux salons</Link><div className="room-detail-grid"><article className="room-detail"><h2>Sujet du salon</h2><p className="room-topic">{room.topic ?? "Aucun sujet n’est renseigné pour ce salon."}</p></article><section className="room-join" aria-label={`Rejoindre le salon ${name}`}><h2>Ouvrir le salon #{name}</h2>{selectedRoom ? <ChatJoinForm selectedRoom={room.name} /> : <p role="alert">L’ouverture directe de ce salon n’est pas disponible avec son nom actuel. Vous pouvez le rechercher depuis le chat.</p>}</section></div></div></section></>;
}
