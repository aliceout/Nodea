# API & contrats — audit & roadmap

> **Statut** : audit posé après les chantiers `module-refacto`,
> `factoring-audit`, la migration logo, l'audit organisation
> ([`refacto.md`](./refacto.md)) et l'audit sécurité
> ([`security.md`](./security.md)). 16 findings identifiés —
> dont **0 critique**, 1 élevé, 5 moyens, 8 faibles, 2
> informatifs. La posture API est **un hybride REST + RPC tenu
> honnêtement**, mais avec **deux cultures de nommage qui
> cohabitent sans convention figée** (snake_case sur les
> blobs chiffrés, héritage PocketBase ; camelCase ailleurs,
> écrit pendant la migration Hono).
>
> **Mise à jour** : à chaque PR qui livre un fix, cocher la
> case correspondante. Si un fix change un contrat publié
> (renommage de champ, code HTTP, structure de réponse),
> mettre à jour `documentation/API.md` (à créer — cf. API-11)
> dans le **même commit**.

Audit mené sur le code au commit `e17fd5c`. **Périmètre limité
à la cohérence et la qualité des contrats API** — pas de
sécurité (cf. [`security.md`](./security.md)), pas de fiabilité
runtime, pas de perf hors design d'API.

---

## Diagnostic global

L'API est **un hybride REST + RPC tenu honnêtement**, mais
avec **deux cultures de nommage qui cohabitent**. Les routes
qui portent les blobs chiffrés (`/<module>/records/*`,
`/modules-config`, `/user-preferences`) émettent du
**snake_case** — `cipher_iv`, `payload`, `module_user_id`,
`updated_at` — un héritage assumé du modèle d'accès PocketBase
d'origine cité explicitement dans les commentaires. Les routes
utilisateur et admin (`/auth/me`, `/admin/users`,
`/admin/announcements`) émettent du **camelCase** —
`wrappedMainKey`, `passkeysCount`, `createdAt`, `updatedAt`.
Les deux modèles vivent dans la même API sans qu'aucun document
ne formalise quand on utilise lequel.

Le style est **assumé hybride** : RPC pour les protocoles auth
(`/auth/login/start|finish`, `/auth/totp/enroll/start|verify`,
`/auth/recover-kek/start|finish`) parce que ces flots sont
multi-tour cryptographiques, et REST pour les ressources
(`/admin/users`, `/admin/announcements/:id`,
`/<module>/records/:id`). Cette segmentation tient debout. En
revanche les **codes de statut sont sous-utilisés** : `201
Created` n'apparaît que **2 fois** dans toute l'API ; tous les
autres POST de création retournent **200 OK** avec le body de
la ressource créée.

Un consommateur peut **partiellement deviner** : tous les
errors sont en `{ error: 'snake_case_code' }` avec un statut
HTTP correct, le pattern auth `/start → /finish` revient pour
OPAQUE / passkey / TOTP / recovery / reset, les dates sont
toujours en ISO 8601, les IDs sont toujours UUID strings. Mais
dès qu'il faut prédire si la réponse est `{ users: [...] }`,
`{ ok: true, ...truc }`, ou la ressource brute, **il faut lire
le code** — il n'y a pas d'OpenAPI spec, et seulement ~50 %
des routes ont un Zod `ResponseSchema` formellement défini
dans `@nodea/shared`.

Ce qui frappe en bien : **`{ error: 'snake_case_code' }` est
rigoureusement uniforme** sur les 67 routes, avec un
dictionnaire d'erreurs lisible (`invalid_body`, `not_found`,
`invalid_credentials`, `email_taken`, `cannot_delete_self`,
`guard_already_promoted`, `email_send_failed`,
`rate_limited`...). Et **les middlewares d'autorisation sont
systématiques** via le `createCollectionRoutes` factory —
impossible d'oublier un `requireUser` ou un `requireGuard` sur
les modules.

**Phrase pour qualifier l'expérience développeur** : *« Lisible,
prévisible aux trois quarts, mais le quart restant t'oblige à
grep le code parce qu'il n'y a ni OpenAPI ni convention figée
pour trancher snake_case vs camelCase. »*

L'API n'est **pas** plusieurs APIs avec des cultures différentes
au sens d'« interne vs publique » ou « v1 vs v2 ». Elle est
mono-publique, mono-version. Mais elle est **deux dialectes
de nommage** : le dialecte « blob chiffré » (snake_case, hérité
PocketBase) et le dialecte « ressource utilisateur » (camelCase,
écrit pendant la migration Hono). C'est l'info la plus
importante du rapport.

---

## Reconnaissance

### Style

- **Hybride REST + RPC**, par segmentation domaine :
  - **RPC** : `/auth/login/{start,finish}`, `/auth/passkeys/login/{start,finish}`, `/auth/passkeys/enroll/{options,verify}`, `/auth/totp/enroll/{start,verify}`, `/auth/totp/{disable,regen}`, `/auth/recover-kek/{start,finish}`, `/auth/reset/{start,finish}`, `/auth/reauth/{password,passkey}/{start,finish}`, `/auth/mfa/{totp,passkey}/{verify,start,finish}`
  - **REST** : `/admin/users`, `/admin/invites`, `/admin/announcements`, `/<module>/records/:id` (×6 modules)
  - **Hybride** : `/auth/me` (REST singular), `/auth/email`, `/auth/username` (action-flavored sur sous-ressources), `/auth/onboarding/complete` (verb-in-URL)
  - **Streaming** : `/library/lookup/by-query/stream` (NDJSON)

