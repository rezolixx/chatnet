import { HomeFaqClient } from "@/components/home/HomeFaqClient";
import { joinHref } from "@/lib/site";

export type FaqLink = {
  label: string;
  href: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  links?: readonly FaqLink[];
};

export type FaqCategory = {
  id: string;
  title: string;
  description: string;
  icon: "chat" | "users" | "globe" | "shield" | "device";
  items: readonly FaqItem[];
};

export const homeFaqCategories: readonly FaqCategory[] = [
  {
    id: "premiers-pas",
    title: "Premiers pas",
    description: "Accéder au chat gratuitement, choisir un pseudo et rejoindre votre premier salon de discussion.",
    icon: "chat",
    items: [
      {
        id: "faq-commencer-discuter",
        question: "Comment commencer à discuter sur Chatnet.fr ?",
        answer:
          "Depuis la page d’accueil ou la page d’un salon, indiquez un pseudo, votre âge, votre genre (Homme ou Femme) ainsi que votre ville ou pays, puis cliquez sur « Rejoindre le Chat ». Si vous êtes déjà connecté à votre compte membre, votre carte de profil s’affiche directement : un simple clic sur « Rejoindre le Chat » ouvre la discussion dans un nouvel onglet.",
        links: [
          { label: "Accéder au formulaire d’entrée", href: joinHref },
          { label: "Parcourir les salons", href: "/salons" },
        ],
      },
      {
        id: "faq-acces-gratuit-sans-inscription",
        question: "L’accès au chat est-il gratuit et faut-il obligatoirement s’inscrire ?",
        answer:
          "Oui, l’accès à Chatnet.fr et aux salons de discussion publics est entièrement gratuit. L’inscription n’est pas obligatoire : vous pouvez entrer comme invité pour observer les échanges et participer à votre rythme. La création d’un compte reste facultative et sert principalement à réserver votre pseudo et à conserver votre profil membre.",
        links: [{ label: "Créer un compte membre", href: "/inscription" }],
      },
      {
        id: "faq-age-minimum-choix-pseudo",
        question: "Quel est l’âge minimum et comment choisir son pseudo ?",
        answer:
          "Chatnet.fr est réservé aux personnes âgées d’au moins 16 ans (le formulaire d’entrée accepte un âge compris entre 16 et 99 ans). En accès invité, votre pseudo doit contenir entre 2 et 16 caractères (lettres sans accent, chiffres ou symboles usuels comme le tiret et le tiret bas). Pour enregistrer un compte membre, le pseudo choisi doit compter entre 4 et 20 caractères (lettres, chiffres ou tiret bas).",
      },
      {
        id: "faq-rejoindre-salon-precis",
        question: "Comment rejoindre directement un salon de discussion précis ?",
        answer:
          "Rendez-vous sur la page Salons pour explorer les espaces disponibles et rechercher un thème ou un sujet. Cliquez sur « Voir le salon » pour consulter sa présentation, puis validez la carte « Ouvrir le salon » afin d’entrer directement dans cette discussion. Lorsque vous entrez depuis la page d’accueil, vous rejoignez par défaut le salon principal #Accueil.",
        links: [{ label: "Explorer tous les salons", href: "/salons" }],
      },
      {
        id: "faq-utiliser-chatnet-mobile",
        question: "Peut-on utiliser Chatnet.fr sur téléphone mobile ou tablette ?",
        answer:
          "Oui, Chatnet.fr fonctionne directement dans le navigateur web de votre téléphone, de votre tablette ou de votre ordinateur, sans application à télécharger. Sur mobile, l’interface de discussion adapte ses panneaux : le bouton de menu en haut à gauche ouvre la liste des salons et des messages privés, tandis que le bouton en haut à droite affiche les participants présents dans le salon.",
      },
    ],
  },
  {
    id: "comptes-et-profils",
    title: "Comptes et profils",
    description: "Création de compte, réservation du pseudo, gestion du profil et récupération d’accès.",
    icon: "users",
    items: [
      {
        id: "faq-creer-compte-avantages",
        question: "Comment créer un compte membre et quels sont ses avantages ?",
        answer:
          "Sur la page S’inscrire, renseignez un pseudo (4 à 20 caractères), une adresse e-mail, votre date de naissance (16 ans minimum), votre genre, votre pays et un mot de passe d’au moins 10 caractères sans espace. Le compte membre permet de réserver votre pseudo, d’être reconnu automatiquement à l’ouverture du chat, d’ajouter une photo de profil, d’apparaître sur la page Communauté et de contacter l’équipe via l’espace Assistance.",
        links: [
          { label: "S’inscrire sur Chatnet", href: "/inscription" },
          { label: "Découvrir la communauté", href: "/communaute" },
        ],
      },
      {
        id: "faq-se-connecter-espace-membre",
        question: "Comment se connecter et entrer sur le chat avec son compte ?",
        answer:
          "Cliquez sur « Se connecter » dans la barre de navigation et saisissez votre pseudo (ou votre adresse e-mail) ainsi que votre mot de passe. Une fois connecté, la page d’accueil et les pages de salons remplacent le formulaire invité par votre carte « Membre Chatnet » : cliquez sur « Rejoindre le Chat » pour ouvrir la discussion avec votre pseudo réservé.",
        links: [{ label: "Se connecter", href: "/connexion" }],
      },
      {
        id: "faq-pseudo-deja-utilise",
        question: "Que se passe-t-il si le pseudo que j’ai choisi est déjà utilisé ou réservé ?",
        answer:
          "Lors d’une inscription sur le site, un message vous prévient immédiatement si le pseudo est déjà pris afin d’en choisir un autre. Si vous entrez dans le chat en invité avec un pseudo réservé par un membre, une fenêtre « Identifier mon pseudo » s’ouvre automatiquement : vous pouvez alors saisir le mot de passe du compte correspondant ou cliquer sur « Choisir un autre pseudo ». Sans action de votre part, un autre pseudo vous est attribué après environ une minute.",
      },
      {
        id: "faq-modifier-profil-photo-mot-de-passe",
        question: "Comment modifier mon profil, ma photo ou mon mot de passe ?",
        answer:
          "Une fois connecté, cliquez sur votre pseudo en haut du site pour accéder à « Mon profil ». Vous pouvez y importer une photo de profil (« Changer la photo », formats JPEG, PNG, GIF ou WebP jusqu’à 4 Mo), modifier votre date de naissance ou votre pays via le bouton « Modifier », et mettre à jour votre mot de passe dans la section « Sécurité du compte ». Le pseudo, le genre et l’adresse e-mail ne sont pas modifiables depuis cette page.",
        links: [{ label: "Gérer mon profil", href: "/profil" }],
      },
      {
        id: "faq-mot-de-passe-oublie",
        question: "Comment récupérer l’accès à mon compte en cas de mot de passe oublié ?",
        answer:
          "Depuis la page de connexion, cliquez sur « Mot de passe oublié ? », indiquez l’adresse e-mail associée à votre compte et validez « Envoyer le lien ». Vous recevrez un lien de réinitialisation valable pendant une heure (l’e-mail est expédié par Discut.org, qui héberge les comptes de l’écosystème Chatnet). Après avoir choisi votre nouveau mot de passe, revenez sur Chatnet.fr pour vous connecter.",
        links: [{ label: "Mot de passe oublié ?", href: "/mot-de-passe-oublie" }],
      },
      {
        id: "faq-suppression-inactivite-compte",
        question: "Peut-on supprimer son compte et que devient un compte inactif ?",
        answer:
          "Oui. Dans « Mon profil », la rubrique « Supprimer mon compte » permet d’effacer définitivement votre compte et de libérer votre pseudo après avoir saisi votre mot de passe actuel et confirmé avec le mot « SUPPRIMER ». Par ailleurs, un compte resté sans activité sur le site ni sur le chat pendant 365 jours fait l’objet d’une notification par e-mail avant sa suppression automatique en l’absence de reconnexion.",
      },
    ],
  },
  {
    id: "salons-et-conversations",
    title: "Salons et conversations",
    description: "Navigation entre les salons, messages privés, partage de médias et outils du chat.",
    icon: "globe",
    items: [
      {
        id: "faq-parcourir-rejoindre-quitter-salons",
        question: "Comment parcourir, rejoindre ou quitter des salons une fois dans le chat ?",
        answer:
          "Dans la colonne de gauche « Conversations » du chat, la section « Salons » regroupe vos discussions actives. Cliquez sur « Parcourir les salons » (ou ouvrez le menu « Plus d’options » ⋯) pour chercher un salon par nom ou par sujet et voir le nombre de participants connectés, ou utilisez « Rejoindre un salon » pour saisir directement son nom. L’étoile permet d’épingler un salon dans « Favoris », et la croix « × » permet de le quitter.",
      },
      {
        id: "faq-interagir-participants-salon",
        question: "Comment répondre à un message, mentionner quelqu’un ou partager des médias ?",
        answer:
          "Survolez un message (ou touchez-le sur mobile) et cliquez sur la flèche « Répondre » pour citer votre interlocuteur, ou tapez « @ » suivi du début d’un pseudo pour mentionner un participant. La barre de rédaction permet d’ajouter des Emojis, de « Joindre une photo » (jusqu’à 10 Mo) et d’« Enregistrer un message vocal » (jusqu’à 2 minutes). Les liens YouTube partagés affichent un aperçu vidéo directement dans le fil.",
      },
      {
        id: "faq-conversations-privees",
        question: "Les conversations privées entre participants sont-elles disponibles ?",
        answer:
          "Oui. Cliquez sur le pseudo d’un participant dans la liste « Membres du salon » à droite, ou ouvrez sa fiche « Profil » depuis un message puis choisissez « Envoyer un message ». Vos échanges privés s’affichent dans la rubrique « Messages privés » à gauche, avec l’état de présence (« En ligne » ou « Hors ligne ») et un indicateur d’écriture. Si vous placez une conversation privée en favori, les 50 derniers messages sont conservés dans votre navigateur.",
      },
      {
        id: "faq-changer-pseudo-radio-recherche",
        question: "Peut-on changer de pseudo en cours de discussion, chercher un message ou écouter la radio ?",
        answer:
          "Oui. En bas de la colonne de gauche du chat, l’icône de crayon à côté de votre pseudo (ou l’option « Changer de pseudo » dans le menu « Plus d’options » ⋯) permet de modifier votre pseudo à tout moment. La loupe en haut d’un salon permet de « Rechercher dans la conversation », l’outil « Rechercher des membres » filtre les participants par pseudo, salon ou genre, et le lecteur « Radio » intégré peut être réduit tout en continuant la lecture.",
      },
    ],
  },
  {
    id: "securite-et-assistance",
    title: "Sécurité et assistance",
    description: "Blocage, signalement, modération des salons et contact avec l’équipe Chatnet.",
    icon: "shield",
    items: [
      {
        id: "faq-bloquer-signaler-utilisateur",
        question: "Comment bloquer ou signaler un utilisateur au comportement inapproprié ?",
        answer:
          "Dans une conversation privée, ouvrez le menu « Plus d’options » (⋯) et cliquez sur « Bloquer les messages de… » pour ne plus recevoir ses messages ; la liste « Utilisateurs bloqués » du même menu permet de les débloquer à tout moment. Pour envoyer un signalement à l’équipe de modération depuis le chat, ouvrez la fiche « Profil » de la personne concernée, cliquez sur « Signaler cet utilisateur » et décrivez le motif en au moins quatre mots.",
      },
      {
        id: "faq-fonctionnement-moderation-regles",
        question: "Comment fonctionne la modération et où consulter les règles de la communauté ?",
        answer:
          "Les salons sont animés et modérés par des responsables identifiables grâce à un badge à côté de leur pseudo dans la liste des participants. Ils veillent au respect du cadre commun : courtoisie, absence d’insultes, de harcèlement, de spam ou de contenus illégaux. En cas d’abus grave ou répété, un compte peut être suspendu temporairement ou banni. Les engagements de convivialité sont détaillés sur les pages Communauté et Conditions d’utilisation.",
        links: [
          { label: "Nos valeurs communautaires", href: "/communaute#valeurs" },
          { label: "Conditions d’utilisation", href: "/conditions" },
        ],
      },
      {
        id: "faq-contacter-assistance-support",
        question: "Comment contacter l’équipe Chatnet ou demander de l’aide ?",
        answer:
          "Rendez-vous sur la page Contact pour connaître les moyens d’assistance. Si vous possédez un compte membre, cliquez sur « Assistance » dans la barre de navigation (ou sur « Ouvrir un ticket d’assistance » depuis la page Contact) pour transmettre directement votre question, suggestion ou signalement à l’équipe. Vous pouvez également rejoindre le serveur Discord officiel depuis l’icône située dans l’en-tête du site.",
        links: [
          { label: "Page Contact", href: "/contact" },
          { label: "Ouvrir un ticket d’assistance", href: "/assistance" },
        ],
      },
    ],
  },
  {
    id: "experience-technique",
    title: "Expérience sur mobile et navigateur",
    description: "Thème clair ou sombre, alertes sonores et résolution des problèmes de connexion.",
    icon: "device",
    items: [
      {
        id: "faq-theme-sombre-notifications",
        question: "Comment activer le thème sombre et régler les notifications du chat ?",
        answer:
          "Sur le site Chatnet.fr, l’icône de soleil ou de lune dans la barre de navigation permet de basculer entre le thème clair et le thème sombre. Dans le chat, ouvrez le menu « Plus d’options » (⋯) en haut à droite pour activer ou couper le « Thème sombre » ainsi que les « Sons de notification ». Vous pouvez aussi autoriser les notifications du navigateur pour être averti des mentions et des messages privés lorsque l’onglet est en arrière-plan.",
      },
      {
        id: "faq-probleme-ouverture-connexion",
        question: "Que faire si la fenêtre de chat ne s’ouvre pas ou si la connexion échoue ?",
        answer:
          "L’ouverture du chat s’effectue dans un nouvel onglet lorsque vous cliquez sur « Rejoindre le Chat » : si rien ne s’ouvre, autorisez les fenêtres pop-up pour chatnet.fr dans votre navigateur puis réessayez. En cas d’échec de connexion à votre compte membre, vérifiez votre pseudo ou e-mail, utilisez le lien « Mot de passe oublié ? » si besoin, ou consultez la page Contact si un encadré vous informe d’une suspension ou d’une restriction de compte.",
        links: [
          { label: "Réinitialiser mon mot de passe", href: "/mot-de-passe-oublie" },
          { label: "Contacter l’équipe", href: "/contact" },
        ],
      },
    ],
  },
] as const;

export const homeFaq = homeFaqCategories.flatMap((category) =>
  category.items.map((item) => ({
    ...item,
    categoryId: category.id,
    category: category.title,
  }))
);

export function HomeFaq() {
  return <HomeFaqClient categories={homeFaqCategories} />;
}


