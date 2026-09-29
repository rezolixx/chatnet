export const homeFaq = [
  {
    question: "Qu’est-ce que Chatnet ?",
    answer: "Chatnet est un chat en ligne francophone avec des salons de discussion et une communauté à découvrir.",
  },
  {
    question: "Peut-on rejoindre le chat sans compte ?",
    answer: "Oui. Depuis la page d’accueil, vous pouvez choisir un pseudo et remplir le formulaire pour entrer comme invité.",
  },
  {
    question: "Comment trouver un salon de discussion ?",
    answer: "Consultez la page Salons pour parcourir les salons enregistrés et découvrir leurs sujets.",
  },
  {
    question: "Peut-on utiliser Chatnet sur mobile ?",
    answer: "Le site Chatnet est conçu pour être consulté sur mobile comme sur ordinateur.",
  },
] as const;

export function HomeFaq() {
  return <section className="section home-faq-section" aria-labelledby="home-faq-title">
    <div className="container">
      <span className="eyebrow">Questions fréquentes</span>
      <h2 id="home-faq-title">Quelques réponses pour commencer.</h2>
      <div className="home-faq-grid">
        {homeFaq.map(({ question, answer }) => <div className="home-faq-item" key={question}>
          <h3>{question}</h3>
          <p>{answer}</p>
        </div>)}
      </div>
    </div>
  </section>;
}
