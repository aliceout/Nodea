# Changelog

Tous les changements notables de Nodea entre deux versions de `:main` sont listés ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), les versions ne sont pas tagguées en semver pour l'instant — chaque entrée pointe sur les commits qui composent le lot. Voir aussi [`docs/adr/`](./docs/adr/) pour les décisions structurantes.

## [Unreleased] — branche `refacto-design-v2`

> Cycle d'audit + hardening en cours. Quatre tiers de chantiers en cours de migration de la branche `refacto` vers `main` ; chaque tier corrige un ensemble de findings identifiés dans [`docs/security-audit.md`](./docs/security-audit.md).

### Tier 0 — Quick wins (sécu + ops critiques)
- **OPS-01 / OPS-04** — `/healthz` honnête (vérifie Postgres) + healthcheck Docker compose câblé sur les containers api + web.
- **SEC-01 + OPS-09** — `sid` et `guard` HMAC déplacés du query string vers les headers `X-Sid` / `X-Guard` ; les access logs Nginx + Hono ne portent plus d'identifiants d'accès.
- **API-15** — Endpoint public `GET /version` qui retourne `{ commit, build_date, branch }` pour debug + monitoring.
- **FRONT-11** — URL par onglet sur la doc publique (`/docs/newbie`, `/docs/advanced`, `/docs/tech`) + anchors sur les titres + meta OG / Twitter card.
- **FRONT-14** — Skip-link a11y « passer au contenu principal » sur toutes les pages.

### Tier 1 — Hardening sécu + ops
- **OPS-02** — Webhook 5xx fire-and-forget (Discord) + Sentry SDK câblé api + web avec `beforeSend` agressif (cookies / query / body / headers / user strippés).
- **Tier 1 étape D** — Cookies durcis (Secure par défaut, fail-secure) + USER non-root sur les Dockerfiles api + web + IP rate-limit dérivé du remote addr + Postgres ports retirés du compose prod.

### Tier 2 — Refactos + couverture API
- **REFACTO-02** — Hook `useModuleClient(moduleId)` centralise la garde « module hydraté ».
- **REFACTO-07** — `core/auth/passkey-flow.ts` (530 LOC) splitté en `passkey/{enroll, login, shared, calibration, index}.ts`. Tous les fichiers <300 LOC.
- **REFACTO-04** — `bodies/LibraryItem.tsx` (707 LOC) splitté en `library-item/save.ts` (245) + `library-item/use-lookup.ts` (166), shell à 438 LOC.
- **REFACTO-08** — `Library/context.tsx` (477 LOC) → 191 + 3 hooks ; `Goals/context.tsx` (408) → 155 + 3 hooks. Pattern refs internes pour la stabilité des callbacks d'actions.
- **ARCH-12** — Wrapper `request<T>()` accepte un `responseSchema` optionnel, valide via Zod en dev/test, skip prod.
- **API-11** — 26+ `*ResponseSchema` câblés sur `auth.ts`, `passkeys.ts`, `mfa.ts`, `totp.ts`, `library.ts`, `admin.ts` via le wrapper ARCH-12.
- **FRONT-03** — `web-vitals` (dev-only console hook) + `rollup-plugin-visualizer` (rapport `dist/stats.html` à chaque build).
- **FRONT-08** — `recharts` retiré (jamais consommé, dep orpheline).
- **FRONT-09** — Vérifié post-build : zxcvbn dans un seul chunk partagé. No-op.
- **FRONT-10** — `manualChunks` Vite (react-vendor / headlessui / crypto / markdown). Main bundle 1 416 KB → 791 KB (-44 %), 455 KB gz → 229 KB gz (-50 %).
- **OPS-07** — `.github/dependabot.yml` (npm + github-actions + docker) configuré.
- **OPS-08** — `pnpm audit --audit-level=high` step CI + Trivy sur image@digest dans docker-build. Baseline clean après bump Playwright 1.55.1.

### Tier 3 — Quality polish (en cours)
- **OPS-06** — 5 specs Playwright supplémentaires : recovery code, passkey enroll/login non-PRF, change-password, account-deletion cascade, module CRUD.
- **SEC-09** — Matrice de rétention RGPD ajoutée dans `docs/Security.md` §9 (12 tables couvertes) + brouillon CGU créé dans `docs/Terms.md` (8 sections + glossaire).
- **REFACTO-08** — *(cf. Tier 2)*.
- **FRONT-04** — Hook `useDocumentTitle` câblé sur 14 pages publiques. `/flow` garde le titre statique « Nodea » par invariant privacy.
- **FRONT-06** — Scroll restoration intra-`/flow` : `setModule` stamp `scrollY` sur l'entrée sortante, popstate handler restore via `requestAnimationFrame`.
- **FRONT-07** — Vérifié : pas de double `<h1>` sur les pages auth. No-op.
- **FRONT-12** — `<link rel="canonical">` statique dans `index.html` + override dynamique par tab dans `Docs.tsx`.
- **API-05** — `Location:` headers ajoutés sur les 3 vrais POST de création (invites, announcements, records).
- **API-13** — Header `X-Order: unspecified` sur `GET /<module>/records` + commentaire d'en-tête formalisant le contrat.
- **API-16** — Audit `authRoutes` confirme qu'il n'y a plus de routes legacy ; commentaire obsolète dans `app.ts` mis à jour.
- **SEC-10** — `WEB_BASE_URL` rendu obligatoire (Zod schema), fail-fast au boot. `.env.example` + CI .env mis à jour.
- **ARCH-02** — Dossier `docs/adr/` créé avec 5 premiers ADRs : architecture en couches, Zustand single store, frontière snake/camelCase, pas de cache de requêtes, pas de SSR.

### À venir (Tier 3 reste)
- **OPS-12** — Ce CHANGELOG.md *(en cours)*.
- **OPS-14** — Runbook `docs/Operations.md`.
- **ARCH-10** — Sweep des références « Phase N » / « Tier X » obsolètes dans le code.
- **SEC-06** / **SEC-07** / **SEC-08** — Privacy fine.

---

## Avant le cycle d'audit (legacy)

Le projet a démarré en JSX + PocketBase, puis a migré vers TypeScript + Hono + Drizzle + PostgreSQL. La migration s'est faite en plusieurs phases trackées dans les commits préfixés `Phase N`, `Auth-Roadmap …`, etc. Pour l'archéologie : `git log --grep "Phase\|Auth-Roadmap"`.

Les jalons importants pré-cycle d'audit :

- **Phase 1** (~2025-Q3) — Cutover JSX → TypeScript strict, monorepo pnpm.
- **Phase 2** — Migration auth vers OPAQUE (`@serenity-kit/opaque`, Cure53-audited).
- **Phase 3** — Recovery code KEK + matrice de re-auth.
- **Phase 4** — Passkeys WebAuthn + PRF (extension hardware).
- **Phase 5** — TOTP enrollment + login + stepped MFA + bypass via lien email + délai 7 jours.
- **Phase 6** — Bypass MFA ergonomique.
- **Phase 7** — Re-auth granulaire (`requireFreshPassword`, `requireFreshPasswordOrPasskey`).
