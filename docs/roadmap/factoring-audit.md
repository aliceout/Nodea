# App-wide factoring audit

> **Statut** : audit posé après la clôture du chantier
> `module-refacto` (Library + Goals + Journal + Mood). Liste les
> fichiers et patterns qui dépassent encore le plafond 200–300
> LOC ou qui dupliquent de la logique entre modules.
>
> **Mise à jour** : à chaque PR qui livre une étape, cocher la
> case correspondante.

Inventaire mené en lisant les fichiers les plus lourds du repo
(`wc -l | sort -rn`) puis en cherchant les duplications visibles
côté `flow/`, `pages/`, `ui/`, `api/`. Les chiffres en LOC
correspondent à l'état au commit qui livre cet audit.

---

## Tier 1 — appliquer le même refacto que `module-refacto`

Mêmes symptômes (gros `index.tsx` monolithique, hooks de fetch
inlinés, types Lite redondants) → mêmes remèdes (5 commits :
lib/ + tests, context provider, components/, views/, orchestrator
≤ 100 LOC). On a déjà la recette ; le coût est mécanique.

### Homepage — 858 LOC → ~12 fichiers

[`packages/web/src/app/flow/Homepage/index.tsx`](../../packages/web/src/app/flow/Homepage/index.tsx)
porte 11 composants inline (`PrimaryColumn`, `ToSeeList`,
`RecentPassage`, `SideColumn`, `MoodBlock`, `HabitsBlock`,
`IntentionsBlock`, `ReadingBlock`, `SectionLabel` + 3 hooks de
fetch + 4 helpers).

- [x] **Helpers purs** (`preferredName`, `firstThread`,
       `formatTimeFromIso`, `signedScore`, `formatMoodAvg`,
       `toIsoDate`) → `Homepage/lib/format.ts`. Le cousinage de
       `firstThread` avec `splitThreads(...)[0]` est documenté
       dans la JSDoc ; la promotion vers `packages/shared` reste
       en Tier 3.
- [x] **`MOOD_VALID_SCORES` / `GOAL_VALID_STATUS`** sont passés
       en privés dans `lib/projections.ts` (à côté de la logique
       de projection record → Lite). Tests Vitest sur les trois
       projections en couvrent la déduplication / le filtrage.
- [x] **Constantes UI** (`MOOD_FRISE_DAYS`, `MOOD_BLOCK_FILL`,
       `STATUS_TONE`, `STATUS_LABEL`, `HOME_GOAL_LIMIT`,
       `MOCK_TASKS`) → `Homepage/lib/constants.ts`.
- [x] **Logique métier** : `buildMoodFrise` /
       `summariseMoodFrise` (`lib/frise.ts`) et `pickHomeGoals`
       (`lib/intentions.ts`) avec leurs Vitest. Les `useMemo` côté
       blocks sont devenus de simples appels mémoïsés.
- [x] **Lite types** (`MoodEntryLite`, `GoalEntryLite`,
       `GoalStatusLite`, `LibraryReadingLite`, `MoodFriseCell`,
       `MoodFriseStats`, `MockTask`) → `Homepage/lib/types.ts`.
       Le passage à `Pick<MoodEntry, …>` reste pour Tier 3.
- [x] **`useMoodEntries` / `useGoalEntries` / `useLibraryReadings`**
       — 3 hooks de fetch inlinés, fondus dans le
       `HomepageProvider` (`context.tsx`). Le wiring lifecycle
       (`useEffect` / `useState`) est désormais centralisé ; les
       projections record → Lite vivent dans `lib/projections.ts`
       et sont testées sans React.
- [x] **6 blocks visuels** (`MoodBlock`, `HabitsBlock`,
       `IntentionsBlock`, `ReadingBlock`, `ToSeeList`,
       `RecentPassage`) → `Homepage/components/` (un fichier par
       bloc), tous propless et lisant directement le contexte
       Homepage. `SectionLabel` co-localisé en
       `components/SectionLabel.tsx`. `ToSeeList` reste la
       feuille la plus lourde (154 LOC) ; les autres ≤ 80.
- [x] **Single context** : `HomepageDataContext` expose
       `displayName`, `formattedDate`, `mood`, `goals`,
       `readings` ; `useHomepageData()` y accède. Le pattern
       « 3 contextes » n'a pas été instancié (Home reste
       read-only).
