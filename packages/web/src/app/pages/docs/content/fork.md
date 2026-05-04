<!-- markdownlint-disable -->

> Cette page est en cours d'écriture. Le contenu détaillé sera transféré ici depuis le repo GitHub dans les jours qui viennent.

## À qui s'adresse cette page

Tu télécharges Nodea pour t'en faire **ta propre version** — comprendre comment c'est foutu, changer ce qui te chiffonne, faire tourner ta fork avec tes modifs. C'est ici.

Si tu cherches plutôt à **contribuer au projet officiel** (soumettre une PR, signaler une issue, suivre les conventions du repo), va voir le `CONTRIBUTING.md` à la racine du repo GitHub. C'est une convention différente, audience différente.

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

Ces règles sont décrites avec les raisons historiques dans `docs/Security.md` du repo (pages prescriptives, à lire avant de toucher la crypto).

## Décisions architecturales déjà prises

Avant de remettre en cause un pattern, lis l'ADR correspondant. Il y a souvent une raison non-évidente.

- [ADR-0006 + 0013](https://github.com/aliceout/Nodea/tree/main/docs/adr) — store Zustand mono-instance, splitté en slices.
- [ADR-0011](https://github.com/aliceout/Nodea/tree/main/docs/adr) — migrations Drizzle forward-only, pas de `down.sql`.
- [ADR-0012](https://github.com/aliceout/Nodea/tree/main/docs/adr) — tout-camelCase sur le wire, plus de mapper snake → camel.

Les autres ADR couvrent l'architecture en couches, le client API web, le routing flat de auth/, la stratégie « pas de cache de requêtes », etc.

## Si tu veux contribuer upstream

Tu modifies pour toi : tu es libre, c'est ta fork. Tu modifies pour soumettre une PR sur le repo officiel : il y a quelques conventions à respecter (style de commit, `pnpm test` qui passe, etc.) — vois le `CONTRIBUTING.md` à la racine du repo GitHub pour le détail.

## Aller plus loin

Le repo GitHub contient encore quelques pages techniques exhaustives :

- `docs/Architecture.md` — état du code (où vit quoi, runtime, middleware).
- `docs/Database.md` — schéma Postgres complet avec contraintes et AAD.
- `docs/Auth-Spec.md` — spec auth exhaustive (référence, pas une lecture rapide).
- `docs/Security.md` — invariants crypto, rate-limit, modèle de menaces.

Ces pages migreront dans les sections appropriées de cette doc en ligne au fur et à mesure.
