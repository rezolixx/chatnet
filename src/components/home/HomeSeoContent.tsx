import Link from "next/link";
import { Icon } from "@/components/ui/Icons";

export function HomeSeoContent() {
  return <section className="section home-seo-section" aria-labelledby="home-seo-title">
    <div className="container home-seo-layout">
      <div className="home-seo-intro">
        <span className="eyebrow">Chat en ligne francophone</span>
        <h2 id="home-seo-title">Trouvez votre place dans la conversation.</h2>
        <p>Sur mobile ou sur ordinateur, découvrez des salons de discussion en français, faites connaissance avec la communauté francophone et échangez autour de vos centres d’intérêt.</p>
      </div>
      <div className="home-seo-links">
        <div>
          <h3>Choisissez un salon</h3>
          <p>Parcourez les salons enregistrés, découvrez leurs sujets et rejoignez une conversation qui vous parle.</p>
          <Link href="/salons" className="text-link">Explorer les salons <Icon name="arrow" size={17} /></Link>
        </div>
        <div>
          <h3>Découvrez la communauté</h3>
          <p>Faites connaissance avec les membres de Chatnet et retrouvez un espace de discussion ouvert aux francophones.</p>
          <Link href="/communaute" className="text-link">Voir la communauté <Icon name="arrow" size={17} /></Link>
        </div>
        <div>
          <h3>Entrez à votre rythme</h3>
          <p>Vous pouvez rejoindre le chat en invité depuis l’accueil ou vous connecter pour utiliser votre profil de membre.</p>
          <Link href="/a-propos" className="text-link">En savoir plus sur Chatnet <Icon name="arrow" size={17} /></Link>
        </div>
      </div>
    </div>
  </section>;
}