- [x] **`index.tsx` final ≤ 100 LOC** : 77 LOC livrés (provider
       wrapper + `HomepageView` qui lit la date d'entête + dispatch
       sur `<PrimaryColumn />` / `<SideColumn />`).

### Account — 949 LOC → ~10 fichiers

[`packages/web/src/app/flow/Account/index.tsx`](../../packages/web/src/app/flow/Account/index.tsx)
porte 6 onglets inline (`IdentityTab`, `SecurityTab`,
`PreferencesTab`, `ModulesTab`, `DataTab`, `DangerTab`) + des
sous-blocks (`Stats`, `IdentityRow`, `DescribedSection`,
`ExportPanel`, `ImportPanel`, `Field`, `Feedback`).

- [ ] **6 onglets** → `Account/views/` (un fichier par onglet).
       L'`Account/index.tsx` garde uniquement le tab dispatch.
- [ ] **Sous-blocks réutilisables** (`Field`, `Feedback`,
       `DescribedSection`, `IdentityRow`) → `Account/components/`.
- [ ] **`Stats`** + ses `StatRow` → `Account/components/Stats.tsx`.
- [ ] **`ExportPanel` / `ImportPanel`** vivent dans le `DataTab` ;
       à co-localiser dans le même fichier que la vue ou à sortir
       dans `Account/data/` selon leur taille (probablement ≥ 100
       LOC chacun).
- [ ] **Pure logic** (validation des inputs, transformation
       export / import) → `Account/lib/` avec tests Vitest sur les
       parsers / sérialiseurs.
- [ ] **`index.tsx` final ≤ 100 LOC**.

---

## Tier 2 — `ComposerModal` (3267 LOC, le mastodonte)

[`packages/web/src/ui/dirk/ComposerModal.tsx`](../../packages/web/src/ui/dirk/ComposerModal.tsx)
est le composant le plus gros du repo. C'est la modale unique
pour créer / éditer une entrée de chacun des 5 modules + un sous-
composant de lookup ISBN très lourd. **Le diviser est plus risqué
que le `flow/`** : tout passe par cette modale et un cassage UX
silencieux serait dur à repérer.

- [ ] **Split par body** : `ComposerModal/bodies/Mood.tsx`,
       `Goals.tsx`, `Journal.tsx`, `LibraryItem.tsx`,
       `LibraryReview.tsx`, `Simple.tsx`. Chaque body a sa
       propre fenêtre (220 LOC pour Mood, 360 LOC pour Goals, 300
       LOC pour Journal, **620 LOC pour LibraryItem**, 100 LOC
       pour LibraryReview).
- [ ] **`LookupBar`** + ses sous-pieces (`SearchButton`,
       `FilterRow`, `FilterChip`, `ProviderBadges`, `CoverGrid`)
       → `ComposerModal/lookup/` (≥ 700 LOC, ses propres
       constantes `SEARCH_LANGUAGES`, `PROVIDER_LABEL`,
       `PROVIDER_ORDER`, `FORMAT_LABEL`, helpers `countBy`,
       `shortLang`, `normaliseAuthorName`).
- [ ] **Constantes** (`MONTH_OPTIONS`, `TYPE_OPTIONS`,
       `SCORE_LABELS`, `SIMPLE_PLACEHOLDERS`, `POSITIVE_PLACEHOLDERS`,
       `GOAL_STATUS_LABEL`, `GOAL_STATUS_ACTIVE_TONE`,
       `LIBRARY_*_LABEL`) → `ComposerModal/lib/constants.ts`.
       Plusieurs sont des duplications de `flow/<Module>/lib/
       constants.ts` (e.g. `SCORE_LABELS`, `GOAL_STATUS_LABEL`)
       — à importer plutôt qu'à redéclarer.
- [ ] **Type guards** (`isMoodScoreString`, `isCanonicalGoalStatus`)
       → `ComposerModal/lib/guards.ts`.
- [ ] **`MarkdownToggle`** → `ComposerModal/components/`.
       Probablement déjà réutilisable depuis ailleurs.
- [ ] **Tests** : avant de toucher la modale, écrire au moins un
       test integration léger qui ouvre chaque body et vérifie
       que le payload émis correspond à la Zod schema. Sans ça,
       le refacto va casser une saisie en silence.
- [ ] Plafond cible : aucune feuille `bodies/*.tsx` au-dessus de
       300 LOC. `LookupBar` peut tolérer 350 LOC car la logique
       d'orchestration multi-providers est tassée par nature.

