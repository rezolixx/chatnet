import { NotFoundContent } from "@/components/errors/NotFoundContent";

export default function PlayerNotFound() {
  return <NotFoundContent title="Joueur introuvable." description="Aucun score n’est enregistré pour ce pseudo dans les jeux Chatnet." guidance="Vérifiez l’orthographe du pseudo ou consultez le classement des joueurs." destination={{ href: "/jeux/classement", label: "Voir le classement" }} />;
}
