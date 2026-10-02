import { NotFoundContent } from "@/components/errors/NotFoundContent";

export default function MemberNotFound() {
  return <NotFoundContent title="Profil introuvable." description="Ce profil membre n’est pas disponible." guidance="Vous pouvez retourner à l’accueil ou découvrir la communauté." destination={{ href: "/communaute", label: "Retour à la communauté" }} />;
}
