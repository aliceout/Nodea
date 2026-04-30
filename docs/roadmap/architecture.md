# Architecture & qualité structurelle — audit & roadmap

> **Statut** : audit posé après les chantiers `module-refacto`,
> `factoring-audit`, la migration logo, et les audits parallèles
> ([`refacto.md`](./refacto.md), [`security.md`](./security.md),
> [`api.md`](./api.md), [`frontend.md`](./frontend.md)) ; les
> roadmaps `health.md` et `i18n.md` qui ont précédé ont déjà
> été livrées et retirées. 17 findings identifiés —
> **0 critique, 0 élevé, 4 moyens, 13 faibles** + 1 point fort
> à conserver. C'est le **plus subjectif** des audits ; chaque
> finding porte une note de subjectivité explicite.
>
> **Mise à jour** : à chaque PR qui livre un fix, cocher la
> case correspondante. Si une décision architecturale est
> figée par cet audit (ex : *« on garde nodea-store en
> mono-store »*), créer un ADR dans `docs/adr/` (cf. ARCH-02).

Audit mené sur le code au commit `55ab567`. **Périmètre limité
à l'organisation du code, la séparation des responsabilités,
la dette de fond** — pas de duplication ([`refacto.md`](./refacto.md)),
pas de bugs runtime, pas de sécurité ([`security.md`](./security.md)).

---

## Diagnostic global

L'architecture **réelle** du projet est **un layered +
feature-first hybride, tenu honnêtement, avec une dette
assumée mid-migration**. Côté API, c'est une stack layered
classique (`routes/` → `middleware/` → `auth/` + `services/`
→ `db/`) où chaque couche a sa place et la frontière est
respectée — pas de logique métier qui fuit dans les
contrôleurs (les routes sont des fichiers de 200-400 LOC qui
font validation Zod + délègue aux helpers `auth/*` ou aux
services). Côté web, c'est plus mixte : `app/flow/<Module>/`
est feature-first (chaque module porte ses `components`,
`views`, `lib`, `context`) et `core/` est layer-first (`api`,
`auth`, `crypto`, `store`...). La frontière est claire et
fonctionne, mais la cohabitation pourrait dérouter quelqu'un
qui s'attend à un mono-paradigme.

Le projet a une **vraie colonne vertébrale**, pas une
juxtaposition de features développées indépendamment : la
`collection-factory` côté API fait que tout module CRUD passe
par les mêmes 4 routes avec les mêmes guards, et la
`createModuleContexts` factory côté web fait que tout module
avec état local passe par les mêmes 3 contextes (Data /
Filters / Actions).

Ce qui frappe en premier, c'est **l'explicit migration
awareness** : presque chaque fichier non-trivial porte un
commentaire qui le situe dans un *« Phase N »*
(`Auth-Roadmap Phase 2C`, `module-refacto Tier B`, `Tier 5
i18n`, `Phase 4 of Auth-Roadmap`). C'est rare dans un
codebase, et c'est précieux : les développeurs futurs peuvent
reconstituer l'historique d'une décision sans `git blame`.
L'envers du décor : ces phases coexistent — `auth.ts` legacy
(no longer reachable) à côté de `auth-register-v2.ts`, le
pattern PocketBase snake_case préservé dans les routes
entries à côté du camelCase moderne dans `/auth/me`. Ce n'est
pas du désordre, c'est de la **dette assumée** que le projet
n'a pas encore eu le luxe de purger.

Les paradigmes sont **cohérents par couche** : pas de
classes-vs-fonctions au hasard. Tout est fonctionnel + hooks
côté React, tout est handler-de-route + helpers côté Hono.
Les seuls patterns OOP visibles sont les classes
`EmailService` (Console / Smtp / Recording) qui implémentent
une interface — usage légitime du polymorphisme. Le typage
est **basically pristine** : 0 `:any` explicites, 1 seul
`@ts-ignore` dans tout le code, TS strict + extras
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`). Ce niveau de discipline TS est
inhabituel pour un projet de cette taille.

Plusieurs époques sont visibles, mais elles **vivent ensemble
proprement**. La couche legacy (PocketBase + JSX) est en voie
d'extinction (1 seul `.jsx` reste, `I18nProvider.jsx`, qui
était tracké dans `health.md` avant la livraison de cette
roadmap). La couche Hono + Drizzle (post-Phase
2) est récente et soignée. La couche en cours d'écriture
(i18n Tier 5/6) commit Tier-par-Tier — discipline. Les 6
roadmaps actives tracent les chantiers en flight ; c'est
beaucoup, mais c'est de la dette **rendue visible**, donc
traitable.

Ce qui frappe **en mal**, et qui touche au cœur de cet audit :
**CLAUDE.md décrit une architecture que le code n'a pas
encore livrée**. Le doc dit *« TanStack Query »* — pas
installé. *« Forms via React Hook Form + Zod resolver »* — 5
pages auth utilisent encore `useState` brut. *« Pino
structured logs »* — c'est `hono/logger()` qui tourne. Ce
n'est pas du code malhonnête, c'est un **gap aspirationnel-
vs-actuel** typique d'un projet qui a documenté sa cible
avant de l'atteindre. Le coût réel : un nouvel·le
développeur·euse qui lit CLAUDE.md d'abord va chercher
`import { useQuery } from '@tanstack/react-query'` et ne
trouvera rien — confusion 30 minutes avant de comprendre
qu'il faut chercher dans `flow/<Module>/context.tsx`.

**Phrase pour qualifier la dette technique à un nouveau
développeur** : *« La dette est presque entièrement de la
dette de migration en cours, pas de la dette de design —
chaque scorie a son ticket dans une roadmap, et la trajectoire
pour s'en débarrasser est explicite. Tu ne tomberas pas sur
du code architecturalement étrange ; tu tomberas sur du code
qui a un commentaire `// Phase N` qui te dit où il en est. »*

