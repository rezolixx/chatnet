import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { publicMemberModules } from "./helpers/public-member.mjs";

function render(path) {
  const modules = publicMemberModules(() => assert.fail("Not-found content must not fetch data"));
  return renderToStaticMarkup(modules.load(path).default());
}

test("global 404 renders French guidance and accessible recovery links", () => {
  const html = render("app/not-found.tsx");
  assert.match(html, /<h1 id="not-found-title">Page introuvable<\/h1>/);
  assert.match(html, /La page que vous recherchez n’existe pas ou a peut-être été déplacée\./);
  assert.match(html, /Vous pouvez retourner à l’accueil ou explorer les salons\./);
  assert.match(html, /href="\/"[^>]*>Retour à l’accueil/);
  assert.match(html, /href="\/salons"[^>]*>Voir les salons<\/a>/);
  assert.match(html, /aria-labelledby="not-found-title"/);
  assert.match(html, /<span class="sr-only">Erreur 404<\/span>/);
});

test("404 decoration is local, hidden from accessibility and contains no network or interactive dependency", () => {
  const html = render("app/not-found.tsx");
  assert.match(html, /<svg class="not-found-illustration"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(html, /fill="url\(#not-found-digits\)"/);
  assert.doesNotMatch(html, /https?:|<img|<image|<script|<iframe|<foreignObject|tabindex=/i);
  assert.equal((html.match(/<svg/g) ?? []).length, 2);
});

test("room 404 keeps the intentional room message and directory action", () => {
  const html = render("app/salons/[channel]/not-found.tsx");
  assert.match(html, /Salon introuvable\./);
  assert.match(html, /Ce salon ne figure pas dans la liste publique des salons enregistrés\./);
  assert.match(html, /href="\/salons"[^>]*>Retour aux salons<\/a>/);
});

test("member 404 keeps the intentional profile message and community action", () => {
  const html = render("app/membre/[nickname]/not-found.tsx");
  assert.match(html, /Profil introuvable\./);
  assert.match(html, /Ce profil membre n’est pas disponible\./);
  assert.match(html, /href="\/communaute"[^>]*>Retour à la communauté<\/a>/);
});
