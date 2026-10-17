import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { elements } from "./helpers/password-form.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../src/", import.meta.url));
const jsx = React.createElement;
const byType = (tree, type) => elements(tree, (el) => el.type === type);

const APPROVED_TEN_PARAGRAPHS = [
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
];

const CONFIRMED_INTERNAL_HREFS = new Set([
  "/",
  "/#rejoindre",
  "/#salons",
  "/#a-propos",
  "/#faq",
  "#faq-cat-premiers-pas",
  "#faq-cat-comptes-et-profils",
  "#faq-cat-salons-et-conversations",
  "#faq-cat-securite-et-assistance",
  "#faq-cat-experience-technique",
  "/salons",
  "/communaute",
  "/communaute#valeurs",
  "/jeux",
  "/a-propos",
  "/contact",
  "/assistance",
  "/inscription",
  "/connexion",
  "/mot-de-passe-oublie",
  "/profil",
  "/conditions",
  "/confidentialite",
  "/mentions-legales",
  "/cookies",
]);

function createHarness({ document = { getElementById: () => null } } = {}) {
  const slots = [];
  const records = new Map();
  let index = 0;

  const hooks = {
    ...React,
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) {
        slots[slot] = typeof initial === "function" ? initial() : initial;
      }
      return [
        slots[slot],
        (next) => {
          slots[slot] = typeof next === "function" ? next(slots[slot]) : next;
        },
      ];
    },
  };

  const context = vm.createContext({
    URL,
    AbortSignal,
    document,
    process: { env: {} },
    fetch: async (url) => {
      const target = String(url);
      if (target.includes("chan-list")) {
        return new Response(JSON.stringify([{ channel: "#Accueil", topic: "Bienvenue sur Chatnet" }]), { status: 200 });
      }
      return new Response(JSON.stringify({ members: [] }), { status: 200 });
    },
  });

  function load(relative) {
    let file = resolve(root, relative);
    if (!/\.tsx?$/.test(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (records.has(file)) return records.get(file).exports;
    const record = { exports: {} };
    records.set(file, record);

    const localRequire = (specifier) => {
      if (specifier === "react") return hooks;
      if (specifier === "server-only" || specifier.endsWith(".css")) return {};
      if (specifier === "next/cache") return { unstable_cache: (fn) => fn };
      if (specifier === "next/font/local") return () => ({ variable: "--font-geist" });
      if (specifier === "next/link") {
        return {
          __esModule: true,
          default: ({ href, children, ...props }) => jsx("a", { href, ...props }, children),
        };
      }
      if (specifier === "next/image") {
        return {
          __esModule: true,
          default: ({ src, alt, priority: _priority, ...props }) => jsx("img", { src, alt, ...props }),
        };
      }
      if (specifier === "@/components/auth/AuthProvider") {
        return { useAuth: () => ({ user: null, loading: false, refreshUser: async () => {} }) };
      }
      if (specifier.startsWith("@/")) return load(specifier.slice(2));
      if (specifier.startsWith(".")) return load(resolve(dirname(file), specifier));
      return require(specifier);
    };

    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;

    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(
      localRequire,
      record,
      record.exports
    );
    return record.exports;
  }

  return {
    load,
    renderComponent(mod, name, props = {}) {
      index = 0;
      let tree = mod[name](props);
      while (tree && typeof tree.type === "function") {
        tree = tree.type(tree.props);
      }
      return tree;
    },
  };
}

test("homepage About section renders all 10 approved paragraphs in exact order with required eyebrow and H2", () => {
  const harness = createHarness();
  const aboutMod = harness.load("components/home/HomeSeoContent.tsx");

  assert.equal(aboutMod.homeAboutEyebrow, "DÉCOUVREZ CHATNET.FR");
  assert.equal(
    aboutMod.homeAboutHeading,
    "Chatnet.fr, un espace de discussion francophone ouvert à tous"
  );
  assert.equal(aboutMod.homeAboutParagraphs.length, 10);
  assert.deepEqual([...aboutMod.homeAboutParagraphs], APPROVED_TEN_PARAGRAPHS);

  const tree = harness.renderComponent(aboutMod, "HomeSeoContent");
  const paragraphs = byType(tree, "p").map((el) => el.props.children);
  assert.equal(paragraphs.length, 10);
  assert.deepEqual(paragraphs, APPROVED_TEN_PARAGRAPHS);

  const headings = byType(tree, "h2");
  assert.equal(headings.length, 1);
  assert.equal(headings[0].props.children, "Chatnet.fr, un espace de discussion francophone ouvert à tous");
  assert.equal(byType(tree, "h1").length, 0);

  const html = renderToStaticMarkup(tree);
  for (const paragraph of APPROVED_TEN_PARAGRAPHS) {
    assert.ok(html.includes(paragraph), `Expected rendered HTML to include paragraph: ${paragraph.slice(0, 40)}...`);
  }
});

test("homepage preserves single H1, existing sections, and synchronized FAQPage JSON-LD", async () => {
  const harness = createHarness();
  const homePageMod = harness.load("app/page.tsx");
  const faqMod = harness.load("components/home/HomeFaq.tsx");

  const tree = await homePageMod.default();
  const html = renderToStaticMarkup(tree);

  const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  assert.equal(h1Matches.length, 1);
  assert.match(h1Matches[0], /Les belles conversations commencent <em>ici\.<\/em>/);
  assert.match(html, /Chatnet\.fr, un espace de discussion francophone ouvert à tous/);
  assert.match(html, /Tout savoir pour discuter sereinement sur Chatnet\.fr/);

  const scripts = byType(tree, "script");
  assert.equal(scripts.length, 2);
  const schemas = scripts.map((s) => JSON.parse(s.props.dangerouslySetInnerHTML.__html));
  const websiteSchema = schemas.find((s) => s["@type"] === "WebSite");
  const faqSchema = schemas.find((s) => s["@type"] === "FAQPage");

  assert.ok(websiteSchema);
  assert.equal(websiteSchema.url, "https://chatnet.fr");
  assert.ok(faqSchema);
  assert.equal(faqSchema.mainEntity.length, faqMod.homeFaq.length);
  assert.deepEqual(
    JSON.parse(JSON.stringify(faqSchema.mainEntity.map((q) => ({ question: q.name, answer: q.acceptedAnswer.text })))),
    JSON.parse(JSON.stringify(faqMod.homeFaq.map(({ question, answer }) => ({ question, answer }))))
  );
});

test("FAQ contains 5 categories, unique questions/answers, crawlable HTML, and zero IRC terminology", () => {
  const harness = createHarness();
  const faqMod = harness.load("components/home/HomeFaq.tsx");

  assert.equal(faqMod.homeFaqCategories.length, 5);
  assert.ok(faqMod.homeFaq.length >= 15);

  const seenQuestions = new Set();
  const seenAnswers = new Set();
  const forbiddenIrcPattern =
    /(\/(join|msg|nick|whois|mode|part|quit|oper|ns|cs)\b|\b(irc|ircd|unrealircd|nickserv|chanserv|operserv|anope|webirc|znc|mirc|hexchat|irssi|weechat)\b|\b6667\b|\b6697\b)/i;

  for (const item of faqMod.homeFaq) {
    assert.ok(!seenQuestions.has(item.question), `Duplicate FAQ question: ${item.question}`);
    assert.ok(!seenAnswers.has(item.answer), `Duplicate FAQ answer for: ${item.question}`);
    seenQuestions.add(item.question);
    seenAnswers.add(item.answer);

    assert.doesNotMatch(
      `${item.question} ${item.answer}`,
      forbiddenIrcPattern,
      `Forbidden technical IRC term found in FAQ entry: ${item.question}`
    );
    if (item.id !== "faq-suppression-compte") {
      assert.doesNotMatch(
        `${item.question} ${item.answer}`,
        /365\s*jours|supprimé automatiquement/i,
        `Inactivity deletion details belong in the account-deletion FAQ: ${item.question}`
      );
    }
  }

  const deletionItem = faqMod.homeFaq.find((item) => item.id === "faq-suppression-compte");
  assert.ok(deletionItem, "Expected manual account deletion FAQ entry");
  assert.match(deletionItem.answer, /Supprimer mon compte/);
  assert.match(deletionItem.answer, /SUPPRIMER/);
  assert.match(deletionItem.answer, /Supprimer définitivement/);
  assert.match(deletionItem.question, /365 jours d’inactivité/);
  assert.match(deletionItem.answer, /365 jours/);
  assert.match(deletionItem.answer, /30 jours et 7 jours/);
  assert.match(deletionItem.answer, /supprimé automatiquement/);
  assert.match(deletionItem.answer, /reconnexion avant la suppression/);

  for (const paragraph of harness.load("components/home/HomeSeoContent.tsx").homeAboutParagraphs) {
    assert.doesNotMatch(paragraph, forbiddenIrcPattern);
  }

  const tree = harness.renderComponent(faqMod, "HomeFaq");
  const html = renderToStaticMarkup(tree);

  for (const item of faqMod.homeFaq) {
    assert.ok(html.includes(item.question), `Missing FAQ question in SSR HTML: ${item.question}`);
    assert.ok(html.includes(item.answer), `Missing FAQ answer in SSR HTML: ${item.question}`);
  }
});

test("FAQ accordion is keyboard-accessible and supports individual and bulk toggling", () => {
  const focusedIds = [];
  const harness = createHarness({
    document: {
      getElementById: (id) => ({
        focus() {
          focusedIds.push(id);
        },
      }),
    },
  });
  const faqMod = harness.load("components/home/HomeFaq.tsx");
  const render = () => harness.renderComponent(faqMod, "HomeFaq");

  const getItemButtons = (tree) =>
    byType(tree, "button").filter((btn) => btn.props.className === "home-faq-trigger");

  let tree = render();
  let triggers = getItemButtons(tree);
  assert.equal(triggers.length, faqMod.homeFaq.length);

  // First item of each category is open by default; verify ARIA attributes.
  assert.equal(triggers[0].props["aria-expanded"], true);
  assert.equal(triggers[1].props["aria-expanded"], false);
  assert.equal(triggers[0].props["aria-controls"], `${faqMod.homeFaq[0].id}-panel`);

  // Clicking a closed item opens it.
  triggers[1].props.onClick();
  tree = render();
  triggers = getItemButtons(tree);
  assert.equal(triggers[1].props["aria-expanded"], true);

  // Clicking "Tout déplier" expands all items, and clicking "Tout replier" collapses all.
  const toggleAllBtn = () =>
    byType(render(), "button").find((btn) =>
      String(btn.props.className).includes("home-faq-toggle-all")
    );
  assert.equal(toggleAllBtn().props.children, "Tout déplier");
  toggleAllBtn().props.onClick();
  assert.ok(getItemButtons(render()).every((btn) => btn.props["aria-expanded"] === true));
  assert.equal(toggleAllBtn().props.children, "Tout replier");

  toggleAllBtn().props.onClick();
  assert.ok(getItemButtons(render()).every((btn) => btn.props["aria-expanded"] === false));

  // Keyboard navigation between accordion triggers (ArrowDown, ArrowUp, Home, End).
  triggers = getItemButtons(render());
  triggers[0].props.onKeyDown({ key: "ArrowDown", preventDefault() {} });
  triggers[0].props.onKeyDown({ key: "ArrowUp", preventDefault() {} });
  triggers[2].props.onKeyDown({ key: "Home", preventDefault() {} });
  triggers[0].props.onKeyDown({ key: "End", preventDefault() {} });

  assert.deepEqual(focusedIds, [
    `${faqMod.homeFaq[1].id}-trigger`,
    `${faqMod.homeFaq[faqMod.homeFaq.length - 1].id}-trigger`,
    `${faqMod.homeFaq[0].id}-trigger`,
    `${faqMod.homeFaq[faqMod.homeFaq.length - 1].id}-trigger`,
  ]);
});

test("internal links across About section, FAQ, /a-propos, and Footer use only confirmed routes", () => {
  const harness = createHarness();
  const aboutMod = harness.load("components/home/HomeSeoContent.tsx");
  const faqMod = harness.load("components/home/HomeFaq.tsx");
  const aboutPageMod = harness.load("app/a-propos/page.tsx");
  const footerMod = harness.load("components/layout/Footer.tsx");

  const trees = [
    harness.renderComponent(aboutMod, "HomeSeoContent"),
    harness.renderComponent(faqMod, "HomeFaq"),
    aboutPageMod.default(),
    footerMod.Footer(),
  ];

  for (const tree of trees) {
    const html = renderToStaticMarkup(tree);
    const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0);
    for (const href of hrefs) {
      assert.ok(
        CONFIRMED_INTERNAL_HREFS.has(href),
        `Unconfirmed internal href found: ${href}`
      );
    }
  }

  // Verify /a-propos does not duplicate the 10 homepage paragraphs.
  const aboutPageHtml = renderToStaticMarkup(aboutPageMod.default());
  for (const paragraph of APPROVED_TEN_PARAGRAPHS) {
    assert.ok(
      !aboutPageHtml.includes(paragraph),
      "/a-propos should not duplicate the 10 homepage About paragraphs"
    );
  }
  assert.equal(aboutPageMod.metadata.alternates.canonical, "https://chatnet.fr/a-propos");
});