Sur la distinction *« mal architecturé »* vs *« architecturé
selon une logique que je ne saisis pas »* : pour Nodea, je
penche **clairement** sur la deuxième. La logique est lisible,
juste pas toujours documentée explicitement (la frontière
snake_case/camelCase, par exemple, vit dans des commentaires
individuels plutôt que dans `documentation/API.md`).

---

## Reconnaissance

### Structure et logique d'organisation

| Niveau | Logique | Exemples |
|---|---|---|
| Racine | Standard pnpm monorepo | `packages/`, `docs/`, `documentation/`, `infra/`, `scripts/` |
| `packages/api/src/` | **Layered** (couche par dossier) | `routes/`, `middleware/`, `auth/`, `services/`, `db/`, `collections/`, `cron/`, `lookup/`, `seed/`, `test/` |
| `packages/web/src/` | **Hybride** | `app/` (entry + features), `core/` (couches transverses), `ui/` (design system), `i18n/`, `lib/`, `types/` |
| `packages/web/src/app/flow/` | **Feature-first** | `Goals/`, `Library/`, `Journal/`, `Mood/`, `Habits/`, `Review/`, `Account/`, `Admin/`, `Homepage/` |
| `packages/web/src/ui/` | **Type-first** | `atoms/dirk/`, `atoms/auth/`, `atoms/feedback/`, `dirk/` (composites), `branding/`, `layout/`, `theme/` |
| `packages/shared/src/` | **Domain-first** | `schemas/` (16 fichiers Zod), `crypto-types.ts`, `password-rules.ts`, `threads.ts` |

### Couches et étanchéité

- **API** : présentation (`routes/`) → middleware → application (`auth/`, `services/`) → infra (`db/`). Frontière respectée — les routes ne touchent jamais directement à `drizzle-orm` au sens de domaine, elles passent par des `db.select()` directs ou par des helpers `auth/*`.
- **Web** : présentation (`app/`, `ui/`) → application (`core/`) → domain (`@nodea/shared/`) → infra (`fetch()` + `localStorage`). Pas d'ORM-équivalent côté client.
- Pas de DI explicite — les imports + `getConfig()` font office.

### Patterns dominants

- **Côté API** : style Express-flavored (Hono), routes-as-modules, middleware factory. Polymorphisme léger sur `EmailService`.
- **Côté Web** : functional + hooks 100 %. Zustand pour le global state, React contexts pour le local state des modules, lazy loading pour le routing. **Aucune classe**, aucun HOC.

### Niveau de typage

