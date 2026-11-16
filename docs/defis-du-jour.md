# Défis du jour (`/jeux/defis`)

Page publique de DefisBot (`#defis`). Toutes les données viennent des routes **publiques** de la
Game API (`chatnet-game-system`, `docs/api.md` § Défis), lues côté serveur seulement
(`src/lib/api/defis.server.ts`, revalidation 30 s, délai 4 s) :

| Route | Usage |
|---|---|
| `GET /api/defis/status` | badge de disponibilité de la carte `/jeux` et de la page |
| `GET /api/defis/current` | défi en cours, **seulement après son annonce** dans #defis ; jamais de réponse ni d'indice |
| `GET /api/defis/leaderboards/{day,month,all}?limit=10` | trois classements (calendrier Africa/Tunis) |

**Disponibilité jamais supposée.** « Disponible dans le chat » n'apparaît que si la Game API
répond `available: true` **et** `status: "available"` (bail du bot vivant, battement < 90 s,
connecté, dans #defis, pseudo DefisBot obtenu, opérateur, jeu en cours). Réponse incohérente,
erreur ou délai : « Momentanément indisponible ». Game API non configurée
(`GAME_API_BASE_URL` absent) : « Ouverture prochaine ». Aucune variable du type
`GAMES_DEFIS_OPEN` n'existe : l'état ne se force pas à la main.

Le formulaire « Rejoindre » ouvre le WebChat directement dans `#defis`. Les réponses se donnent
en conversation privée avec DefisBot (bouton « Répondre au défi » du WebChat ou clic sur son
pseudo) ; aucune commande « / » n'est suggérée.

Visuels : `public/games/defisbot.webp` (1200×1200) et `defisbot-card.webp` (1600×740), dérivés de
l'illustration officielle de DefisBot fournie (robot au trophée).

Configuration : aucune nouvelle variable ; `GAME_API_BASE_URL` existante suffit.
Tests : `tests/games.test.mjs` (statuts vérifiés, page complète, Game API en panne, visuels).
