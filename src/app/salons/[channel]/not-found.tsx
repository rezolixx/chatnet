import { NotFoundContent } from "@/components/errors/NotFoundContent";

export default function RoomNotFound() {
  return <NotFoundContent title="Salon introuvable." description="Ce salon ne figure pas dans la liste publique des salons enregistrés." guidance="Vous pouvez retourner à l’accueil ou découvrir les autres salons." destination={{ href: "/salons", label: "Retour aux salons" }} />;
}