| Métrique | Valeur |
|---|---|
| `tsconfig` strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` | ✅ |
| `:any` explicites (hors commentaires) | **0** |
| `@ts-ignore` / `@ts-expect-error` | **1** |
| `eslint-disable` | 13 (sur ~400 fichiers) |
| Branded types | Utilisés pour le crypto (`Base64`, `AesMainKey`), pas pour les IDs métier |

### Documentation interne

| Doc | Volume | État |
|---|---|---|
| `CLAUDE.md` (root) | ~12 KB | À jour, **partiellement aspirationnel** (TanStack Query, Pino — non livrés) |
| `docs/Auth-Spec.md` | ~2700 lignes | Maintenu activement |
| `docs/Database.md`, `docs/Modules.md`, `docs/Architecture.md` | varie | Synchronisation doc-code suivie historiquement dans `health.md` (livré). Ré-audit à prévoir si dérive. |
| `docs/roadmap/` | 7 fichiers (~3000+ lignes cumulées) | Toutes en cours, format homogène |
| ADR (Architectural Decision Records) | **0** | Décisions vivent dans les commits / commentaires |
| Commentaires-en-tête de fichier | Très denses sur les fichiers critiques |

---

## Findings

### ARCH-01 — `CLAUDE.md` aspirationnel : promesses non encore livrées

- **Type** : cohérence (doc-vs-code)
- **Sévérité** : moyenne
- **Subjectivité** : faible
- **Zone concernée** : [`CLAUDE.md`](../../CLAUDE.md) — sections *« Stack target »*, *« Frontend rules »*, *« Error handling & logging »*
- **Description** : CLAUDE.md décrit comme **acquis** ce qui est encore **prévu**. Trois exemples concrets : *« TanStack Query »* (pas installé — `grep "@tanstack" packages/web/package.json` = vide), *« Forms via React Hook Form + Zod resolver »* (5 pages auth en `useState` brut, cf. [`refacto.md`](./refacto.md) REFACTO-06), *« Structured logs via Pino on the api »* (c'est `hono/logger()` qui tourne, cf. [`security.md`](./security.md) SEC-01).
- **Pourquoi c'est un problème concret** : un·e nouvel·le contributeur·ice qui lit CLAUDE.md en onboarding va chercher du code TanStack Query et ne trouvera rien → 30 min de confusion. Plus grave : les revues de PR peuvent demander à un·e contributeur·ice *« merci d'utiliser TanStack Query selon CLAUDE.md »* alors que **personne** ne le fait dans le code actuel. La doc devient un piège.
- **Tâches**
  - [ ] Restructurer CLAUDE.md en deux blocs nets : *« Stack actuelle »* (qui décrit ce qui tourne) + *« Stack cible »* (qui pointe vers les roadmaps `frontend.md` FRONT-13, `security.md` SEC-01, `refacto.md` REFACTO-06).
  - [ ] OU marquer chaque ligne aspirationnelle d'un *« 🚧 prévu — voir `<roadmap>` »*.
- **Effort** : S (~1h)
- **Risque** : aucun
- **Dépendances** : aucune

### ARCH-02 — Manque d'ADR (Architectural Decision Records)

- **Type** : documentation
- **Sévérité** : faible
- **Subjectivité** : moyenne
- **Zone concernée** : `docs/`, `documentation/`
- **Description** : pas de dossier `docs/adr/` ni équivalent. Les décisions architecturales importantes (« pourquoi pas TanStack Query », « pourquoi snake_case + camelCase coexistent », « pourquoi `hc<AppType>` pas utilisé », « pourquoi pas de SSR ») vivent **dans des commentaires individuels** ou dans les commits / PR descriptions.
- **Pourquoi c'est un problème concret** : dans 6 mois, quand quelqu'un regarde le code et se dit *« mais pourquoi pas hc<AppType>, ça aurait été plus simple »*, la réponse vit dans `packages/web/src/core/api/internal.ts:7` en commentaire — il faut connaître le fichier pour la trouver. Un ADR `docs/adr/0003-no-hono-rpc-client.md` serait découvrable via `ls docs/adr/`.
- **Tâches**
  - [ ] Créer `docs/adr/` avec un README qui explique la convention ([Markdown ADRs format](https://github.com/joelparkerhenderson/architecture-decision-record)).
  - [ ] Premier batch d'ADR à écrire :
    - [ ] 0001 — layered + feature-first hybride
    - [ ] 0002 — Zustand single store + per-module contexts (justifie ARCH-03)
    - [ ] 0003 — frontière snake_case / camelCase JSON ([`api.md`](./api.md) API-01)
    - [ ] 0004 — pas de TanStack Query (pour l'instant)
    - [ ] 0005 — pas de SSR (E2EE-driven)
- **Effort** : M (~3-4h pour les 5 premiers ADR)
- **Risque** : aucun
- **Dépendances** : aucune

### ARCH-03 — `nodea-store` (414 LOC) : single store qui mélange ~7 slices distinctes

- **Type** : abstraction / cohérence
- **Sévérité** : faible
- **Subjectivité** : élevée
- **Zone concernée** : [`packages/web/src/core/store/nodea-store.ts`](../../packages/web/src/core/store/nodea-store.ts)
- **Description** : un seul store Zustand contient (au moins) — la session user, l'état de la clé maîtresse (`mainKey`), l'état UI (`mobileMenuOpen`, `composer.open`), les modules hydratés, le module courant (`currentModule`), les préférences, le thème, le `goalsVersion` cache-bust. ~7 slices empilées dans 414 LOC. Les slices sont nommés et séparés visuellement, mais ils vivent dans le même store.
- **Pourquoi c'est un problème concret** : Zustand permet le pattern « slices » via `combine()` ou des stores séparés. Un seul big store **rend les test unitaires plus lourds** (il faut snapshot + restore le store complet). Mais en pratique, les selectors sont disciplinés (`selectMainKey`, `selectModules`, etc.) et le pattern marche. **Subjectif.**
- **Tâches**
  - [ ] **Décision** : laisser tel quel ou splitter ?
  - [ ] **Si décision « garder »** : documenter dans un ADR (cf. ARCH-02 0002) la raison, et **fermer ce finding**.
  - [ ] **Si décision « splitter »** : créer `core/store/{session,ui,modules,theme}.ts` séparés. **Risque élevé** : cohérence cross-store (logout, key-missing).
- **Effort** : N/A si on garde, L si on splitte (~1 jour)
- **Risque** : moyen-élevé si splitté
- **Dépendances** : aucune
- **Recommandation** : **garder + ADR.**

### ARCH-04 — `core/api/` : 14 fichiers thin wrappers — over-organized ou bien ?

- **Type** : abstraction / organisation
- **Sévérité** : faible
- **Subjectivité** : élevée
- **Zone concernée** : [`packages/web/src/core/api/`](../../packages/web/src/core/api/) — `client.ts`, `internal.ts`, `auth.ts`, `mfa.ts`, `passkeys.ts`, `totp.ts`, `security-mode.ts`, `library.ts`, `admin.ts`, `storage.ts`, `modules-config-client.ts`, `preferences-client.ts`, `error-message.ts`, `modules/{collection-client,goals,habits,library,mood,passage,review}.ts`
- **Description** : 14 fichiers + 7 sous-fichiers `modules/`, soit ~21 fichiers pour le client API. La majorité font 4-25 LOC (thin wrappers). C'est volontaire — `client.ts` documente que les fichiers restent < 200-300 LOC.
- **Pourquoi c'est un problème concret** : sur le coût d'ajout d'un appel API : faible. Sur la lisibilité : positive (chaque fichier = un domain). **Subjectif.**
- **Tâches**
  - [ ] Ne rien toucher — c'est cohérent, documenté en barrel re-export, et chaque fichier est lisible.
  - [ ] Si plus tard l'API se met à OpenAPI + client généré (cf. [`api.md`](./api.md) API-11), tout ça disparaît automatiquement.
- **Effort** : N/A
- **Risque** : N/A
- **Recommandation** : **NE PAS toucher.**

### ARCH-05 — Branded types réservés au crypto, pas aux IDs métier

- **Type** : typage
- **Sévérité** : faible
- **Subjectivité** : moyenne
- **Zone concernée** : [`packages/shared/src/crypto-types.ts`](../../packages/shared/src/crypto-types.ts) (les brands existants)
- **Description** : CLAUDE.md exige des branded types pour le crypto et c'est appliqué. Mais les **identifiants métier** (`userId`, `sessionId`, `moduleUserId`, `entryId`, `inviteId`) sont tous des `string` plats. Rien n'empêche techniquement de passer un `inviteId` là où on attend un `userId`.
- **Pourquoi c'est un problème concret** : faible probabilité d'erreur en pratique parce que les noms de variables sont disciplinés. Mais lors d'un refactor (changer la signature d'une fonction qui prend 3 IDs), TS ne te protège pas.
- **Tâches**
  - [ ] **Décisionnel** : ajouter dans `@nodea/shared/branded-ids.ts` une dizaine de brands (`UserId`, `SessionId`, `ModuleUserId`, `EntryId`, `InviteId`, `AnnouncementId`...).
  - [ ] Migration via `as UserId` aux frontières du système (route handlers).
- **Effort** : M (~1 jour pour la migration full)
- **Risque** : faible (casse rien en runtime)
- **Dépendances** : aucune
- **Recommandation** : option qui paie quand le projet grossit. Aujourd'hui, le ratio coût-bénéfice est borderline.

### ARCH-06 — Layout email mélange 3 concerns : rendu, config, i18n

- **Type** : couplage
- **Sévérité** : faible
- **Subjectivité** : moyenne
- **Zone concernée** : [`packages/api/src/services/email/templates/layout.ts`](../../packages/api/src/services/email/templates/layout.ts)
- **Description** : `renderLayout()` mélange aujourd'hui (1) **rendering HTML/text** (concern principal), (2) **lecture de config** (`getConfig().WEB_BASE_URL` pour le logo), (3) **i18n** (`emailT(language, 'layout.*')`). Ce n'est pas un problème en soi — c'est une fonction de **template** qui orchestre les données pour produire un email. Mais le couplage à `getConfig()` (singleton process-wide) la rend non-testable de façon isolée.
- **Pourquoi c'est un problème concret** : un test unitaire de `renderLayout()` exige `getConfig()` initialisé → le test devient un test d'intégration. Pour 1 fonction, OK. Si d'autres parties du `services/email/` se mettent à lire `getConfig()` directement, on a un coupling diffus à l'environnement.
- **Tâches**
  - [ ] **Option A (légère)** : passer `webBaseUrl` en argument de `renderLayout({ ..., webBaseUrl })`. Le caller (les fonctions `renderXxxEmail()`) le lit depuis `getConfig()` et le passe.
  - [ ] **Option B (plus lourde)** : injection — un objet `EmailContext = { webBaseUrl, language, t }` passé à toutes les templates.
- **Effort** : S (~30 min pour A)
- **Risque** : faible
- **Dépendances** : aucune

### ARCH-07 — 6 roadmaps actives — fragmentation du tracking

- **Type** : organisation / dette de process
- **Sévérité** : moyenne
- **Subjectivité** : moyenne
- **Zone concernée** : [`docs/roadmap/`](./) — `refacto.md`, `security.md`, `api.md`, `frontend.md`, `architecture.md`, `ops.md` + [`docs/recommendations/server-config.md`](../recommendations/server-config.md). Soit **6 roadmaps actives + 1 doc de recos serveur**. Les anciennes `health.md` et `i18n.md` ont été livrées et retirées.
- **Description** : 6 roadmaps actives + 1 doc de recos serveur (post-livraison de `health.md` et `i18n.md`), ~3500 lignes cumulées, ~80 chantiers identifiés. Chaque audit a généré sa roadmap propre. C'est une grande quantité de dette **rendue visible** — bon signe sur la conscience du projet. Mais c'est aussi un coût de maintenance.
- **Pourquoi c'est un problème concret** : pour décider *« qu'est-ce qu'on fait cette semaine »*, il faut consulter 7 fichiers, recouper les dépendances (e.g., `frontend.md` FRONT-02 dépend de `api.md` API-08, ARCH-01 chevauche `refacto.md` REFACTO-06), et reconstituer un plan unifié.
- **Tâches**
  - [ ] **Option A (recommandée)** : créer `docs/roadmap/INDEX.md` qui liste les 6 roadmaps actives + le doc `docs/recommendations/server-config.md` + un *« Top 10 cross-cutting cette semaine »* qui pointe vers les findings concrets.
  - [ ] **Option B** : fusionner en 1 roadmap géante. **Mauvaise idée** — les périmètres sont vraiment différents.
  - [ ] **Option C (long terme)** : quand une roadmap est livrée à >80 %, la retirer de `docs/roadmap/` (convention déjà appliquée pour `health.md` et `i18n.md`). Les findings résiduels qui survivent à la roadmap parent peuvent être collectés dans une nouvelle roadmap *« reliquat »* si nécessaire.
- **Effort** : S (~1h pour `INDEX.md`)
- **Risque** : aucun
- **Dépendances** : aucune
- **Recommandation** : Option A.

### ARCH-08 — Logique métier dans `auth/*` — frontière domaine pas explicite

- **Type** : séparation des responsabilités
- **Sévérité** : faible
- **Subjectivité** : élevée
- **Zone concernée** : [`packages/api/src/auth/`](../../packages/api/src/auth/) — 16 fichiers
- **Description** : `auth/` contient à la fois (1) des **services d'application** (les flows OPAQUE, MFA, recovery), (2) des **utilitaires de domaine** (calculs de policy, vérifs constant-time), et (3) des **adapters infra** (mailer, in-memory state stores `*-state.ts`). En clean architecture stricte, ces trois couches devraient être séparées. Ici elles vivent ensemble.
- **Pourquoi c'est un problème concret** : faible. Le projet n'est pas en clean architecture, et la plupart des helpers `auth/*` sont co-utilisés. Splitter en `auth/{services,domain,infra}/` créerait des imports en plus sans gain de testabilité réelle. **C'est une préférence de style.**
- **Tâches**
  - [ ] Ne rien toucher.
  - [ ] Si à terme une feature a besoin d'isoler une couche (ex : tester `mfa-policy` sans toucher à la DB), extraire ce qui est nécessaire à ce moment-là.
- **Effort** : N/A
- **Risque** : N/A
- **Recommandation** : **NE PAS toucher.**

### ARCH-09 — `lookup/` côté API : feature-isolated dans une organisation layered

- **Type** : organisation
- **Sévérité** : faible
- **Subjectivité** : élevée
- **Zone concernée** : [`packages/api/src/lookup/`](../../packages/api/src/lookup/) — 12 fichiers
- **Description** : `lookup/` est conceptuellement **du code Library côté serveur** — enrichissement de métadonnées de livres pour le module Library. Mais il vit en racine de `packages/api/src/` au même niveau que `auth/`, `routes/`, `services/`, `middleware/`. C'est la seule feature qui a son propre dossier domaine côté API.
- **Pourquoi c'est un problème concret** : faible. `lookup/` est volumineux et a une logique interne riche. Isoler tout ça dans un dossier dédié **est défendable** — fusionner dans `services/library/` serait possible mais ne ferait pas baisser la complexité.
- **Tâches**
  - [ ] Ne rien toucher — c'est cohérent.
- **Effort** : N/A
- **Risque** : N/A
- **Recommandation** : **NE PAS toucher.**

### ARCH-10 — Phases de migration commit-trackées : signal positif mais à clore

- **Type** : dette structurelle
- **Sévérité** : faible
- **Subjectivité** : faible
- **Zone concernée** : commentaires `Phase N`, `Tier X` partout dans le code (~50+ fichiers)
- **Description** : ~50+ fichiers contiennent des références à des phases (`Phase 1 of Auth-Roadmap`, `Phase 2C`, `Phase 4`, `module-refacto Tier B`, `factoring-audit`, `Tier 5 i18n`...). C'est positif — la trajectoire est tracée. Mais il commence à y avoir des phases **closes** dont les références dans le code n'ont jamais été nettoyées.
- **Pourquoi c'est un problème concret** : un·e contributeur·ice qui voit *« Phase 2C »* en commentaire peut perdre 5 minutes à chercher dans le code ou les commits ce qu'était la Phase 2C exactement. C'est de la **dette de cleanup** post-migration.
- **Tâches**
  - [ ] Faire un sweep avec `grep -rn "Phase [0-9]\|Tier [A-Z0-9]" packages/ docs/`.
  - [ ] Pour chaque référence : soit la retirer (si elle n'apporte plus rien), soit la garder en remplaçant *« Phase 2C »* par *« post-OPAQUE migration (Phase 2C, livré au commit `xxxxxxx`) »*.
- **Effort** : M (~2h sweep + tri)
- **Risque** : faible
- **Dépendances** : aucune

### ARCH-11 — Frontière `lib/` (web) vs `core/utils/` (web) non claire

- **Type** : organisation
- **Sévérité** : faible
- **Subjectivité** : moyenne
- **Zone concernée** : [`packages/web/src/lib/`](../../packages/web/src/lib/) (2 fichiers) et [`packages/web/src/core/utils/`](../../packages/web/src/core/utils/)
- **Description** : déjà identifié dans [`refacto.md`](./refacto.md) REFACTO-11. Pour cet audit, c'est une **incohérence d'intention** : pourquoi `cn()` (utility helper) vit dans `lib/utils.ts` plutôt que dans `core/utils/` ? Pas de raison documentée.
- **Pourquoi c'est un problème concret** : sur l'ajout d'un nouveau helper utility, le contributor doit choisir : `lib/` ou `core/utils/` ? Sans règle, le choix est arbitraire et l'incohérence s'auto-renforce.
- **Tâches**
  - [ ] Voir [`refacto.md`](./refacto.md) REFACTO-11 — fusionner `lib/` dans `core/utils/`.
- **Effort** : S (cf. refacto)
- **Risque** : faible
- **Dépendances** : suit REFACTO-11

### ARCH-12 — Pas de validation runtime côté client des réponses API

- **Type** : typage / contrats
- **Sévérité** : moyenne
- **Subjectivité** : faible
- **Zone concernée** : [`packages/web/src/core/api/internal.ts:request()`](../../packages/web/src/core/api/internal.ts), tous les call-sites
- **Description** : le client web fait `request<T>(...)` qui renvoie `Promise<T>` mais **ne valide pas runtime** que la réponse matche `T`. Si le serveur renvoie un shape différent (régression côté API non rattrapée par TS), le client crashera plus tard à un endroit imprévisible (ex : `user.email.toLowerCase()` sur un `null`).
- **Pourquoi c'est un problème concret** : couplé à [`api.md`](./api.md) API-11 (~50 % des routes n'ont pas de `*ResponseSchema`), les contrats serveur peuvent dériver sans rien rattraper côté client. Un test e2e attraperait, mais en local, un dev voit `TypeError: Cannot read properties of null` au lieu de *« le serveur a renvoyé un shape inattendu »*.
- **Tâches**
  - [ ] **Court terme** : pour les routes critiques (login, register, /me), parser la réponse via Zod côté client : `LoginResponseSchema.parse(await res.json())`. Throw un `SchemaError` clair si dérive.
  - [ ] **Long terme** : générer un client typé depuis OpenAPI (cf. [`api.md`](./api.md) API-11) qui fait ça automatiquement.
- **Effort** : M (~3h pour les routes critiques)
- **Risque** : faible
- **Dépendances** : [`api.md`](./api.md) API-11 (Zod ResponseSchema manquants)

### ARCH-13 — Convention « commentaire-en-tête de fichier » très tenue — à conserver

- **Type** : documentation (point fort)
- **Sévérité** : N/A — positif
- **Subjectivité** : faible
- **Zone concernée** : ~80 % des fichiers non-triviaux
- **Description** : la majorité des fichiers de plus de 50 LOC commencent par un commentaire JSDoc qui explique : (1) ce que fait le fichier, (2) son **placement architectural**, (3) les **décisions assumées**. C'est rare et précieux. Le commentaire de `requireGuard` (39 lignes pour un middleware de 30) est exemplaire.
- **Pourquoi c'est un point fort** : sans ces commentaires, comprendre *« pourquoi `auth/` contient un fichier `opaque-login-state.ts` »* nécessite git-blame + lecture transversale. Avec, c'est 5 secondes.
- **Tâches**
  - [ ] **Conserver et codifier** dans `CLAUDE.md` — *« tout fichier > 50 LOC doit commencer par un commentaire JSDoc qui explique son rôle, son placement, et les décisions non-évidentes ».*
  - [ ] **Optionnel** : ajouter une règle ESLint `jsdoc/require-file-overview` qui le force.
- **Effort** : S (~30 min pour la règle CLAUDE.md)
- **Risque** : aucun
- **Dépendances** : aucune

### ARCH-14 — Code mort dans `ui/atoms/` (déjà tracké)

- **Type** : dette structurelle
- **Sévérité** : moyenne (mais déjà tracké)
- **Subjectivité** : faible
- **Zone concernée** : voir [`refacto.md`](./refacto.md) REFACTO-09
- **Description** : 20 fichiers dans `ui/atoms/` ont 0 import. **Cross-référencé, pas dupliqué.**
- **Tâches** : voir [`refacto.md`](./refacto.md) REFACTO-09.

### ARCH-15 — Émergence d'un système i18n côté API (à surveiller, pas à fixer)

- **Type** : couplage
- **Sévérité** : faible
- **Subjectivité** : moyenne
- **Zone concernée** : [`packages/api/src/services/email/i18n.ts`](../../packages/api/src/services/email/i18n.ts)
- **Description** : émergence (Tier 5) d'un système i18n côté serveur dédié aux emails — `emailT(language, key)` + `SupportedEmailLanguage`. Bonne séparation : les emails ont leur i18n, distincte de celle du web. Mais à surveiller : si d'autres routes API se mettent à émettre des messages user-facing (notifications, log-as-display), elles devront passer par cette infra ou en inventer une autre.
- **Pourquoi c'est à surveiller** : pour l'instant, **l'API est stateless et sans messages user-facing** (les codes d'erreur sont des slugs `snake_case` traduits côté front via `error-message.ts`). Les emails sont la seule exception.
- **Tâches**
  - [ ] Surveiller. Si un autre besoin i18n côté API émerge, **élargir `services/email/i18n.ts` en `services/i18n.ts` global** plutôt qu'en inventer un autre.
- **Effort** : N/A (préventif)
- **Risque** : N/A
- **Dépendances** : aucune

### ARCH-16 — `getConfig()` global singleton — pattern courant mais à conscience

- **Type** : couplage / configuration
- **Sévérité** : faible
- **Subjectivité** : élevée
- **Zone concernée** : [`packages/api/src/config.ts:getConfig()`](../../packages/api/src/config.ts)
- **Description** : la config est un module-level singleton. Tout module qui en a besoin l'importe directement. Pas de DI. Pattern courant et lisible, mais **couplage implicit à l'environnement** — chaque module devient légèrement plus difficile à tester en isolation.
- **Pourquoi c'est un problème concret** : faible. Les tests vitest qui en ont besoin font `process.env.X = '...'` dans `beforeEach`. C'est gérable.
- **Tâches**
  - [ ] **Garder.** Migrer vers DI exigerait toucher quasi tous les modules api. Pas un bon ROI.
- **Effort** : N/A
- **Risque** : N/A
- **Recommandation** : **NE PAS toucher.**

### ARCH-17 — Pas de migrations DB *« down »*

- **Type** : dette structurelle
- **Sévérité** : faible
- **Subjectivité** : faible
- **Zone concernée** : [`packages/api/drizzle/`](../../packages/api/drizzle/)
- **Description** : les migrations Drizzle existent en *« up »* (à appliquer) mais pas en *« down »* (rollback). Drizzle Kit ne génère pas de down par défaut. Pour une app self-hostable où un opérateur peut vouloir rollback en cas de problème, c'est un trou.
- **Pourquoi c'est un problème concret** : si une migration échoue à mi-parcours en prod, l'opérateur n'a pas d'outil pour revenir à l'état précédent à part `pg_restore` depuis backup. Pour un projet à un opérateur unique, c'est gérable. Pour passer à plus, c'est un risque.
- **Tâches**
  - [ ] **Décisionnel** : (a) écrire les downs à la main pour chaque migration future + une règle dans `CLAUDE.md` qui le force, soit (b) accepter que le rollback de schema = restore from backup, et le documenter comme tel.
- **Effort** : N/A pour décision, M pour migrer les downs existantes
- **Risque** : faible
- **Dépendances** : aucune

---

## Récap par type × sévérité

| Type | Critique | Élevée | Moyenne | Faible |
|---|---|---|---|---|
| Cohérence (doc-vs-code) | — | — | ARCH-01 | — |
| Documentation | — | — | ARCH-07 | ARCH-02 |
| Abstraction | — | — | — | ARCH-03, ARCH-04 |
| Typage | — | — | ARCH-12 | ARCH-05 |
| Couplage | — | — | — | ARCH-06, ARCH-15 |
| Organisation | — | — | — | ARCH-08, ARCH-09, ARCH-11 |
| Dette structurelle | — | — | ARCH-14 | ARCH-10, ARCH-17 |
| Configuration | — | — | — | ARCH-16 |
| Documentation (point fort) | — | — | — | ARCH-13 (positif) |

**0 critique, 0 élevée, 4 moyennes, 13 faibles + 1 positif.**

---

## Top 5 dettes structurelles à traiter (ratio impact / effort)

1. **ARCH-01** — Restructurer CLAUDE.md en blocs *« actuel »* / *« cible »* (1h, gain énorme pour onboarding).
2. **ARCH-12** — Validation Zod runtime sur les routes critiques côté client (3h, attrape les drifts API silencieux).
3. **ARCH-07** — `docs/roadmap/INDEX.md` qui pointe vers les 6 roadmaps + le doc de recos serveur + top cross-cutting (1h, simplifie la coordination).
4. **ARCH-14** — Purge `ui/atoms/` du code mort (cf. [`refacto.md`](./refacto.md) REFACTO-09 — 30 min, ~1000 LOC mortes).
5. **ARCH-10** — Sweep des références *« Phase N »* / *« Tier X »* livrées (2h, allège la charge cognitive).

---

## Refontes lourdes à envisager (avec ce qu'on perd)

| Refonte | Description | Coût | Ce qu'on PERD | Recommandation |
|---|---|---|---|---|
| **Migrer le data-fetching vers TanStack Query** | Remplace les 4 contextes de modules par TanStack Query + hooks `useGoals()` | ~5 jours dev (cf. [`frontend.md`](./frontend.md) FRONT-13) | Vélocité court terme, cohérence pendant la transition (1-2 semaines code parallèle), risque modéré sur les flows optimistic + rollback | **À envisager** seulement si une vraie limite des contextes émerge (race conditions visibles ou besoin de cache cross-page) |
| **OpenAPI + client typé généré** | Cf. [`api.md`](./api.md) API-11. Génère un SDK TS + Swift/Kotlin si besoin | ~3-5 jours pour OpenAPI, +1-2 pour le générateur | Cohérence pendant transition (Zod ResponseSchema manquants à ajouter d'abord) | **Avant** d'ouvrir un mobile / SDK partenaire |
| **Splitter `nodea-store` en 4 stores** | Cf. ARCH-03 Option B | ~1 jour | Cohérence cross-store (logout, key-missing) demande coordination explicite | **NE PAS LE FAIRE** — le store actuel marche, le coût ne vaut pas le bénéfice |
| **Réorg `auth/` en services + domain + infra** | Cf. ARCH-08 | ~1 jour | Cohérence (tout ce qui touche à l'auth vivait au même endroit), 50 imports à changer | **NE PAS LE FAIRE** — domaine pas assez complexe |

---

## Ce qui est sain et mérite d'être préservé / étendu

- **`createCollectionRoutes` factory** — 1 source de vérité pour les 4 routes CRUD chiffrées, impossible d'oublier le `requireGuard`. Pattern à promouvoir comme exemple dans CLAUDE.md.
- **`createModuleContexts<D, F, A>` factory** — pattern Provider + 3 hooks avec moins de boilerplate. Étendre à Habits/Review quand ils s'enrichissent.
- **Schémas Zod centralisés dans `@nodea/shared/`** — 127 imports, frontière proprement tenue.
- **Commentaires-en-tête de fichier denses** — ARCH-13. À codifier comme convention obligatoire dans CLAUDE.md.
- **`{ error: snake_case_code }`** — convention d'erreur uniforme sur 67 routes.
- **Strict TS + 0 `:any`** — discipline TS exemplaire pour la taille du projet.
- **Migration awareness** (commentaires Phase N) — pattern à conserver pour les futures migrations, juste à nettoyer après livraison (ARCH-10).
- **Roadmaps explicites** — la dette est rendue visible et traitable. Le seul ajustement à faire est l'`INDEX.md` (ARCH-07).

---

## Ce que je recommande de **NE PAS toucher** malgré l'apparence

| Cible | Pourquoi |
|---|---|
| **`nodea-store` 414 LOC mono-store** | Marche, selectors disciplinés, splitter coûte plus qu'il rapporte (ARCH-03). |
| **`auth/` 16 fichiers en bulk** | Les helpers se réfèrent les uns aux autres, splitter en sous-couches n'apporterait que des imports en plus (ARCH-08). |
| **`lookup/` en racine `api/src/`** | Volume riche (12 fichiers), domaine bien isolé (ARCH-09). |
| **`core/api/` 14 thin wrappers** | Cohérent, lisible, et ça disparaîtra automatiquement si l'OpenAPI client est généré un jour (ARCH-04). |
| **Frontière snake_case / camelCase JSON** | Documentée par les commentaires (« preserved PocketBase heritage »). À documenter dans `documentation/API.md` ([`api.md`](./api.md) API-01) mais **pas à migrer** sans plan de versioning. |
| **`getConfig()` singleton** | Standard. Migrer vers DI = surcoût qui n'achète rien en pratique (ARCH-16). |

---

## Sequencing recommandé

```
Semaine 1 (quick wins doc + clarté, ~5h cumulées)
  ├─ ARCH-01    (CLAUDE.md actuel vs cible)
  ├─ ARCH-07    (INDEX.md pour les roadmaps)
  ├─ ARCH-13    (codifier convention commentaire-en-tête)
  └─ ARCH-14    (cf. refacto.md REFACTO-09 — purge ui/atoms)

Semaine 2 (consolidation)
  ├─ ARCH-02    (créer docs/adr/ + 5 premiers ADR)
  ├─ ARCH-10    (sweep des Phase N livrées)
  └─ ARCH-12    (validation Zod runtime sur routes critiques)

Plus tard (à pondérer)
  ├─ ARCH-05    (branded types pour IDs métier — quand projet grossit)
  ├─ ARCH-06    (découpler renderLayout de getConfig — si tests unitaires demandés)
  ├─ ARCH-17    (migrations down — quand passe à plusieurs opérateurs)
  └─ Décisions à figer en ADR : ARCH-03, ARCH-04, ARCH-08, ARCH-09, ARCH-11, ARCH-15, ARCH-16
```

**Total effort cumulé** : ~2-3 jours dev pour Tier 1 + 2.

---

## Décisions à figer (à formaliser en ADR)

| Décision | Options | ADR proposé |
|---|---|---|
| `nodea-store` mono ou splitté ? | Garder (ARCH-03) / Splitter | ADR 0002 — préfère « garder + ADR explicite » |
| Layered + feature-first hybride assumé ? | Documenter / Migrer vers full-feature | ADR 0001 — préfère « documenter » |
| TanStack Query : non-now ou jamais ? | Pas maintenant (faute de contexte changeant) / Jamais (philosophie) | ADR 0004 — préfère « non-now » |
| `hc<AppType>` Hono RPC client : pourquoi pas ? | Préférence / Limite technique | ADR 0003 — documenter la décision réelle |
| Pas de SSR | E2EE rend SSR inutile / autre raison | ADR 0005 |
| Migrations DB : down ou pas ? | Pas de down, restore from backup / down obligatoire | ARCH-17 — décision à figer |
| `getConfig()` singleton ou DI ? | Singleton (actuel) / DI explicite | ARCH-16 — préfère « singleton + ADR » |

---

## Angles morts

Ce qui demanderait de connaître l'historique, l'équipe, ou les contraintes business :

1. **Pourquoi pas de SSR / Next.js** — décision pertinente dans le contexte E2EE (le serveur ne peut pas pré-render le contenu chiffré). Sans connaître l'historique, je le déduis ; un ADR le figerait.
2. **Pourquoi pas de TanStack Query** — vraiment un choix conscient de simplicité ou un *« on n'a pas eu le temps »* ? CLAUDE.md mentionne TanStack Query comme cible, ce qui suggère plutôt le second.
3. **Plan d'évolution mobile / SDK** — si c'est planifié à 6 mois, ARCH-12 + [`api.md`](./api.md) API-10 (versioning) deviennent prioritaires.
4. **Stratégie de release** — les phases (`Phase 2C`, `Tier 5`...) suggèrent une cadence. Pas vu de `CHANGELOG.md`.
5. **Scaling cible** — single instance self-host vs SaaS multi-tenant ? Change l'évaluation de plusieurs findings (ARCH-17 migrations down, [`frontend.md`](./frontend.md) FRONT-02 pagination).
6. **Contraintes performance acceptables** — pas de SLA, pas de SLO documentés. Pour l'instant *« ça marche »* est l'étalon.

---

## Comment cocher

- À chaque PR qui livre un fix, cocher les `[ ]` correspondants.
- Quand toutes les tâches d'un finding sont cochées, ajouter `— résolu (commit `xxxxxxx`)` à côté du titre.
- Quand un finding est résolu par une **décision documentée en ADR** (et pas par un fix code), pointer l'ADR dans le titre du finding : *« — figé en ADR 0002 »*.
- Quand toute la roadmap est livrée, retirer le fichier de `docs/roadmap/` (convention du repo : les roadmaps sont des artefacts temporaires qui disparaissent quand leur travail est fait — comme `i18n.md` et `health.md` retirés post-livraison).
