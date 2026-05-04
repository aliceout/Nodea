# Développement

Ce fichier est le **point d'entrée pour quelqu'un qui modifie le code** : setup local, lancement des tests, recettes pour ajouter un module ou une route, conventions code. Si tu veux opérer une instance déployée, va plutôt voir [Operations.md](./Operations.md). Si tu veux comprendre l'architecture sans toucher au code, [Architecture.md](./Architecture.md).

---

## 1. Setup local de zéro

Pré-requis machine : Node ≥ 22, **pnpm** (corepack activé), **Docker** + Docker Compose v2.

```bash
# 1. Cloner et installer
git clone https://github.com/aliceout/Nodea.git
cd Nodea
pnpm install

# 2. Variables d'environnement
cp .env.example .env
# Édite .env — au minimum :
#   COOKIE_SECRET=<32 chars random>
#   OPAQUE_SERVER_SETUP=<base64url, voir ci-dessous>
# Pour COOKIE_SECRET :
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Pour OPAQUE_SERVER_SETUP (une fois, à conserver) :
pnpm --filter @nodea/api exec node --input-type=module \
  -e "import { ready, server } from '@serenity-kit/opaque'; await ready; console.log(server.createSetup())"

# 3. Services Docker — Postgres et Mailpit
docker compose up -d postgres mailpit
# Postgres écoute sur :5433. Mailpit écoute sur :1025 (SMTP) + :8025 (API HTTP).

# 4. Migrations DB
pnpm --filter @nodea/api db:migrate

# 5. (Optionnel) Seed un admin pour avoir un compte de test
pnpm --filter @nodea/api seed:admin
# Édite les credentials dans le script ou via env ADMIN_EMAIL / ADMIN_PASSWORD.
```

Lancer les services en dev (hot-reload) :

```bash
# Terminal 1 — API Hono sur :3000
pnpm --filter @nodea/api dev

# Terminal 2 — Web Vite sur :8089
pnpm --filter @nodea/web dev
```

Le web proxifie `/api/*` vers `:3000` (configuration Vite), donc tu navigues sur `http://localhost:8089` et tout est branché.

---

## 2. Tests

Trois suites cohabitent. Sache laquelle lancer selon ce que tu veux vérifier.

### Vue d'ensemble

| Suite | Couverture | Commande | Durée |
|---|---|---|---|
| **`packages/api/src/test/*.test.ts`** | Tests d'intégration des routes Hono : DB réelle, OPAQUE handshakes, guards HMAC, validation Zod, AAD bindings. | `pnpm --filter @nodea/api test` | ~3 min |
| **`packages/web/src/**/*.test.{ts,tsx}`** | Tests unitaires React : mappers, hooks, store Zustand, crypto round-trips, formatters i18n. | `pnpm --filter @nodea/web test` | ~5 s |
| **`packages/e2e/tests/*.spec.ts`** | Tests end-to-end Playwright : navigateur réel, WebAuthn, emails Mailpit, flux complet auth + module CRUD. | `pnpm --filter @nodea/e2e test` | ~3-5 min |

**Tester quoi avec quoi** :

- Changement d'un schéma Zod partagé → web + api (les deux le consomment).
- Régression dans l'UI Settings ou un flux auth complet → e2e.
- Régression de chiffrement ou de mappers → web (round-trips AES-GCM, HKDF, mapper unitaires) + api (envelopes OPAQUE, AAD bindings).
- Ajout ou modification d'une route HTTP → api (le test d'intégration tape la route directement avec `app.request`).

### Lancer les e2e (premier passage)

Les e2e ont 3 pré-requis machine en plus de ce qui marche déjà pour api/web :

```bash
# 1. Postgres et Mailpit doivent tourner (cf. setup §1).
docker compose ps postgres mailpit

# 2. Binaire Chromium (one-shot par machine — Playwright le télécharge
#    dans %LOCALAPPDATA%/ms-playwright sur Windows, ~/.cache/ms-playwright
#    sur Linux/macOS).
pnpm --filter @nodea/e2e install:browsers

# 3. Lancer
pnpm --filter @nodea/e2e test
```

Le runner Playwright démarre l'API et le web en arrière-plan, attend que `/healthz` réponde, puis exécute les specs. Sur ta machine l'existing dev server est réutilisé (`reuseExistingServer: !CI`). En CI ils sont torn-down à la fin.

Variantes :

```bash
# Inspecteur Playwright (pas-à-pas, voir les selectors)
pnpm --filter @nodea/e2e test:ui

# Browser visible (utile quand un selector pète)
pnpm --filter @nodea/e2e test:headed

# Une seule spec
pnpm --filter @nodea/e2e test tests/08-goals-crud.spec.ts

# Rapport HTML du dernier run (screenshots + videos sur les échecs)
pnpm --filter @nodea/e2e report
```