test("SEO metadata, canonical URL, robots.txt, and sitemap remain intact without regression", () => {
  const harness = createHarness();
  const layoutMod = harness.load("app/layout.tsx");
  const sitemapMod = harness.load("app/sitemap.ts");
  const robotsMod = harness.load("app/robots.ts");
  const indexableMod = harness.load("lib/seo/indexable.ts");

  assert.equal(layoutMod.metadata.alternates.canonical, "https://chatnet.fr");
  assert.equal(
    layoutMod.metadata.title.default,
    "Chatnet — Chat en ligne et communauté francophone"
  );
  assert.equal(layoutMod.metadata.openGraph.url, "https://chatnet.fr");
  assert.equal(layoutMod.metadata.openGraph.locale, "fr_FR");

  assert.deepEqual(JSON.parse(JSON.stringify(indexableMod.indexablePaths)), [
    "/",
    "/salons",
    "/communaute",
    "/jeux",
    "/a-propos",
    "/contact",
  ]);

  const sitemapEntries = JSON.parse(JSON.stringify(sitemapMod.default()));
  assert.equal(sitemapEntries.length, 6);
  assert.equal(sitemapEntries[0].url, "https://chatnet.fr/");
  assert.equal(sitemapEntries[0].priority, 1);

  const robotsConfig = JSON.parse(JSON.stringify(robotsMod.default()));
  assert.equal(robotsConfig.sitemap, "https://chatnet.fr/sitemap.xml");
  assert.equal(robotsConfig.rules.allow, "/");
  assert.equal(robotsConfig.rules.disallow, "/connexion");
});