---

## Tier 3 — duplication cross-modules

Petits gains, mais ils stoppent net la divergence quand quelqu'un
modifie une copie sans toucher l'autre.

- [ ] **`splitThreads`** vit en triple :
       [`flow/Goals/lib/threads.ts`](../../packages/web/src/app/flow/Goals/lib/threads.ts) ·
       [`flow/Journal/lib/threads.ts`](../../packages/web/src/app/flow/Journal/lib/threads.ts) ·
       cousin `firstThread` dans
       [`flow/Homepage/index.tsx`](../../packages/web/src/app/flow/Homepage/index.tsx).
       Les bodies des fonctions Goals / Journal sont **identiques
       au caractère près**. → promouvoir dans
       `packages/shared/src/threads.ts` et faire dériver
       `firstThread = (s) => splitThreads(s)[0] ?? null`. Tests
       cross-package via `@nodea/shared`.
- [ ] **Formatters de date FR** dispersés :
       [`flow/Mood/lib/date-format.ts`](../../packages/web/src/app/flow/Mood/lib/date-format.ts)
       (`ENTRY_SAME_YEAR_FMT`, `ENTRY_CROSS_YEAR_FMT`,
       `parseLocalDate`),
       [`flow/Journal/lib/date-format.ts`](../../packages/web/src/app/flow/Journal/lib/date-format.ts)
       (`formatEntryLabel`, `formatMonthLabel`),
       [`flow/Library/lib/review-format.ts`](../../packages/web/src/app/flow/Library/lib/review-format.ts),
       [`flow/Review/views/List.tsx`](../../packages/web/src/app/flow/Review/views/List.tsx),
       [`flow/Mood/lib/heatmap.ts`](../../packages/web/src/app/flow/Mood/lib/heatmap.ts).
       Chacun construit ses `Intl.DateTimeFormat('fr-FR', …)` en
       local. → factoriser dans `core/i18n/date-fr.ts` :
       `formatEntryLabel(iso, today)`, `formatMonthLabel(yyyymm)`,
       `parseLocalDate(iso)`, `toIsoDate(date)`. **Important** :
       garder le fix `parseLocalDate` (Mood) dedans, c'est lui qui
       répare le bug TZ.
- [ ] **Lite shapes Homepage** redondent
       [`flow/Goals/lib/types.ts`](../../packages/web/src/app/flow/Goals/lib/types.ts) /
       [`flow/Mood/lib/types.ts`](../../packages/web/src/app/flow/Mood/lib/types.ts) /
       [`flow/Library/lib/types.ts`](../../packages/web/src/app/flow/Library/lib/types.ts).
       Une fois Homepage refacto'ée, exporter les Lite via
       `Pick<MoodEntry, 'dateIso' | 'score' | 'createdAt'>` (et
       équivalents) plutôt que les redéclarer.
- [ ] **`VALID_SCORES` / `VALID_STATUS`** : Homepage redéclare des
       `Set` à partir des constantes `@nodea/shared` au lieu
       d'importer les validateurs des modules. Une fois Homepage
       passé en split, ces sets disparaissent au profit des
       imports `Mood/lib/mappers.ts`.
- [ ] **Pattern « 3 contextes »** identique sur Library / Goals /
       Journal / Mood (~80 LOC × 4 modules de boilerplate
       provider). À envisager une factory
       `createModuleContexts<Data, Filters, Actions>()` **seulement
       si** un 5e module en a besoin (Habits, Review). Sinon le
       coût d'abstraction n'est pas justifié.

---

## Tier 4 — pages d'auth publiques (≥ 500 LOC)

Pages publiques (`/login`, `/register`, `/recover`, `/totp`,
`/passkeys`) — jamais refacto'ées. Même pattern monolithique que
le `flow/`.

- [ ] [`pages/Totp.tsx`](../../packages/web/src/app/pages/Totp.tsx)
       — **909 LOC**. Page la plus lourde côté auth ; gère
       l'enrôlement TOTP + la vérification + les codes de
       récupération. À découper en `Totp/views/Setup.tsx` /
       `Verify.tsx` / `Recovery.tsx` + un provider d'état
       d'enrôlement.
- [ ] [`pages/Passkeys.tsx`](../../packages/web/src/app/pages/Passkeys.tsx)
       — **581 LOC**. Liste + enrolment + révocation. Split
       similaire à Account (un fichier par sous-vue).