Les caveats spécifiques à Playwright (sélecteurs, virtual authenticator WebAuthn, comportement du `webServer`) restent dans `packages/e2e/README.md` — c'est de la réf opérationnelle Playwright, pas de la doc projet.

### Couverture e2e actuelle

| Spec | Flux couvert |
|---|---|
| `01-register-activate-login` | Register → Mailpit → activation magic-link → login → /flow |
| `02-totp-enroll-login` | Settings TOTP enroll → log out → log back in via stepped MFA |
| `03-recovery-code-generate-and-use` | `/recovery-code` enable → 12 BIP39 words → logout → `/recover` avec mots → relogin nouveau password |
| `04-passkey-enroll-and-login` | Virtual WebAuthn authenticator → enroll → logout → assertion login → finir avec password (branche non-PRF) |
| `05-change-password-rotates-kek` | `/change-password` → forced logout → ancien refusé → nouveau OK |
| `06-account-deletion-cascade` | Account → suppression → confirm → /login → cascade DB asserts |
| `07-module-crud-with-guard` | Mood : composer create → list → edit → delete avec X-Sid + X-Guard headers |
| `08-goals-crud` | Goals : composer create → list → edit → delete (jumeau de 07) |
| `09-account-changes` | Settings → Mon compte → username + email change avec re-auth |
| `10-mfa-bypass-totp` | TOTP perdu → request bypass → email → DB time-shift 7j → relogin sans TOTP |
| `11-i18n-switch` | Switch FR ↔ EN via sidebar + persistance reload + libellés clés |
| `12-admin-announcements` | Admin → Annonces : create + toggle active + delete |
| `13-privacy-invariants` | URL reste /flow + document.title === 'Nodea' + aucun `?token=` / `?d=` dans les URLs |

### Ce qui n'est PAS automatisé

Voir [`packages/e2e/SANITY-CHECKLIST.md`](../packages/e2e/SANITY-CHECKLIST.md) pour la liste : ressenti visuel (flicker, animations), browser compat (Safari macOS, Firefox), throttle Slow 3G en réel, et tout ce qui demande un jugement humain.

---

## 3. Recettes — patterns à connaître

### Ajouter une route API

1. Crée le schéma de body / response dans `packages/shared/src/schemas/`. Réutilisable côté web pour les forms RHF + `zodResolver`.
2. Crée le handler dans `packages/api/src/routes/` (ou un sous-fichier si la route appartient à un sous-router déjà splitté comme `auth.ts` ou `admin.ts`).
3. Déclare la route via `app.openapi(createRoute({...}), handler)` — pas `app.post(...)`. La spec OpenAPI est dérivée de `createRoute`, pas de doc séparée à maintenir (cf. ADR-0011 + le module `packages/api/src/openapi/`).
4. Ajoute un test d'intégration dans `packages/api/src/test/`. Pattern : `app.request('/route', { method, body })` puis assert sur le status + le body retourné.
5. Ajoute le client web dans `packages/web/src/core/api/`. Réutilise le `request()` helper du `internal.ts` qui gère les erreurs API uniformément.

### Ajouter une collection chiffrée (= un nouveau module)

