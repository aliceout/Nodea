# Master roadmap — ordonnancement cross-roadmap

> **Statut** : index master qui ordonne les chantiers à travers
> les 6 roadmaps actives + le doc de recos serveur. **Source de
> vérité unique** pour répondre à *« qu'est-ce qu'on attaque
> cette semaine ? »*. Chaque chantier individuel reste détaillé
> dans sa roadmap source — cet index ne réécrit rien, il
> séquence.
>
> **Mise à jour** : à chaque chantier livré, cocher la `[ ]`
> correspondante. Ce fichier remplace le besoin de jongler
> entre 6 fichiers pour savoir où on en est. Quand un Tier est
> entièrement livré, le déplacer en bas dans *« Livré »*.

Posé après le cleanup post-meta-audit (commit `3ed6842`).
Couvre **~80 chantiers actifs** identifiés sur 7 angles
d'audit (api, architecture, frontend, ops, refacto, security,
+ recommandations serveur).

---

## Cartographie des roadmaps

```
docs/roadmap/
├── INDEX.md          ← ce fichier — ordonnancement master
├── refacto.md        — factorisation + organisation (17 chantiers)
├── security.md       — sécurité applicative + RGPD (11 findings)
├── api.md            — contrats API (16 findings)
├── frontend.md       — perf / a11y / état / SEO (14 findings)
├── architecture.md   — orga + dette structurelle (17 findings)
└── ops.md            — infra / observabilité / tests (15 findings)

docs/recommendations/
└── server-config.md  — config VPS hors-repo (12 recos REC-S1 à S12)
```

**Roadmaps livrées et retirées** (trace historique) :
- `health.md` — code health, dette JSX, lint, couverture (livré)
- `i18n.md` — bilingue propre + emails (livré)

---

## Logique d'ordonnancement

Pas une roadmap finie avant de passer à la suivante — **on
traverse par Tier**, à travers toutes les roadmaps. Chaque
Tier respecte 3 principes :

1. **Quick wins d'abord** — les chantiers à zéro risque qui
   débloquent la lecture du reste (purge code mort, doc à jour,
   convention figée).
2. **Détection avant durcissement** — pas de point à blinder
   un système avant de savoir s'il marche. La chaîne *« je
   sais quand ça pète »* doit exister avant *« je sécurise
   davantage »*.
3. **Foundations avant polish** — pas de point à ajouter de
   la pagination tant que la garde HMAC fuit dans les logs.

Les **dépendances inter-roadmaps** sont explicites — `→` lit
*« doit précéder »*. Quand un chantier est cross-référencé
entre 2 roadmaps (ex : SEC-01 + OPS-09), un seul travail
résout les deux.

---

## Tier 0 — Free wins (~7-8h cumulées, 0 risque)

> **À faire en premier, en bloc.** Ces 11 chantiers sont
> indépendants, sans risque, et débloquent immédiatement la
> lisibilité du codebase + des roadmaps.

### Cleanup code (~2h30)

- [x] **REFACTO-09** — Purge `ui/atoms/` du code mort (20 fichiers, ~1000 LOC, 30 min). [`refacto.md`](./refacto.md)
- [x] **REFACTO-10** — `Settings/components/ModulesManager.tsx` → `Account/components/` (10 min). [`refacto.md`](./refacto.md)
- [x] **REFACTO-01** — Centraliser le type `LoadState` dans `core/types/` (30 min). [`refacto.md`](./refacto.md)
- [x] **REFACTO-05** — `formatPartialDate` ajouté à `core/i18n/date-format.ts` (le module central est déjà i18n-aware) ; suppression du fichier Goals legacy (30 min). [`refacto.md`](./refacto.md)
- [x] **REFACTO-11** — Renommages cohérents (`modules_list.tsx`, `core/preferences/`, `core/react/` → `core/contexts/`, `ImportExport/` → kebab) (~1h). [`refacto.md`](./refacto.md)

### Documentation & coordination (~1h)

- [x] **ARCH-01** — Retirer purement TanStack Query et Pino de CLAUDE.md et de toute doc qui les mentionne (pas adaptés au projet : single-instance + E2EE) (~30 min). [`architecture.md`](./architecture.md)
- [x] **ARCH-13** — Codifier la convention « commentaire-en-tête de fichier > 50 LOC » dans CLAUDE.md (~30 min). [`architecture.md`](./architecture.md)

### A11y & SEO quick wins (~3h)