### Versionnement

**Aucun**. Pas de `/v1` ni `/v2` dans les URLs, pas de header.
Le seul indice de version est le filename `auth-register-v2.ts`.

### Documentation

- **Pas d'OpenAPI / Swagger**. Aucun fichier `*.openapi.{json,yaml}`
  ou `*.swagger*` dans le repo.
- **Zod schemas** dans [`packages/shared/src/schemas/`](../../packages/shared/src/schemas/)
  (16 fichiers) — tous les **bodies de requête** validés ;
  seulement ~**50 %** des **réponses** ont un `ResponseSchema`
  formel.
- **Doc humaine** : `documentation/Architecture.md`,
  `docs/Auth-Spec.md` (~2700 lignes), CLAUDE.md. Pas de
  `documentation/API.md` dédié.

### Conventions de nommage observables

| Niveau | Style | Exemples |
|---|---|---|
| URL paths | **kebab-case** | `/modules-config`, `/library/lookup/by-isbn`, `/cover-fetch` |
| URL singular vs plural | **mixé** | `/admin/users` (plural), `/auth/me` (singular), `/modules-config` (singular invariant) |
| JSON keys (crypto / entries) | **snake_case** | `cipher_iv`, `payload`, `module_user_id`, `updated_at` |
| JSON keys (user / admin) | **camelCase** | `wrappedMainKey`, `passkeysCount`, `createdAt`, `updatedAt` |
| Erreurs | **snake_case codes** | `{ error: 'invalid_body' }`, `{ error: 'email_taken' }` |
| Dates | **ISO 8601 strings** | `2026-04-30T15:16:02.000Z` partout |
| IDs | **UUID strings** | `randomUUID()` côté serveur |

### Authentification

- Cookie session signée (`nodea_session`, HMAC via
  `COOKIE_SECRET`).
- 3 niveaux : public (rate-limited), `requireUser`,
  `requireUser + requireAdmin`.
- 2 middleware spécifiques en plus : `requireFreshPassword` /
  `requireFreshPasswordOrPasskey` (réauth récente, 5 min) sur
  les actions sensibles ; `requireMfaPending` (session
  `mfa_pending` exclusivement) ; `requireGuard` (sid + HMAC
  guard) sur les mutations d'entrées chiffrées.

### SDK / client typé