1. Crée la table Drizzle dans `packages/api/src/db/schema/entries.ts`. Pattern : 4 colonnes (`id`, `module_user_id`, `cipher_iv`, `payload`, `guard`). Suis l'exemple `mood_entries`.
2. Génère la migration : `pnpm --filter @nodea/api db:generate`. Inspecte le SQL produit dans `packages/api/drizzle/`, applique avec `db:migrate`.
3. Ajoute le nom dans `COLLECTION_NAMES` de `packages/shared/src/schemas/entries.ts` ET dans `packages/api/src/collections.ts` (qui drive la factory de routes — toutes les 4 routes CRUD sont câblées automatiquement, impossible d'oublier le guard).
4. Crée le schéma de payload déchiffré dans `packages/shared/src/schemas/modules.ts` (les fields à l'intérieur du blob chiffré, en camelCase per ADR-0012).
5. Côté web : crée le client de module dans `packages/web/src/core/api/modules/<name>.ts` via `createCollectionClient(name, schema)` — il gère encrypt + create + promote + decrypt + update + delete.

### Ajouter une migration DB

1. Modifie `packages/api/src/db/schema/<table>.ts`.
2. `pnpm --filter @nodea/api db:generate` — drizzle-kit produit un fichier SQL dans `packages/api/drizzle/<NNNN>_<name>.sql`.
3. **Lis le SQL produit** avant de l'appliquer. Drizzle peut générer du SQL destructeur (DROP COLUMN / ALTER TYPE) qui tue les données. Si c'est le cas, réécris le SQL à la main pour faire la migration en plusieurs passes (ajoute la nouvelle colonne, copie les données, drop l'ancienne).
4. `pnpm --filter @nodea/api db:migrate` pour l'appliquer en local.
5. **Forward-only.** Pas de fichier `down.sql` (cf. ADR-0011). Si tu te trompes, écris une nouvelle migration qui annule, ne réécris pas l'ancienne.

---

## 4. Build & bundle

```bash
# Build prod du web
pnpm --filter @nodea/web build

# Mesure du bundle (taille brute + gzippée par fichier + buckets)
pnpm --filter @nodea/web bundle-size

# Mesure sans rebuild (sur le dist/ existant)
pnpm --filter @nodea/web bundle-size:skip-build
```

Le script asserte sur un budget en dur (1500 KB gzip). Toute dérive est documentée dans [`packages/web/PERF-BASELINE.md`](../packages/web/PERF-BASELINE.md) avec les chiffres au moment du dernier reset de baseline + commentaires par bucket.

Si le budget pète, regarde quel bucket a sauté (crypto / docs / app / sentry / …). Investigue avec `rollup-plugin-visualizer` (déjà installé) :

```bash
# Dans packages/web/vite.config.ts, dé-commente le plugin visualizer,
# rebuild, ouvre le rapport HTML produit dans dist/.
```

---

## 5. Conventions code

Le code suit des conventions documentées dans des **ADR** (Architecture Decision Records). Avant de remettre en cause un pattern, lis l'ADR correspondant — il y a souvent une raison non-évidente.

| Sujet | ADR | TL;DR |
|---|---|---|
| Architecture en couches | [0001](./adr/0001-layered-hybrid-architecture.md) | Layered + feature-first hybride. |
| Store Zustand mono-instance | [0002](./adr/0002-zustand-single-store.md) + [0006](./adr/0006-zustand-mono-store-rationale.md) | Un seul store racine pour l'atomicité multi-slices. |
| Slice pattern | [0013](./adr/0013-zustand-slice-pattern.md) | Le store est splitté en 9 fichiers `slices/*.ts`, assemblage dans `nodea-store.ts`. |
| Pas de cache de requêtes | [0004](./adr/0004-no-request-cache.md) | Pas de TanStack Query / SWR — incompatible E2E. |
| Pas de SSR | [0005](./adr/0005-no-ssr.md) | CSR pur, le serveur ne déchiffre rien. |
| Client API web | [0007](./adr/0007-hand-rolled-api-client.md) | 14 fonctions dédiées plutôt que `hc<AppType>` Hono. |
| Routes auth en plat | [0008](./adr/0008-auth-routes-flat.md) | `auth/` plat (pas de couches services / domain / infra). |
| `getConfig()` global | [0010](./adr/0010-getconfig-singleton.md) | Une instance globale partagée plutôt que passage en argument. |
| Migrations forward-only | [0011](./adr/0011-drizzle-forward-only-migrations.md) | Pas de `down.sql` ; les rollbacks sont des nouvelles migrations. |
| **camelCase partout sur le wire** | [0012](./adr/0012-camel-case-only-on-the-wire.md) | Plus de mapper snake → camel. DB reste en snake_case via Drizzle. |

Le compilateur TypeScript en mode `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` attrape la plupart des dérapages. ESLint fait le reste (lint pre-commit via husky).

**Avant de toucher la crypto** : `Security.md` est prescriptif (HKDF labels, AAD format, branded types, anti-patterns explicites). Lis-le avant.

**Avant de toucher l'auth** : `Auth-Spec.md` documente le protocole OPAQUE + Passkey + TOTP + recovery + bypass MFA exhaustivement.

---

## 6. Aller plus loin

- [Architecture.md](./Architecture.md) — état du code (où vit quoi, runtime, middleware).
- [Database.md](./Database.md) — schéma Postgres complet avec contraintes et AAD.
- [Auth-Spec.md](./Auth-Spec.md) — spec auth exhaustive (référence, pas une lecture rapide).
- [Modules.md](./Modules.md) + [Modules/](./Modules/) — détail fonctionnel des 6 modules.
- [Internationalisation.md](./Internationalisation.md) — i18n FR + EN, ajouter une langue.
- [Operations.md](./Operations.md) — runbook ops pour quand l'instance déployée pète.
- [Security.md](./Security.md) — invariants crypto, rate-limit, modèle de menaces.
- [adr/](./adr/) — l'historique des décisions architecturales avec leurs alternatives.