- [ ] [`pages/Register.tsx`](../../packages/web/src/app/pages/Register.tsx)
       — **550 LOC**. Multi-step form (invite → mot de passe →
       phrase de récupération). Le formulaire en lui-même tient
       en ~250 LOC ; le reste est de la logique crypto et de la
       gestion de retours serveur. Sortir le pas-à-pas dans
       `Register/steps/`.
- [ ] [`pages/Recover.tsx`](../../packages/web/src/app/pages/Recover.tsx)
       — **539 LOC**. Multi-step (email → code → nouveau mot de
       passe). Même découpage que Register.
- [ ] [`pages/LoginMfa.tsx`](../../packages/web/src/app/pages/LoginMfa.tsx)
       — **461 LOC**. TOTP + passkey + bypass. À sortir les trois
       pistes dans des `views/` dédiés.

Note : ces pages n'ont **pas** besoin du pattern « 3 contextes »
puisqu'elles ne hostent qu'un seul flow vertical ; un provider
unique avec `useReducer` suffit pour le state machine.

---

## Tier 5 — routes API (≥ 500 LOC)

Le côté serveur a deux routes monolithiques. Moins prioritaire
côté UX (pas d'effet visible), mais idem côté maintenabilité.

- [ ] [`api/src/routes/auth.ts`](../../packages/api/src/routes/auth.ts)
       — **809 LOC**. Couvre login / logout / refresh / change-
       password / reauth. À sortir un fichier par groupe de
       handlers : `auth/login.ts`, `auth/refresh.ts`,
       `auth/change-password.ts`. La factorisation `auth-totp.ts`,
       `auth-mfa.ts`, `auth-recovery.ts` est déjà partiellement
       faite ; finir le découpage.
- [ ] [`api/src/routes/auth-passkey.ts`](../../packages/api/src/routes/auth-passkey.ts)
       — **800 LOC**. Enrôlement + auth + révocation des passkeys.
       Même découpage que auth.ts.
- [ ] [`api/src/lookup/dispatcher.ts`](../../packages/api/src/lookup/dispatcher.ts)
       — **568 LOC**. Orchestrateur ISBN multi-providers. Probable
       qu'une factory `provider-pipeline.ts` réduise le code à
       ~250 LOC en sortant la logique de fan-out.
- [ ] [`api/src/db/schema.ts`](../../packages/api/src/db/schema.ts)
       — **678 LOC**. Schéma Drizzle, normal qu'il soit gros mais
       le découper par domaine (`schema/users.ts`,
       `schema/modules.ts`, `schema/auth.ts`) faciliterait les
       migrations.

---

## Tier 6 — petites lignes

Bricoles repérées au passage, pas urgentes.

- [ ] [`web/src/core/auth/use-session.ts`](../../packages/web/src/core/auth/use-session.ts)
       — **1208 LOC**. Mono-fichier qui tient l'orchestration auth
       + les flows MFA + le bookkeeping de session. Difficile à
       toucher tant que les pages auth (Tier 4) ne sont pas
       refacto'ées ; à reprendre après.
- [ ] [`web/src/core/api/client.ts`](../../packages/web/src/core/api/client.ts)
       — **937 LOC**. Client Hono typé + helpers crypto +
       wrappers fetch. Probablement OK ; à inspecter si jamais on
       touche le routeur API.
- [ ] [`web/src/app/flow/Review/config/steps.ts`](../../packages/web/src/app/flow/Review/config/steps.ts)
       — **505 LOC**. Configuration déclarative ; peut tolérer la
       taille. Au-dessus de 600 LOC il faudra le splitter par
       review kind.
- [ ] **Plafond global** : viser ≤ 300 LOC pour tout fichier `.tsx`
       de feuille (composant, view, page d'auth simple). Les
       providers (`*Provider`) tolèrent ≤ 500 LOC par design,
       les schemas / configs ≤ 700 LOC.

---

## Comment cocher

À chaque PR qui livre une étape, ouvre ce fichier, coche la case,
commit le changement de doc dans le même PR. Quand un Tier est
entièrement coché, replier sa section ou la déplacer dans une
sous-rubrique « livré » en bas de page.

Référence d'implémentation pour les Tiers 1 et 2 : la roadmap
[`module-refacto.md`](module-refacto.md) et les commits Library
`fc45b07` → Mood `9197e19` sur la branche `refacto-design-v2`.