- **Aucun SDK** publié.
- **Pas de `hc<AppType>` Hono RPC client** — décision
  explicite documentée dans [`packages/web/src/core/api/internal.ts`](../../packages/web/src/core/api/internal.ts#L7).
- **Client manuel** : ~38 fonctions nommées RPC-style
  (`apiLoginStart`, `apiMe`, `apiChangeEmail`...), thin
  wrappers sur `fetch` réutilisant les schémas Zod de
  `@nodea/shared` quand ils existent.

### Codes de statut utilisés (compté sur tout l'API)

| Code | Usages | Notes |
|---|---:|---|
| 200 | implicite | tous les success qui ne sont pas 201 |
| **201** | **2** | ⚠️ utilisé seulement à 2 endroits, voir API-05 |
| 400 | 85 | validation (Zod) + missing params |
| 401 | 34 | unauthenticated, invalid_credentials |
| 403 | 4 | forbidden (admin), guard_mismatch |
| 404 | 10 | not_found |
| 409 | 6 | conflict |
| 410 | 3 | gone (probable expired tokens) |
| 413 | 1 | payload too large |
| 415 | 1 | unsupported media type |
| 500 | 4 | internal_error, insert_failed, update_failed |
| 502 | 6 | upstream failure (email send, library lookup) |

---

## Findings

### API-01 — Mixed snake_case / camelCase dans les payloads JSON — livré

- **Sévérité** : élevée
- **Type de breaking** : breaking — données chiffrées existantes invalides après migration (ADR-0012 §Consequences). Ok parce que le projet est encore au stade solo dev avec son propre compte.
- **Statut** : livré (Tier 4 / Phase 2). Décision : option lourde (camelCase partout) plutôt que doc-only, anticipation du chantier mobile imminent.
- **Décision figée** : [ADR-0012](../adr/0012-camel-case-only-on-the-wire.md) — supersède [ADR-0003](../adr/0003-snake-case-camel-case-frontier.md). Tout-camelCase sur le wire (wrappers + payloads chiffrés). Les colonnes DB restent en snake_case (Drizzle map automatiquement vers camelCase côté code TS).
- **Tâches**
  - [x] Wire-level migration : `cipher_iv`, `module_user_id`, `updated_at`, `build_date` → camelCase. Touche schémas `entries.ts` + `preferences.ts`, routes `collection-factory.ts` + `modules-config.ts` + `user-preferences.ts` + `/version`, clients web `storage`/`modules-config-client`/`preferences-client`/`collection-client`. Commit `892f96a`.
  - [x] Payload-level migration : `mood_score`, `mood_emoji`, `completed_at`, `started_at`, `finished_at`, `item_rid`, `cover_rid`, `cover_url`, `original_language`, `is_favorite`, `blob_b64`, `fetched_from`, `fetched_at`, `last_year`, `next_year` → camelCase. Touche schémas `modules.ts` + `library-lookup.ts` et ~58 fichiers consommateurs (mappers, pages, services lookup, seeds). Commit `a8e6f54`.
  - [x] ADR-0003 marqué Superseded ; ADR-0012 acte la nouvelle convention.
- **Effort** : L — réalisé.
- **Risque** : breaking accepté
- **Dépendances** : aucune

### API-02 — URL naming mixé : pluriel/singulier, verbes-in-URL

- **Sévérité** : faible
- **Type de breaking** : breaking si on harmonise
- **Endpoints concernés** :
  - **Pluriel** : `/admin/users`, `/admin/invites`, `/admin/announcements`
  - **Singulier ressource** : `/auth/me`, `/modules-config`, `/user-preferences`
  - **Verb-in-URL** : `/admin/invites/:id/resend`, `/auth/onboarding/complete`, `/library/lookup/by-isbn`, `/library/lookup/cover-fetch`
  - **Action-on-singular** : `/auth/email` (PATCH), `/auth/username` (PATCH) — PATCH partiels sur `/auth/me`
- **Description** : pas une faille, mais une suite de petits choix qui obligent à se rappeler le pattern de chaque route. Le PATCH `/auth/email` aurait tout aussi pu être `PATCH /auth/me { email }`.
- **Tâches**
  - [ ] Documenter dans `documentation/API.md` la convention de fait : *« Les actions PATCH sur la ressource utilisateur courante peuvent être adressées soit comme `PATCH /auth/me { email }`, soit comme `PATCH /auth/email`. La seconde forme est utilisée quand l'action implique un re-auth dédié — la séparation par URL clarifie le besoin de réauth dans les middlewares. »*
- **Effort** : S
- **Risque** : faible (doc seulement)
- **Dépendances** : aucune

### API-03 — GET avec effets de bord (clic-de-lien email)

- **Sévérité** : faible
- **Type de breaking** : non-breaking (bouger en POST casserait les liens email existants)
- **Endpoints** :
  - [`GET /auth/mfa/bypass/confirm?t=<token>`](../../packages/api/src/routes/auth-mfa-bypass.ts#L174)
  - `GET /auth/mfa/bypass/cancel?t=<token>`
- **Description** : les liens d'email pour confirmer ou annuler une demande de bypass MFA sont des **GET** qui mutent l'état serveur. C'est le motif standard des magic links email — le client mail ne peut pas faire de POST. Mitigations : token single-use + signé + à validité courte. Tolérable mais théoriquement contraire à la sémantique GET (idempotent + safe).
- **Tâches**
  - [ ] Documenter explicitement dans `documentation/API.md` que ces deux GET sont des exceptions intentionnelles à la règle « GET = safe ».
- **Effort** : S
- **Risque** : faible
- **Dépendances** : aucune

### API-04 — `PUT` utilisé pour upsert-replace au lieu de `PATCH` partiel — livré

- **Sévérité** : faible
- **Type de breaking** : breaking si on bouge en PATCH
- **Statut** : livré (Tier 4 / Phase 2). Choix PUT confirmé : la paire `{ cipher_iv, payload }` est indivisible (l'IV sans son ciphertext n'a aucune utilité), un PATCH partiel n'a pas de sens. PUT signale « remplace l'intégralité du blob chiffré » et est idempotent.
- **Endpoints** :
  - [`PUT /modules-config`](../../packages/api/src/routes/modules-config.ts#L42)
  - [`PUT /user-preferences`](../../packages/api/src/routes/user-preferences.ts#L35)
- **Description** : ces deux routes prennent un body `{ cipher_iv, payload }` et font un upsert remplaçant la ligne entière. Sémantiquement c'est bien un `PUT` (replace, idempotent). Le finding est faible — c'est correct mais à doc.
- **Tâches**
  - [x] Justification PUT vs PATCH ajoutée dans les JSDocs des deux routes (option « note minime in-place » plutôt que création d'un `documentation/API.md` séparé). Le choix est ainsi documenté à la lecture du code, sans dupliquer dans un fichier doc à maintenir séparément.
- **Effort** : S — réalisé.
- **Risque** : faible
- **Dépendances** : aucune

### API-05 — `201 Created` + `Location` sur les POST de création — livré

- **Sévérité** : moyenne
- **Type de breaking** : non-breaking (les clients regardent le body)
- **Statut** : livré.
- **Sweep** :
  - `POST /admin/invites` → était déjà 201, **ajouté Location** : `/admin/invites/<id>`.
  - `POST /admin/announcements` → était déjà 201, **ajouté Location** : `/admin/announcements/<id>`.
  - `POST /<module>/records` (collection-factory) → était déjà 201, **ajouté Location** : `${path}/${row.id}`.
  - `POST /admin/invites/:id/resend` → laissé en 200 (action sur ressource existante, pas création).
  - `POST /auth/register/start`, `/register/finish`, `/passkey/enroll/start` etc. → tous laissés en 200 : ce sont des *handshakes multi-step* (OPAQUE, WebAuthn) qui retournent un état intermédiaire ; le 201 (« nouvelle ressource créée ») arrive sémantiquement plus tard, au /finish, et même alors le contenu retourné n'est pas une URL adressable mais un blob de session. Le 200 reste sémantiquement correct ici.
- **Tâches**
  - [x] Sweep complet des POST routes.
  - [x] `Location:` headers ajoutés sur les 3 vrais creates (les seuls qui retournaient déjà 201).
  - [x] Aucun test vitest n'asserte sur l'absence de `Location` ; les tests qui check `status === 201` continuent de passer.
- **Effort** : M — réalisé.
- **Risque** : faible
- **Dépendances** : aucune

### API-06 — Enveloppe de succès incohérente

- **Sévérité** : moyenne
- **Type de breaking** : breaking si on harmonise (option B)
- **Endpoints** : 4 patterns coexistent
  - **`{ ok: true }`** — actions void : logout, change email/username, onboarding/complete, delete account, delete invite, totp/disable, etc.
  - **`{ ok: true, ...flags }`** — actions avec extras : `recover-kek/finish` → `{ ok: true, regenerated: bool }`, `register/finish` → `{ ok: true, activated: bool, email?: string }`
  - **`{ <collection>: [...] }`** — listes : `{ users: [...] }`, `{ announcements: [...] }`, `{ records: [...] }`, `{ invites: [...] }`
  - **Resource brute** — singletons : `GET /auth/me`, `GET /modules-config`, créations qui retournent la ressource via `toView(row)`
- **Description** : il n'y a pas d'enveloppe globale type `{ data: ..., error: ... }`. Les 4 patterns ont chacun leur logique mais le consommateur doit savoir lequel s'applique. Le pattern `{ ok: true, ...flags }` est traître : un caller qui fait `if (response.ok)` confond le booléen avec la propriété `Response.ok` de l'API fetch.
- **Tâches**
  - [ ] **Option A (légère, non-breaking-ish)** : renommer `ok` en `done` ou `applied` dans toutes les réponses void. Ou laisser `ok` mais figer dans `documentation/API.md`.
  - [ ] **Option B (lourde, breaking)** : enveloppe globale `{ data: ..., meta?: ... }` partout. Migration 6 mois minimum.
  - [ ] **Recommandation** : option A + figer la règle dans la doc.
- **Effort** : S pour option A (juste doc), L pour option B
- **Risque** : faible pour A, élevé pour B
- **Dépendances** : aucune

### API-07 — Enveloppe d'erreur uniforme — point fort à conserver

- **Sévérité** : N/A — c'est un positif
- **Endpoints** : tous (85 occurrences de 400, 34 de 401, etc.)
- **Description** : `{ error: 'snake_case_code' }` partout, avec un dictionnaire stable et lisible. Le seul accident est `{ error: 'rate_limited' }` qui ajoute aussi un header `Retry-After` — bonne pratique HTTP.
- **Tâches**
  - [ ] Documenter dans `documentation/API.md` comme convention figée.
  - [ ] Compiler la liste exhaustive des codes d'erreur dans la doc (catalogue).
- **Effort** : S
- **Risque** : aucun
- **Dépendances** : aucune

### API-08 — Pas de pagination sur les listes

- **Sévérité** : moyenne (deviendrait élevée à scale ou en multi-tenant)
- **Type de breaking** : non-breaking (ajouter `?limit=` + `?cursor=` est rétro-compatible si défaut « tout »)
- **Endpoints** :
  - `GET /admin/users` — full scan, ordered by email
  - `GET /admin/invites` — full scan
  - `GET /admin/announcements` — full scan
  - `GET /<module>/records` — full scan, ordered by physical insertion
  - `GET /announcements` — `?limit=` partiellement présent ([announcements.ts:20](../../packages/api/src/routes/announcements.ts#L20))
- **Description** : aucune des listes ne paginate. Pour Nodea aujourd'hui (self-host single-instance, ≤ centaines d'users) c'est acceptable. Mais c'est un **contrat implicite dangereux** pour tout consommateur qui un jour scrapera ou exportera. Bloquant si Nodea s'ouvre à du multi-tenant ou à de gros catalogues Library.
- **Tâches**
  - [ ] Ajouter un pattern `?limit=N&cursor=<id>` sur les 4 routes admin + `/<module>/records`. Cursor-based plutôt qu'offset-based.
  - [ ] Standardiser le shape de réponse : `{ <collection>: [...], next_cursor: string \| null }` (snake_case côté entries, camelCase côté admin — cf. API-01).
  - [ ] Documenter le limit max (ex: 1000) et le défaut (ex: 100).
- **Effort** : M (~3h pour les 5 endpoints + tests)
- **Risque** : faible (param optionnel, défaut « tout »)
- **Dépendances** : aucune

### API-09 — Noms de query params abrégés vs longs

- **Sévérité** : faible
- **Type de breaking** : breaking si on aligne
- **Endpoints** :
  - **Abrégés** : `?sid=`, `?d=`, `?t=`
  - **Longs** : `?token=`, `?url=`, `?limit=`
- **Description** : `sid`, `d`, `t` sont des conventions PocketBase préservées. `token`, `url`, `limit` sont les conventions modernes. Cohabite avec API-01 — même split snake_case/camelCase, même origine.
- **Tâches**
  - [ ] Documenter dans `documentation/API.md` mais ne pas migrer.
  - [ ] Si SEC-01 (déplacer `sid+d` en headers) est livré, le problème de naming des query params disparaît automatiquement.
- **Effort** : S
- **Risque** : faible
- **Dépendances** : SEC-01 du rapport [`security.md`](./security.md)

### API-10 — Aucune stratégie de versionnement

- **Sévérité** : moyenne
- **Type de breaking** : N/A (c'est ce qui empêche d'en faire de breaking proprement)
- **Endpoints** : tous
- **Description** : pas de `/v1/...`, pas de `Accept: application/vnd.nodea.v2+json`, pas de header. Le suffixe `auth-register-v2.ts` (côté filename) trahit qu'une v2 a remplacé une v1 sans que l'URL le reflète. Conséquence : tout breaking change futur (renommer un champ camelCase ↔ snake_case, changer la pagination, restructurer une réponse) **n'a pas de chemin de migration propre**.
- **Tâches**
  - [ ] À court terme : **rien** — pas urgent tant que l'API n'a pas de consommateurs externes (mobile, partenaires).
  - [ ] Avant le premier consommateur externe : décider entre **URL versioning** (`/v1/...`) ou **header versioning** (`Accept: application/vnd.nodea.v1+json`).
  - [ ] Documenter la version dans `/healthz` ou créer un `/version` (cf. API-15).
- **Effort** : L quand activé (refonte des routes)
- **Risque** : moyen-élevé
- **Dépendances** : aucune (mais à figer avant tout consommateur externe)

### API-11 — `*ResponseSchema` Zod câblés sur les call sites — livré (court terme)

- **Sévérité** : moyenne
- **Type de breaking** : non-breaking (ajout de doc + de schémas)
- **Statut** : court terme livré (commit `87fba4c`). Moyen terme (OpenAPI) et long terme (client multi-langues) restent à faire.
- **Description initiale** : 16 fichiers `packages/shared/src/schemas/*.ts` exposaient des `*BodySchema` pour tous les bodies de requête, mais les `*ResponseSchema` n'étaient définis que pour ~50 % des routes, et même quand ils existaient, ils n'étaient quasiment jamais consommés côté client (sauf `apiMe` et `apiLibraryLookupByIsbn` qui parsaient manuellement).
- **Tâches**
  - [x] **Court terme** : ajouter un `*ResponseSchema` Zod pour chaque route GET / mutation qui retourne plus que `{ ok: true }`. Audit pré-câblage : 26 schémas existaient déjà ; un seul manquait (`AnnouncementListResponseSchema` pour l'enveloppe `{ announcements }` de `GET /admin/announcements`) — ajouté.
  - [x] **Câblage call sites** : les 26 schémas existants + le nouveau sont passés au quatrième argument du wrapper `request()` (cf. ARCH-12) sur `auth.ts` (11 sites), `passkeys.ts` (5), `mfa.ts` (4), `totp.ts` (2), `library.ts` (1), `admin.ts` (4). Les endpoints à réponse triviale (`{ ok: true }`, void, `{ id: string }`) ne sont volontairement pas câblés — pas de payoff pour le coût d'un schéma dédié.
  - [x] Suppression des `.parse()` manuels dans `apiMe()` et `apiLibraryLookupByIsbn()` — désormais routés via le wrapper, validés en dev/test seulement.
  - [ ] **Moyen terme** : générer un OpenAPI à partir des schémas Zod via `@hono/zod-openapi` ou `zod-to-openapi`. Servir un Swagger UI sur `/api/docs` (gated derrière `requireUser` ? `requireAdmin` ? public ? — décision design).
  - [ ] **Long terme** : générer un client typé (TS, Swift, Kotlin) à partir de l'OpenAPI.
  - [ ] Créer `documentation/API.md` qui consolide les conventions tirées des autres findings (cf. *Mini-styleguide* en bas).
- **Effort** : M pour le court terme — réalisé. L pour OpenAPI complet, ouvert.
- **Risque** : faible
- **Dépendances** : ARCH-12 ✓ (le wrapper de validation)

### API-12 — Pas de webhooks — N/A

- **Sévérité** : informatif
- **Description** : Nodea n'expose pas de webhooks aujourd'hui. Le seul flux sortant est l'envoi d'emails transactionnels (qui n'est pas un webhook public). N'apparaît pas comme manquement.
- **Tâches** : aucune.

### API-13 — Contrat « ordre non spécifié » sur LIST records — livré

- **Sévérité** : faible
- **Type de breaking** : breaking si on contraint l'ordre (ce que le contrat formalise pour empêcher)
- **Statut** : livré.
- **Tâches**
  - [x] Commentaire d'en-tête de la route `GET /records` enrichi avec un § « Contract on order (API-13) » qui explique que l'ordre est **unspecified** et que le client doit trier après déchiffrement. Postgres-physical-insertion-order n'est plus qu'un detail d'implémentation, susceptible de bouger sur VACUUM FULL / replica failover / future storage swap.
  - [x] Header `X-Order: unspecified` retourné sur chaque réponse pour formaliser le non-contrat aux yeux d'un futur consommateur (mobile, partner SDK).
- **Effort** : S — réalisé.
- **Risque** : faible
- **Dépendances** : aucune

### API-14 — `/auth/me` over-exposait les blobs wrappedKek/IV — livré

- **Sévérité** : faible
- **Type de breaking** : breaking (les blobs ne sont plus dans `/auth/me`).
- **Statut** : livré (Tier 4 / Phase 2). Décision de splitter prise en anticipation du chantier mobile à venir — au moment où l'app mobile sera le « consommateur externe » qui justifie le split.
- **Endpoints** :
  - [`GET /auth/me`](../../packages/api/src/routes/auth-account.ts) — profil seul (id, email, role, onboarding, MFA flags).
  - [`GET /auth/me/crypto`](../../packages/api/src/routes/auth-account.ts) — wrap blobs (wrappedMainKey, wrappedMainKeyIv, wrappedKekPassword, wrappedKekPasswordIv).
- **Description** : la réponse `/auth/me` contenait `wrappedMainKey`, `wrappedMainKeyIv`, `wrappedKekPassword`, `wrappedKekPasswordIv` — utiles au login pour déchiffrer la KEK, mais inutiles à 95 % des appels (sidebar, page Account, header, ProtectedRoute). ~2 KB de payload superflu à chaque hit page-load. Pas un risque sécu (tout est chiffré), juste de la bande passante.
- **Tâches**
  - [x] Schéma `AuthMeCryptoResponseSchema` ajouté dans `packages/shared/src/schemas/auth.ts`. `AuthMeResponseSchema` allégé des 4 fields wrapped*.
  - [x] Route `GET /auth/me/crypto` ajoutée (même `requireUser` que `/me`).
  - [x] Client web : `apiMeCrypto()` ajouté ; les 4 consommateurs qui lisaient `user.wrapped*` (login, change-password, recovery-code setup, passkey enroll) appellent la nouvelle route au moment du déballage de la KEK.
  - [x] `SessionUser` (Zustand store) débarrassé des fields wrapped*.
  - [x] Tests intégration `/auth/me` adaptés + nouveaux tests `/auth/me/crypto`.
  - [x] Docs alignées (Auth-Spec §7.2 schéma de login, §18 logger blacklist, Architecture.md §slices/auth + §shared schemas).
- **Effort** : M — réalisé.
- **Risque** : faible
- **Dépendances** : aucune

### API-15 — `GET /version` — livré

- **Sévérité** : faible
- **Type de breaking** : N/A (ajout)
- **Endpoints** : `GET /version` (public).
- **Statut** : livré.
- **Description** : un consommateur (debug, monitoring, support, futur mobile client) peut désormais savoir quelle build tourne sur l'instance via la SHA du commit + la date de build + la branche.
- **Tâches**
  - [x] Route `GET /version` ajoutée dans `packages/api/src/app.ts`. Retourne `{ commit, build_date, branch }` en lisant les env vars `BUILD_COMMIT`, `BUILD_DATE`, `BUILD_BRANCH` (toutes par défaut à `'unknown'` si absentes).
  - [x] Schéma Zod du config étendu avec ces 3 vars (`packages/api/src/config.ts`).
  - [x] Dockerfile api accepte 3 `ARG` correspondants et les transforme en `ENV` ; CI doit les passer via `--build-arg`.
  - [x] Test d'intégration vitest qui assure que la route répond 200 et n'expose **que** ces 3 champs (pas de `version` semver, pas d'`api_version` tant qu'API-10 n'est pas figée).
- **Effort** : S (~1h)
- **Risque** : faible
- **Dépendances** : aucune

### API-16 — Audit `authRoutes` — livré (no-op confirmé)

- **Sévérité** : faible
- **Type de breaking** : N/A (cleanup)
- **Statut** : livré (audit seulement, pas de code à supprimer).
- **Tâches**
  - [x] Lecture de `auth.ts` : c'est désormais un **thin barrel** qui mount 4 sub-routers (`authLoginRoutes`, `authResetRoutes`, `authChangePasswordRoutes`, `authAccountRoutes`). Aucune route legacy résiduelle dans le fichier.
  - [x] Le commentaire obsolète dans `app.ts` qui mentionnait *« the legacy single-shot register handler is no longer reachable »* (il n'existe plus) a été remplacé par un § citant l'audit API-16.
- **Effort** : S — audit fait.
- **Risque** : aucun
- **Dépendances** : aucune

---

## Récap par catégorie × sévérité

| Catégorie | Critique | Élevée | Moyenne | Faible | Info |
|---|---|---|---|---|---|
| 1. Cohérence structurelle | — | API-01 | — | API-02 | — |
| 2. Méthodes HTTP | — | — | — | API-03, API-04 | — |
| 3. Codes statut | — | — | API-05 | — | — |
| 4. Structure réponses | — | — | API-06 | API-07 (positif) | — |
| 5. Requêtes / params | — | — | API-08 | API-09 | — |
| 6. Versionnement | — | — | API-10 | — | — |
| 7. Doc / typage | — | — | API-11 | — | — |
| 8. Webhooks | — | — | — | — | API-12 |
| 9. Contrats implicites | — | — | — | API-13, API-14 | — |
| 10. DX | — | — | API-15 | API-16 | — |

**0 critique, 1 élevée, 5 moyennes, 8 faibles, 2 informatives.**

---

## Inventaire des incohérences systémiques

À traiter **en lot** si on s'y attaque, pas finding par finding :

1. **La frontière snake_case / camelCase** (API-01, API-09) — un seul commit doc qui figure la règle dans `documentation/API.md`. Toute future route sait ce qu'elle doit émettre.
2. **Les codes HTTP des creates** (API-05) — un sweep sur tous les POST de création pour passer 200 → 201, ajouter `Location:` header. Non-breaking.
3. **Les schémas Zod de réponse** (API-11) — sweep sur les ~25 routes sans `ResponseSchema`, ajouter pour chacune. ~1 jour. Préparation pour OpenAPI.
4. **Les enveloppes de succès `{ ok: true, ...flags }`** (API-06) — décider de la convention finale et figer dans la doc.

---

## Top 5 à corriger sans casser les consommateurs

1. **API-11** — Compléter les `*ResponseSchema` Zod manquants (~25 routes). Non-breaking, pose les bases de l'OpenAPI.
2. **API-15** — Ajouter `GET /version`. Pure addition, utile pour le support.
3. **API-08** — Pagination cursor-based aux 4 listes admin + `/<module>/records`. Param optionnel, défaut « tout », non-breaking.
4. **API-13** — Documenter explicitement le contrat « ordre non spécifié » sur `/<module>/records`. Doc-only.
5. **API-16** — Audit + cleanup des routes legacy dans `authRoutes`. Tester en e2e d'abord.

## Top 5 qui demandent un plan de migration (breaking)

1. **API-01** — Uniformiser snake_case ↔ camelCase. ✅ livré (camelCase partout, ADR-0012).
2. **API-05** — POST de création → 201. Mineur, mais certains tests vitest checkent peut-être `expect(res.status).toBe(200)` sur des creates.
3. **API-06** — Choisir une convention finale d'enveloppe `{ ok }` vs `{ data, meta }`. Réécrit toutes les routes.
4. **API-04** — `PUT /modules-config` → `PATCH /modules-config`. Non urgent, mais s'aligner sur PATCH = partial update.
5. **API-14** — Sortir les blobs `wrappedKek*` de `/auth/me` vers `/auth/me/crypto`. ✅ livré.

---

## Mini-styleguide d'API (à figer dans `documentation/API.md`)

Tiré de ce qui existe déjà de mieux dans le code. À documenter, pas à inventer.

```markdown
## Conventions API Nodea — V1

### URL paths
- kebab-case toujours : `/modules-config`, `/library/lookup/by-isbn`
- Pluriel pour les collections : `/admin/users`, `/admin/invites`
- Singulier pour les ressources canoniques uniques : `/auth/me`, `/modules-config`
- Verbes acceptés dans l'URL pour les actions non-CRUD : `/admin/invites/:id/resend`, `/auth/onboarding/complete`
- Pattern `/start` + `/finish` pour les protocoles multi-tour cryptographiques

### JSON keys
- snake_case sur les payloads qui transportent des blobs chiffrés : `module_user_id`, `cipher_iv`, `payload`, `guard`, `updated_at`. Hérité PocketBase, préservé volontairement.
- camelCase partout ailleurs : `wrappedMainKey`, `passkeysCount`, `createdAt`, `updatedAt`, `onboardingStatus`.

### Erreurs
- Toujours `{ error: "snake_case_code" }` avec status HTTP correct.
- Codes connus : `invalid_body`, `unauthenticated`, `forbidden`, `not_found`, `email_taken`, `cannot_delete_self`, `guard_mismatch`, `rate_limited`, `email_send_failed`, `internal_error`.
- `429 rate_limited` accompagné d'un header `Retry-After`.

### Succès
- `{ ok: true }` pour les actions void.
- `{ ok: true, ...flags }` quand l'action a des infos additionnelles.
- `{ <collection>: [...] }` pour les listes.
- Resource brute pour les GET de singleton.

### Codes de statut
- 200 OK pour les succès non-création.
- 201 Created pour les POST qui créent une ressource (avec header `Location:` si possible).
- 400 invalid_body / missing_*.
- 401 unauthenticated / invalid_credentials.
- 403 forbidden / guard_mismatch.
- 404 not_found.
- 409 conflict (`email_taken`, `user_already_exists`).
- 410 gone (token expiré).
- 429 rate_limited (avec Retry-After).
- 502 upstream_failed (email, library lookup).

### Dates
- Toujours ISO 8601 string (`new Date().toISOString()`).

### IDs
- Toujours UUID v4 string (`randomUUID()`).

### Auth
- Cookie session signée (`nodea_session`), 3 niveaux : public, requireUser, requireAdmin.
- Réauth fraîche pour mutations sensibles (`requireFreshPassword` / `requireFreshPasswordOrPasskey`).
- Guard HMAC sur mutations d'entries chiffrées.

### Versionnement
- Aucun versioning d'URL pour V1. Premier breaking change → décision à prendre (URL `/v2` vs Accept header).

### Doc
- Tous les bodies validés Zod (`@nodea/shared/schemas/`).
- Réponses Zod-typées progressivement (objectif 100 %).
- OpenAPI à générer depuis les schémas Zod (post-V1).
```

---

## Sequencing recommandé

```
Semaine 1 (additions non-breaking)
  ├─ API-11    (Zod ResponseSchema manquants)
  ├─ API-15    (GET /version)
  └─ API-13    (doc « ordre non spécifié » sur records)

Semaine 2 (cohérence interne, sans casser)
  ├─ API-08    (pagination cursor optionnel)
  ├─ API-16    (audit + cleanup authRoutes legacy)
  └─ API-05    (POST creates → 201)

Semaine 3+ (doc + figer les conventions)
  ├─ Créer documentation/API.md (consolide API-01, API-02, API-03, API-04, API-06, API-07, API-09)
  ├─ API-10    (préparer versioning avant le 1er consommateur externe)
  └─ API-14    (split /auth/me/crypto) ✅ livré

Plus tard (si SDK / mobile / partenaires)
  ├─ API-01    (uniformisation snake/camel — breaking)
  └─ API-06 option B  (enveloppe globale — breaking)
```

---

## Décisions à figer (avant de commencer)

| Décision | Options | Impact |
|---|---|---|
| Frontière snake_case / camelCase | Documenter et garder / Migrer en bloc vers camelCase | API-01 — préfère documenter, migrer demande versioning |
| Stratégie de versionnement | URL (`/v1/...`) / Header (Accept) / Aucune | API-10 — préfère URL pour debugger facile, à figer **avant** premier breaking |
| Enveloppe `{ ok: true, ...flags }` | Garder + doc / Renommer `ok` en `done` / Enveloppe globale `{ data, meta }` | API-06 — préfère « garder + doc », option C trop coûteuse |
| OpenAPI servi public ou gated ? | Public sur `/api/docs` / `requireUser` / `requireAdmin` / Pas servi | API-11 — préfère gated `requireAdmin` pour pas exposer la surface aux scrappers |
| `/auth/me/crypto` séparation | Garder fusionné / Séparer en V2 | API-14 — **séparé** (Tier 4 / Phase 2). Anticipation du chantier mobile imminent qui justifie le split (consommateur externe = mobile). |

---

## Angles morts

Ce que je n'ai pas pu vérifier depuis le code :

1. **Usage réel des endpoints** — qui appelle quoi à quelle fréquence. Sans télémétrie produit, impossible de prioriser un cleanup sur des routes peut-être mortes ou sous-utilisées. SEC-01 du rapport sécu ([`security.md`](./security.md)) pousse à ne **pas** logger les query strings, donc même la télémétrie minimale est compliquée.
2. **Routes legacy dans `authRoutes`** — j'ai seulement vu l'avertissement *« no longer reachable »* dans le commentaire. Vérifier le contenu exact (cf. API-16).
3. **Comportement réel sur 410 Gone** — 3 occurrences mais je n'ai pas vérifié le contexte exact. Quels tokens expirés émettent 410 vs 401 vs 404 ?
4. **Status réels en cas d'erreur Drizzle / DB** — quand une transaction rollback ou qu'une `unique_violation` apparaît hors handler de `isUniqueViolation`, est-ce que ça remonte en 500 + `{ error: 'internal_error' }` (l'`onError` global) ou en autre chose ?
5. **Charge réelle sur `/library/lookup/by-query/stream`** — endpoint NDJSON streaming, comportement sous timeout client / disconnect non-vérifié.
6. **Compatibilité descendante** — si quelqu'un a un Nodea déployé d'il y a 6 mois et qu'on ajoute un champ obligatoire dans une réponse, quel impact ? Pas de processus formel.

---

## Comment cocher

- À chaque PR qui livre un fix, cocher les `[ ]` correspondants dans la liste de tâches du finding concerné.
- Quand toutes les tâches d'un finding sont cochées, ajouter `— résolu (commit `xxxxxxx`)` à côté du titre.
- Quand tous les findings d'une catégorie sont résolus, déplacer la section en bas du document sous une rubrique « Résolu ».
- Quand toute la roadmap est livrée, retirer le fichier de `docs/roadmap/` (convention du repo : les roadmaps sont des artefacts temporaires qui disparaissent quand leur travail est fait — comme `i18n.md` et `health.md` retirés post-livraison).
