<!-- markdownlint-disable -->

> Cette page est en cours d'écriture. Le contenu détaillé sera transféré ici depuis le repo GitHub dans les jours qui viennent.

## À qui s'adresse cette page

Tu télécharges Nodea pour t'en faire **ta propre version** — comprendre comment c'est foutu, changer ce qui te chiffonne, faire tourner ta fork avec tes modifs. C'est ici.

Si tu cherches plutôt à **contribuer au projet officiel** (soumettre une PR, signaler une issue, suivre les conventions du repo), va voir le `CONTRIBUTING.md` du repo GitHub (rangé dans `.github/`). C'est une convention différente, audience différente.

Si tu veux juste **comprendre la sécurité** sans toucher au code, [Sécurité](/docs/security/newbie) est l'endroit. Si tu veux **héberger ta version sans la modifier**, [Auto-héberger](/docs/self-host).

## Setup local

```bash
git clone https://github.com/aliceout/Nodea.git
cd Nodea
pnpm install
cp .env.example .env
docker compose up -d postgres mailpit
pnpm --filter @nodea/api db:migrate
```

Variables d'environnement minimales : `COOKIE_SECRET` (32 chars random) et `OPAQUE_SERVER_SETUP` (généré une fois). Les commandes pour les générer seront détaillées ici prochainement.

Pour lancer les services en mode dev (hot-reload des deux côtés) :

```bash
pnpm --filter @nodea/api dev   # API Hono sur :3000
pnpm --filter @nodea/web dev   # Web Vite sur :8089
```

## Comprendre la structure

Trois packages dans un monorepo pnpm :

- **`packages/shared/`** — schémas Zod, types branded crypto, partagés entre back et front. Le keystone : un schéma défini ici sert de validation API ET de resolver React Hook Form côté web.
- **`packages/api/`** — Hono + Drizzle ORM + PostgreSQL 16. Les routes vivent dans `src/routes/`, les schémas DB dans `src/db/schema/`, les migrations dans `drizzle/`.
- **`packages/web/`** — React 19 + Vite + Tailwind + Zustand. Les pages dans `src/app/pages/`, le store dans `src/core/store/`, la crypto dans `src/core/crypto/`.

Toute la documentation détaillée de l'architecture vit dans le repo aujourd'hui (`docs/Architecture.md`, `docs/Database.md`, `docs/Auth-Spec.md`) — elle migrera ici au fur et à mesure.

## Lancer les tests

Trois suites cohabitent.

```bash
pnpm --filter @nodea/api test  # ~278 tests d'intégration, ~3 min
pnpm --filter @nodea/web test  # ~319 tests unitaires React, ~5 s
pnpm --filter @nodea/e2e test  # 13 tests Playwright end-to-end, ~3-5 min
```

Pour les tests e2e, prérequis machine : Postgres + Mailpit en route, plus le binaire Chromium installé une fois (`pnpm --filter @nodea/e2e install:browsers`).

## Ce que tu dois pas casser si tu modifies

Nodea est **chiffré de bout en bout**. Quelques règles cassent silencieusement la sécurité — les connaître évite de les casser sans s'en rendre compte.

- **Jamais de `CryptoKey` ou de matériel cryptographique brut dans un log, le DOM, ou `localStorage`.** Pas de `console.log(mainKey)`, pas de `window.mainKey`. La clé maître vit en mémoire WebCrypto en mode `extractable: false`. Réintroduire un fallback global — pour debugger ou pour persister — est une régression critique.
- **HKDF avec étiquettes distinctes** entre AES-GCM et HMAC-SHA-256 (`"nodea:aes"` et `"nodea:hmac"`). Ne jamais importer les mêmes octets bruts comme deux clés différentes — chaque sous-clé est dérivée séparément.
- **Une seule source pour `randomBytes` et le base64.** Le module partagé existe ; ne pas réimplémenter ces helpers en local.
- **Les guards HMAC ne sont JAMAIS persistés en `localStorage`.** Cache mémoire uniquement, purgé au logout.
- **Branded types** (`Base64`, `AesMainKey`, `HmacMainKey`, `CipherIV`) — confondre les types doit échouer à la compilation.

Ces règles sont décrites avec les raisons historiques sur [`/docs/security/tech`](/docs/security/tech) (page prescriptive, à lire avant de toucher la crypto).

## Décisions architecturales déjà prises

Avant de remettre en cause un pattern, lis l'ADR correspondant. Il y a souvent une raison non-évidente.

