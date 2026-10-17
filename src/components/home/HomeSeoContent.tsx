import Link from "next/link";
import { ActionLink } from "@/components/ui/ActionLink";
import { Icon } from "@/components/ui/Icons";
import { joinHref } from "@/lib/site";

export const homeAboutEyebrow = "DÉCOUVREZ CHATNET.FR";
export const homeAboutHeading = "Chatnet.fr, un espace de discussion francophone ouvert à tous";

export const homeAboutParagraphs = [
  "Chatnet.fr, c’est d’abord une idée simple : retrouver le plaisir du vrai chat en ligne, sans prise de tête, sans usine à gaz, dans un environnement francophone où on peut discuter de tout et de rien, à n’importe quelle heure. Le site s’adresse à celles et ceux qui aiment les conversations spontanées, les échanges directs, les petites communautés qui se connaissent, mais aussi les nouveaux arrivants qui cherchent un endroit où se poser, observer, puis participer quand ils se sentent à l’aise. Ici, on ne cherche pas à faire du bruit pour rien : on veut des discussions qui vivent, qui durent, et qui donnent envie de revenir.",
  "Quand on arrive sur Chatnet.fr, on découvre des salons de discussion organisés par thèmes, par centres d’intérêt ou simplement par ambiance. Certains espaces sont plutôt orientés détente, avec des discussions légères, des blagues, des anecdotes du quotidien. D’autres salons sont plus sérieux, tournés vers la technologie, le gaming, l’actualité, la culture ou les débats d’idées. L’objectif n’est pas de tout contrôler, mais de proposer un cadre où chacun peut trouver sa place, que ce soit pour parler de son jeu préféré, de son dernier projet, de musique, de séries, ou juste pour passer un moment à discuter avec des gens qu’il ne connaît pas encore.",
  "La plateforme a été pensée pour rester simple à utiliser. Pas besoin de lire un manuel ou de passer par dix écrans avant de pouvoir dire bonjour : on arrive, on choisit un pseudo, on entre dans un salon, et la conversation peut commencer. L’interface est volontairement épurée, sans effets inutiles, pour laisser la place au texte, aux échanges et aux interactions. Que l’on soit sur ordinateur ou sur mobile, l’idée est de pouvoir suivre les discussions facilement, sans se perdre dans des menus compliqués. Les habitués des anciens espaces de discussion ou des forums retrouveront une certaine familiarité, tout en profitant d’un environnement plus moderne et plus accessible.",
  "Chatnet.fr accorde une importance particulière à l’ambiance générale et à la modération. Le but n’est pas de surveiller chaque phrase, mais de maintenir un climat respectueux, où les insultes gratuites, le harcèlement et les comportements toxiques n’ont pas leur place. Des règles simples sont mises en avant : respect des autres, pas de spam, pas de contenu illégal, pas de provocations gratuites. La modération intervient surtout pour rappeler le cadre, apaiser les tensions et protéger les utilisateurs quand c’est nécessaire. Cela permet de garder des salons agréables, où l’on peut discuter sans se demander à chaque message si quelqu’un va déraper.",
  "Au fil du temps, Chatnet.fr évolue en fonction des besoins de sa communauté. De nouveaux salons peuvent apparaître, certains disparaissent s’ils ne sont plus utilisés, et des ajustements sont faits pour améliorer le confort d’utilisation. L’équipe qui s’occupe du site observe les habitudes des utilisateurs, les heures d’affluence, les sujets qui reviennent souvent, et essaie de faire en sorte que la plateforme reste vivante, sans devenir un simple catalogue de salons vides. L’idée est de garder un équilibre entre stabilité et souplesse : des repères pour ceux qui reviennent tous les jours, mais aussi de la place pour de nouvelles idées et de nouveaux espaces de discussion.",
  "La dimension francophone est au cœur du projet. Chatnet.fr s’adresse en priorité aux utilisateurs qui veulent discuter en français, qu’ils soient en France, en Belgique, en Suisse, au Canada, dans les pays francophones ou ailleurs. Cela crée une base commune : une langue partagée, des références culturelles proches, des sujets qui parlent à tout le monde. On peut y croiser des profils très différents : des passionnés de technique, des joueurs, des curieux, des personnes qui viennent simplement pour rompre la solitude ou pour se changer les idées après une journée de travail. Cette diversité fait partie de l’identité du site.",
  "En termes de fonctionnement, Chatnet.fr ne cherche pas à se transformer en réseau social complexe avec des milliers de fonctionnalités. Le cœur du service reste le chat en temps réel, les messages qui s’enchaînent, les réactions, les petites discussions qui naissent au détour d’une phrase. On peut y passer quelques minutes pour dire bonsoir, ou y rester des heures à discuter avec un groupe qui finit par devenir familier. Certains utilisateurs finissent par se reconnaître, par se retrouver régulièrement dans les mêmes salons, et une forme de communauté se crée naturellement, sans que cela soit forcé.",
  "Pour ceux qui découvrent le site pour la première fois, l’entrée se veut simple et rassurante. On peut commencer par lire les conversations sans intervenir, prendre le temps de comprendre l’ambiance, voir comment les gens se parlent entre eux. Puis, quand on se sent prêt, on peut écrire un premier message, répondre à quelqu’un, poser une question ou lancer un sujet. Il n’y a pas de bonne ou de mauvaise façon de participer, tant que l’on reste dans le cadre du respect et de la convivialité. Chatnet.fr n’impose pas de rythme : chacun intervient à sa manière, selon son humeur et son temps disponible.",
  "La plateforme ne promet pas de tout révolutionner, mais elle assume une chose : remettre au centre le plaisir du chat francophone, avec des échanges simples, directs et humains. Dans un monde où beaucoup de services deviennent lourds, compliqués ou trop orientés vers la mise en avant de contenus automatisés, Chatnet.fr choisit de rester concentré sur les conversations entre personnes réelles. C’est ce qui fait sa particularité : un espace où l’on vient pour parler, écouter, réagir, et parfois se faire de nouveaux contacts, sans se perdre dans des fonctionnalités qui n’ont rien à voir avec le dialogue.",
  "En rejoignant Chatnet.fr, on fait le choix d’un endroit où le texte compte, où les discussions ont encore une place centrale, et où la communauté se construit au fil des messages. Que l’on soit là pour discuter de sujets sérieux, pour se détendre, pour suivre l’actualité ou simplement pour ne pas rester seul devant son écran, la plateforme offre un cadre francophone simple, vivant et accessible, qui laisse la place aux échanges authentiques.",
] as const;