- [x] **FRONT-01** — `alt={item.title}` sur les couvertures Library (BookWall, CoverGrid) (~30 min). [`frontend.md`](./frontend.md)
- [x] **FRONT-14** — Skip-link sur `App.tsx` + `<main id="main">` (~10 min). [`frontend.md`](./frontend.md)
- [x] **FRONT-11 (élargi)** — URLs par onglet sur `/docs` (`/docs/:tab` avec tab ∈ `newbie | advanced | tech`) + anchor links sur les `<h2>`/`<h3>` (sélecteur `#` au survol, scroll-to-anchor au load si `#section-id`) + OG/Twitter meta dans `index.html`. ~2-3h. [`frontend.md`](./frontend.md)

### Endpoints utilitaires (~1h)

- [x] **API-15** — `GET /version` qui retourne `{ commit, build_date, branch }` (pas de champ `version` semver — on ne tagge pas encore). 1h. [`api.md`](./api.md)

---

## Tier 1 — Safety net runtime (~6-8h, dépendances explicites)

> **L'objectif** : passer de *« je découvre les pannes par les
> tickets »* à *« je suis notifié quand ça casse »*. Ordre
> imposé par les dépendances.

### Étape A — Healthcheck honnête + containers monitorés (~1h, sans dep)

- [x] **OPS-01** — `/healthz` interroge la DB et retourne 503 si KO (30 min). [`ops.md`](./ops.md)
- [x] **OPS-04** — Healthcheck dans `docker-compose.yml` pour api + web (15 min). [`ops.md`](./ops.md)
- [ ] **REC-S4** (côté serveur, [issue #69](https://github.com/aliceout/Nodea/issues/69)) — Brancher UptimeRobot/Better Stack/Healthchecks.io sur `/healthz`. [`server-config.md`](../recommendations/server-config.md)

> **Après cette étape, tu sais déjà quand l'instance est down.**

### Étape B — Cleanup logs (préalable à toute capture d'erreurs externe) (~2-3h)

- [x] **SEC-01** — Déplacer `sid` + `d` du query string vers les headers `X-Sid` / `X-Guard` (Option A, ~2-3h). Migrer `requireGuard` + le client web. **Bloque l'étape C.** [`security.md`](./security.md)
- [x] **OPS-09** — Logs structurés (couplé avec SEC-01 — la même refonte du logger règle les deux). [`ops.md`](./ops.md)

### Étape C — Capture d'erreurs (après B) (~1h)

- [x] **OPS-02 étape 1** — Middleware Hono qui POST vers webhook si `c.res.status >= 500`. URL via env var. **Sans dep à SEC-01** (pas de body envoyé). 30 min. [`ops.md`](./ops.md)
- [ ] **REC-S6** (côté serveur, [issue #74](https://github.com/aliceout/Nodea/issues/74)) — Webhook Discord ou Slack pour recevoir les notifs. [`server-config.md`](../recommendations/server-config.md)
- [x] **OPS-02 étape 2** — Sentry SDK côté API + web, avec `beforeSend` qui scrubbe agressivement. **APRÈS SEC-01** (livré). [`ops.md`](./ops.md)
- [ ] **REC-S5** (côté serveur, [issue #75](https://github.com/aliceout/Nodea/issues/75)) — Sentry cloud free tier setup. [`server-config.md`](../recommendations/server-config.md)

### Étape D — Hardening container & cookies (~1h)

- [x] **SEC-04** — `COOKIE_SECURE: default('true')` (15 min). [`security.md`](./security.md)
- [x] **OPS-03** — `USER` non-root dans `packages/api/Dockerfile` + `packages/web/Dockerfile` (30 min). [`ops.md`](./ops.md)
- [x] **SEC-05** — Postgres `ports:` rebindé sur `127.0.0.1` (pas exposé sur 0.0.0.0) (15 min). [`security.md`](./security.md)
- [x] **SEC-03 app** — Rate-limit lit le **dernier** hop de `X-Forwarded-For` ; nginx-container forwarde as-is (30 min). [`security.md`](./security.md)
- [ ] **REC-S2** (côté serveur, [issue #76](https://github.com/aliceout/Nodea/issues/76)) — `proxy_set_header X-Forwarded-For $remote_addr;` sur l'upstream. [`server-config.md`](../recommendations/server-config.md)
- [ ] **REC-S1** (côté serveur, [issue #77](https://github.com/aliceout/Nodea/issues/77)) — Déployer CSP en `Report-Only` sur l'upstream nginx, observer 1 semaine. [`server-config.md`](../recommendations/server-config.md)

### Étape E — Backups (~3h)

- [ ] **OPS-05 app** — Créer `scripts/backup.sh` + `scripts/restore.sh` + doc dans `docs/Operations.md` (~2h). [`ops.md`](./ops.md)
- [ ] **REC-S7** (côté serveur) — Setup Backblaze B2 + cron + **test de restoration** (~1h). [`server-config.md`](../recommendations/server-config.md)

> **Après le Tier 1, la chaîne de détection ET de récupération
> existe.** C'est le palier le plus rentable du document.

---

## Tier 2 — Foundations app (~2-3 jours dev)

> **Objectif** : poser les hooks et abstractions qui débloquent
> les futurs refactos. Pas urgent mais structurant.

### Hooks et abstractions (~1 jour)

- [x] **REFACTO-02** — Hook `useModuleClient(moduleId)` qui remplace les 20 occurrences (le code a grossi depuis l'audit) de `if (!mainKey || !moduleUserId) return`. ~3h. [`refacto.md`](./refacto.md)
- [x] **REFACTO-07** — Splitter `core/auth/passkey-flow.ts` en `passkey/{enroll,login,shared,index}.ts`. ~2h. [`refacto.md`](./refacto.md)
- [x] **REFACTO-04** — `LibraryItem.tsx` (707 LOC) splitté : `library-item/save.ts` (245) + `library-item/use-lookup.ts` (166), shell à 438 LOC. [`refacto.md`](./refacto.md)

### Préparation OpenAPI + validation runtime (~1 jour)

- [x] **API-11** — `*ResponseSchema` câblés sur auth/passkey/mfa/totp/library/admin via wrapper ARCH-12. [`api.md`](./api.md)
- [x] **ARCH-12** — `request<T>(method, path, body?, schema?)` valide en dev/test, skip prod. [`architecture.md`](./architecture.md)

### Mesure perf + bundle (~3-4h)

- [x] **FRONT-03** — `web-vitals` + `rollup-plugin-visualizer` livrés (étapes 1+2). Étape 3 Lighthouse CI optionnelle. [`frontend.md`](./frontend.md)
- [x] **FRONT-08** — `recharts` retiré (jamais consommé). [`frontend.md`](./frontend.md)
- [x] **FRONT-09** — Vérifié : zxcvbn dans un chunk partagé unique, no-op. [`frontend.md`](./frontend.md)
- [x] **FRONT-10** — `manualChunks` Vite (react-vendor / headlessui / crypto / markdown) — main bundle -44 %. [`frontend.md`](./frontend.md)

### CI sécurité (~1h)

- [x] **OPS-07** — `.github/dependabot.yml` créé (npm weekly + github-actions/docker monthly). [`ops.md`](./ops.md)
- [x] **OPS-08** — `pnpm audit --audit-level=high` step CI + Trivy sur image@digest dans docker-build. Baseline clean après bump Playwright 1.55.1. [`ops.md`](./ops.md)

---

## Tier 3 — Quality polish (~3-5 jours dev)

> **Objectif** : nettoyer les scories visibles et compléter
> la couverture e2e + UX.

### A11y & SEO (~2h)

- [x] **FRONT-04** — Hook `useDocumentTitle` câblé sur 14 pages publiques + invariant privacy `/flow` documenté dans CLAUDE.md. [`frontend.md`](./frontend.md)
- [x] **FRONT-07** — Vérifié : AuthPanelHeader déjà en `<h2>`, pas de double `<h1>` à corriger (no-op). [`frontend.md`](./frontend.md)
- [x] **FRONT-12** — Canonical statique dans `index.html` + override dynamique par tab dans `Docs.tsx`. [`frontend.md`](./frontend.md)
- [x] **FRONT-06** — `setModule` stamp `scrollY` sur l'entrée sortante, popstate restore via rAF. Test UI manuel à faire. [`frontend.md`](./frontend.md)

### API consolidation non-breaking (~3h)

- [ ] **API-05** — POST de création → 201 + `Location:` header. ~2h. [`api.md`](./api.md)
- [ ] **API-13** — Documenter contrat *« ordre non spécifié »* sur `<module>/records`. ~30 min. [`api.md`](./api.md)
- [ ] **API-16** — Audit + cleanup des routes legacy dans `authRoutes`. ~30 min. [`api.md`](./api.md)
- [ ] **SEC-10** — `WEB_BASE_URL` required dans le schéma Zod. ~10 min. [`security.md`](./security.md)

### Tests e2e (~1 jour)

- [x] **OPS-06** — 5 specs e2e ajoutés (`03..07`) : recovery, passkey non-PRF, change-password, account-deletion, modules CRUD. À runner localement (Postgres + Mailpit + Chromium requis). [`ops.md`](./ops.md)

### Splits structurels (~2 jours)

- [x] **REFACTO-08** — Library context 477 → 191 LOC + 3 hooks ; Goals context 408 → 155 LOC + 3 hooks. Pattern refs internes pour stabilité des callbacks d'actions. [`refacto.md`](./refacto.md)
- [ ] **REFACTO-12** + **REFACTO-06** combinés — Harmoniser pages auth (flat→folder) + standardiser RHF. ~1-2 jours. **Couple les deux.** [`refacto.md`](./refacto.md)

### Documentation & process (~1 jour)

- [ ] **ARCH-02** — Créer `docs/adr/` + 5 premiers ADR (layered hybride, Zustand mono-store, snake/camel frontière, pas de cache de requêtes, pas de SSR). ~3-4h. [`architecture.md`](./architecture.md)
- [ ] **ARCH-10** — Sweep des références *« Phase N »* / *« Tier X »* livrées dans le code. ~2h. [`architecture.md`](./architecture.md)
- [ ] **OPS-12** — `CHANGELOG.md` (manuel ou release-please). ~30 min initial. [`ops.md`](./ops.md)
- [ ] **OPS-14** — `docs/Operations.md` runbook minimal. ~3h. [`ops.md`](./ops.md)

### Privacy & RGPD (~3-4h)

- [x] **SEC-09** — Matrice de rétention RGPD ajoutée (`Security.md` §9, 12 tables) + ébauche CGU créée (`Terms.md`, 8 sections). [`security.md`](./security.md)
- [ ] **SEC-06** — Compteur agrégé au lieu du log `user.id` sur recovery hash mismatch. ~30 min. [`security.md`](./security.md)
- [ ] **SEC-07** — Logo email en base64 inline (élimine le tracking pixel). ~30 min. [`security.md`](./security.md)
- [ ] **SEC-08** — Passer `SameSite='Strict'` sur le cookie session. ~10 min. [`security.md`](./security.md)

---

## Tier 4 — À évaluer / décisions (subjectif)

> **Pas urgent.** Ces chantiers demandent une décision business
> ou un signal du terrain (perf qui dégrade, mobile à venir,
> SDK partenaire, etc.) avant de partir.

### Décisions à figer en ADR

- [ ] **ARCH-03** — Décider sur `nodea-store` mono vs splitté → ADR.
- [ ] **ARCH-04** — Garder `core/api/` 14 thin wrappers ? (tendance : oui).
- [ ] **ARCH-08** — `auth/` flat vs splitté en `services/domain/infra/` (tendance : flat).
- [ ] **ARCH-09** — `lookup/` racine api ou dans `services/library-lookup/` (tendance : racine).
- [ ] **ARCH-16** — `getConfig()` singleton vs DI (tendance : singleton + ADR).
- [ ] **ARCH-17** — Migrations DB *« down »* obligatoires ou pas (décision opérateur).

### Refactos breaking (à coupler avec versioning)

- [ ] **API-10** — Stratégie de versionnement (URL `/v1/...` ou Accept header) — **avant tout consommateur externe**.
- [ ] **API-01** — Uniformiser snake_case ↔ camelCase — **breaking, demande API-10 en amont**.
- [ ] **API-06** — Refonte enveloppe `{ data, meta }` ou figer `{ ok, ...flags }` — décision design.
- [ ] **API-04** — `PUT` → `PATCH` sur modules-config / user-preferences.
- [ ] **API-14** — Splitter `/auth/me` + `/auth/me/crypto` — bonne hygiène, à coupler avec API-10.
- [ ] **API-15** ✅ (déjà en Tier 0).
- [ ] **API-02** — Harmoniser URL pluriel/singulier — décision doc.

### Refactos cosmétiques

- [ ] **REFACTO-13** — Décider entre `ThemeToggle` et `ThemeSwitch` (consolider ou garder).
- [ ] **REFACTO-14** — Réorg `ui/dirk/` racine plate.
- [ ] **REFACTO-15** — `SettingsPatchBodySchema` → shared (quand 2ᵉ champ).
- [ ] **REFACTO-16** — Aplatir `api/src/collections/`, `api/src/cron/`.
- [ ] **REFACTO-17** — Harmoniser profondeur `api/src/services/`.

### Refontes lourdes (à pondérer)

- [ ] **FRONT-13** — `requestId` par mutation pour éviter les race conditions de rollback optimiste (~2-3h). Pas de migration cache-de-requêtes — décision figée par ARCH-01.
- [ ] **FRONT-02** — Pagination cursor + virtualisation Library (~3 jours). **Quand un user atteint ~500 livres.**
- [ ] **API-08** — Pagination cursor-based côté API (~3h). **Préalable à FRONT-02.**
- [ ] **ARCH-05** — Branded types pour IDs métier (~1 jour). **Quand le projet grossit.**
- [ ] **OpenAPI generator** — Génération SDK TS / Swift / Kotlin depuis OpenAPI. **Avant mobile / SDK partenaire.**

### Décisions infra (cf. server-config.md)

- [ ] **REC-S3** — Soumettre nodea.app au HSTS preload list (quasi-irréversible — quand DNS/TLS stable).
- [ ] **REC-S8** — Staging environnement (~5-10 €/mois) — **selon user-base**.
- [ ] **REC-S9** — Audit firewall VPS (vérification ufw/iptables) — à faire à un moment.
- [ ] **REC-S10** — Aggregation logs (Loki, Better Stack…) — quand volume dépasse `journalctl`.
- [ ] **REC-S11** — Métriques Prometheus + Grafana — quand besoin dashboards.
- [ ] **REC-S12** — SLO / SLI — quand instance ouvre au public.

---

## Top 5 cette semaine

> **À mettre à jour chaque semaine.** Pointe vers les
> chantiers à attaquer maintenant, choisis dans le Tier le
> plus bas non-encore-livré.

1. [ ] **REFACTO-09** — Purge `ui/atoms/` (30 min, ~1000 LOC mortes).
2. [ ] **OPS-01** — `/healthz` interroge la DB (30 min).
3. [ ] **REFACTO-01** — Centraliser `LoadState` (30 min).
4. [ ] **FRONT-01** — `alt={item.title}` sur Library covers (30 min).
5. [ ] **ARCH-01** — Retirer TanStack/Pino de CLAUDE.md et docs (30 min).

**Total ~3h cumulées** — un demi-après-midi qui couvre 5
roadmaps différentes et fait avancer chacune.

---

## Graphe de dépendances cross-roadmap

Les dépendances explicites (chantier B suppose chantier A
livré) :

```
SEC-01 (guards en headers ou logger qui scrub les query strings)
  ↓ permet
OPS-02 étape 2 (Sentry SDK avec beforeSend propre)
  ↓ permet
REC-S5 (Sentry cloud setup côté serveur)

OPS-01 (/healthz interroge DB)
  ↓ permet
OPS-04 (compose healthcheck honnête)
  ↓ permet
REC-S4 (UptimeRobot externe)

OPS-05 app (script backup.sh)
  ↓ couple
REC-S7 (Backblaze B2 storage off-site)

API-11 (Zod ResponseSchema)
  ↓ permet
ARCH-12 (validation runtime côté client)
  ↓ permet
OpenAPI generator (Tier 4)

REFACTO-02 (useModuleClient hook)
  ↓ permet
REFACTO-08 (split Library/Goals contexts)

FRONT-03 (web-vitals + bundle analyzer)
  ↓ permet
FRONT-09, FRONT-10 (vérification chunks)

API-08 (pagination cursor)
  ↓ permet
FRONT-02 (virtualisation Library)

API-10 (stratégie versionnement)
  ↓ permet
API-01 (uniformisation snake/camel — breaking)
API-06 (refonte enveloppe — breaking)
API-14 (split /auth/me/crypto — breaking)
```

---

## Bilan effort cumulé par Tier

| Tier | Volume estimé | Risque | Bénéfice principal |
|---|---|---|---|
| Tier 0 | ~7-8h | nul | Code propre + roadmap navigable + URLs publiques solides |
| Tier 1 | ~6-8h | faible-moyen | Détection runtime + récupération |
| Tier 2 | ~2-3 jours | moyen | Foundations pour scaler |
| Tier 3 | ~3-5 jours | moyen | Polish + tests + doc |
| Tier 4 | variable | dépend du chantier | À pondérer selon contexte |

**Tier 0 + Tier 1** = ~15-17h cumulées sur ~1 semaine. C'est
le palier qui transforme le projet d'*« en alpha non observée »*
à *« en alpha observée et récupérable »*.

---

## Comment cocher

- À chaque chantier livré, cocher la `[ ]` ici **et** dans la
  roadmap source.
- Quand tout un Tier est livré, déplacer la section en bas
  sous *« Livré »* avec la date.
- *« Top 5 cette semaine »* doit être mis à jour à chaque
  itération hebdomadaire.
- Le graphe de dépendances doit être mis à jour si un
  chantier débloque un nouveau (rare mais possible).
- Quand toutes les 6 roadmaps + ce fichier sont retirés, le
  cycle d'audit est clos.