- [ADR-0006 + 0013](https://github.com/aliceout/Nodea/tree/main/docs/adr) — store Zustand mono-instance, splitté en slices.
- [ADR-0011](https://github.com/aliceout/Nodea/tree/main/docs/adr) — migrations Drizzle forward-only, pas de `down.sql`.
- [ADR-0012](https://github.com/aliceout/Nodea/tree/main/docs/adr) — tout-camelCase sur le wire, plus de mapper snake → camel.

Les autres ADR couvrent l'architecture en couches, le client API web, le routing flat de auth/, la stratégie « pas de cache de requêtes », etc.

## Rebrander ta fork

Si tu veux distinguer ta fork de l'instance officielle (autre nom, autres couleurs, autre logo), voilà où ça vit.

### Tokens couleurs

Définis dans `packages/web/src/ui/theme/global.css`. Les noms sémantiques sont volontairement non-anglophones pour ne pas être confondus avec des classes Tailwind par défaut.

| Nom | Hex | Rôle |
|---|---|---|
| Sauge | `#5a7a5e` | Accent principal (boutons primaires, liens, focus) |
| Sauge clarifié | `#9bbf9f` | Variante dark mode du sauge |
| Encre | `#161614` | Texte principal sur fond clair |
| Papier | `#fcfcfa` | Fond clair |
| Nuit chaude | `#1d1c18` | Fond dark mode |

Wordmark : Instrument Serif, `font-weight: 400`, `letter-spacing: -0.015em`.

### Fichiers logo et favicons

Tous dans `packages/web/public/` (recopiés tels quels dans `dist/` au build) :

- `nodea-symbol-{sauge,ink,paper,sauge-bright}.svg` — le symbole seul (un trait monoline ouvert, jamais rempli — c'est un cycle qui ne revient pas au même point).
- `nodea-lockup-horizontal{,-mono-sauge,-mono-ink,-dark}.svg` + `nodea-lockup-vertical.svg` — symbole + wordmark « Nodea ».
- `favicon.svg` + `favicon-{16,32,48,64,128,256,512}.png` — favicons web.
- `app-icon-{paper-bg,paper-bg-rounded,sauge-bg,dark-bg}.svg` + `app-icon-1024-{paper,sauge,dark}.png` — icônes pour iOS/Android/macOS (avec fond plein).

Pour rebrander : remplace ces fichiers par les tiens (mêmes noms, ou renomme-les et ajuste les références dans `packages/web/index.html` + `packages/web/src/ui/branding/NodeaSymbol.tsx`).

### HTML `<head>`

Dans `packages/web/index.html` :

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="256x256" href="/favicon-256.png">
```

### Si tu gardes les assets Nodea originaux

Quelques règles pour rester cohérent avec la marque d'origine :

- **Ne jamais remplir le symbole** — c'est un trait ouvert, le remplir change le sens.
- Trait : `stroke-width: 6.5` sur viewBox 100×100. À l'échelle, scale en restant proportionnel.
- Espacement min autour du logo : ½ de la hauteur du symbole.
- Taille minimum du symbole seul : 16 px (favicon ok).
- Taille minimum du lockup horizontal : 96 px de large (sinon utiliser le symbole seul).
- Les fonts sont appelées via `@import` Google Fonts dans les SVG de lockup — autonomes mais nécessitent une connexion. Pour un export sans dépendance, exporter en PNG ou tracer le wordmark en path.

## Si tu veux contribuer upstream

Tu modifies pour toi : tu es libre, c'est ta fork. Tu modifies pour soumettre une PR sur le repo officiel : il y a quelques conventions à respecter (style de commit, `pnpm test` qui passe, etc.) — vois le `CONTRIBUTING.md` du repo GitHub (rangé dans `.github/`) pour le détail.

## Aller plus loin

Le repo GitHub contient encore quelques pages techniques exhaustives :

- `docs/Architecture.md` — état du code (où vit quoi, runtime, middleware).
- `docs/Database.md` — schéma Postgres complet avec contraintes et AAD.
- `docs/Auth-Spec.md` — spec auth exhaustive (référence, pas une lecture rapide).
- [`/docs/security/tech`](/docs/security/tech) — invariants crypto, rate-limit, modèle de menaces, RGPD (déjà ici, dans la section Sécurité).

Ces pages migreront dans les sections appropriées de cette doc en ligne au fur et à mesure.