export const homeAboutLinks = [
  { label: "Explorer les salons", href: "/salons" },
  { label: "Découvrir la communauté", href: "/communaute" },
  { label: "Créer un compte membre", href: "/inscription" },
  { label: "Se connecter", href: "/connexion" },
  { label: "Questions fréquentes", href: "/#faq" },
  { label: "En savoir plus sur Chatnet", href: "/a-propos" },
  { label: "Contact & assistance", href: "/contact" },
] as const;

export function HomeSeoContent() {
  return (
    <section className="section home-seo-section" id="a-propos" aria-labelledby="home-seo-title">
      <div className="container home-seo-layout">
        <div className="home-seo-intro">
          <span className="eyebrow">{homeAboutEyebrow}</span>
          <h2 id="home-seo-title">{homeAboutHeading}</h2>
          <div className="home-about-actions">
            <ActionLink href={joinHref} className="button button-primary">
              Rejoindre le Chat <Icon name="arrow" size={16} />
            </ActionLink>
            <Link href="/salons" className="button button-outline">
              Voir les salons
            </Link>
          </div>
          <nav className="home-about-nav" aria-label="Accès rapides Chatnet">
            {homeAboutLinks.map((item) => (
              <Link key={item.href} href={item.href} className="home-about-link">
                <span>{item.label}</span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </nav>
        </div>
        <div className="home-about-prose">
          {homeAboutParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

