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

## Tier 1 — appliquer le même refacto que `module-refacto` (livré)

Mêmes symptômes (gros `index.tsx` monolithique, hooks de fetch
inlinés, types Lite redondants) → mêmes remèdes (5 commits :
lib/ + tests, context provider, components/, views/, orchestrator
≤ 100 LOC). On a déjà la recette ; le coût est mécanique.

**Statut** : Homepage (858 → 77 LOC) et Account (949 → 68 LOC)
livrés. Tier 1 fermé.

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
       `MoodEntryLite` dérive maintenant de `MoodEntry` via
       `Pick<MoodEntry, 'dateIso' | 'score'> & { createdAt }`
       (Tier 3 fait). `GoalEntryLite` et `LibraryReadingLite`
       restent locaux : Goal a un `status` plus étroit que
       `CanonicalStatus` (un Pick élargirait l'union et
       laisserait fuir des `'active'` / `'archived'`) ; Library
       a un `author` qui est un join dérivé du `creators[]`
       filtré, pas un champ direct. Documenté dans la JSDoc.
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

### Account — 949 LOC → ~14 fichiers (livré)

État de départ : `index.tsx` portait 6 onglets inline
(`IdentityTab`, `SecurityTab`, `PreferencesTab`, `ModulesTab`,
`DataTab`, `DangerTab`) + des sous-blocks (`Stats`,
`IdentityRow`, `DescribedSection`, `ExportPanel`, `ImportPanel`,
`Field`, `Feedback`).

- [x] **6 onglets** → `Account/views/` (un fichier par onglet).
       `IdentityTab` reste la feuille la plus lourde (192 LOC) —
       sous le plafond 220. Les autres feuilles sont entre 14 et
       100 LOC.
- [x] **Sous-blocks réutilisables** (`Field`, `Feedback`,
       `DescribedSection`, `IdentityRow`) → `Account/components/`.
       Tous ≤ 79 LOC.
- [x] **`Stats`** + ses `StatRow` (co-localisés) →
       `Account/components/Stats.tsx`.
- [x] **`ExportPanel` / `ImportPanel`** sortis dans
       `Account/views/data/` (90 et 136 LOC). Le `DataTab` se
       contente de les composer.
- [x] **Pure logic** : `modeLabel(SecurityMode)` (`lib/security-
       mode.ts`) + 3 tests Vitest. La logique de parsing import
       est restée co-localisée dans `ImportPanel` parce qu'elle
       est entrelacée avec la résolution runtime des plugins ;
       l'extraire forcerait à dupliquer le wiring `pluginFor`.
- [x] **Pas de provider central** : chaque onglet garde son
       state local — le `key={tab}` re-mount du conteneur réinit-
       ialise volontairement les drafts en cours quand l'utilisat-
       eur·ice change d'onglet. Centraliser combattrait ce
       comportement.
- [x] **`index.tsx` final ≤ 100 LOC** : 68 LOC livrés (juste le
       Topbar + le `<Tabs>` + le dispatch sur la `Tab` union).

---

## Tier 2 — `ComposerModal` (livré)

**Statut** : 8 commits sur `refacto-design-v2`, 3267 → 106 LOC
sur l'orchestrateur. Validation manuelle entre chaque body
(par toi : ouvrir le composer, sauver une entrée, vérifier
que ça arrive bien dans la liste). 252 tests verts en
permanence.

Architecture livrée (cf.
[`packages/web/src/ui/dirk/ComposerModal/`](../../packages/web/src/ui/dirk/ComposerModal/)) :

- [x] **`lib/`** — `constants.ts` (toutes les labels +
       options), `guards.ts` (`isMoodScoreString`,
       `isCanonicalGoalStatus` + 11 tests Vitest), `format.ts`
       (`normaliseAuthorName`, `countBy`, `shortLang`,
       `submitOnCmdEnter` + 18 tests).
- [x] **`components/`** — `MarkdownToggle` (34 LOC),
       `Footer` (82), `ThreadSuggestInput` (169),
       `MarkdownEditor` (366, avec `ToolbarButton`
       co-located).
- [x] **`lookup/`** — `LookupBar` (308),
       `SearchButton` (126), `FilterRow` (88),
       `ProviderBadges` (52), `CoverGrid` (64).
- [x] **`bodies/`** — `Simple` (39), `Mood` (253),
       `Goal` (407), `Journal` (364),
       `LibraryReview` (161), `LibraryItem` (672).
- [x] **`index.tsx`** — 106 LOC : modal shell + TypePicker
       + body dispatch.

Plafonds tolérés (documentés dans la JSDoc des feuilles
concernées) :
  - `LookupBar` (308) — orchestration multi-providers, audit
    autorisait jusqu'à 350.
  - `Goal` (407) / `Journal` (364) — drafts + thread chips +
    image attachments tassent les 220 LOC ; sortir le draft
    logic en hooks est un follow-up identifié mais
    optionnel.
  - `LibraryItem` (672) — bibliographic record + ISBN lookup +
    cover preview + 11 form fields. Audit explicitement
    autorisait au-delà de 300.

Tests d'intégration : non écrits — l'audit en demandait un
en pré-requis, on a finalement validé chaque body
manuellement entre commits. Si on veut un filet de sécurité
durable, l'écrire maintenant que les bodies sont isolés
serait beaucoup plus simple qu'avant le refacto.

---

## Tier 3 — duplication cross-modules

Petits gains, mais ils stoppent net la divergence quand quelqu'un
modifie une copie sans toucher l'autre.

- [x] **`splitThreads`** vivait en triple ; promu dans
       [`packages/shared/src/threads.ts`](../../packages/shared/src/threads.ts)
       avec `firstThread` dérivé. Goals et Journal importent
       maintenant depuis `@nodea/shared` ; les copies locales
       sont supprimées (`git rm`). Tests consolidés dans
       [`packages/shared/src/threads.test.ts`](../../packages/shared/src/threads.test.ts)
       (9 cases). Le `vitest.config.ts` web pointe désormais aussi
       sur `../shared/src/**/*.test.ts` pour que le runner unique
       exerce le shared package sans infra dédiée.
- [x] **Formatters de date FR** centralisés dans
       [`core/i18n/date-fr.ts`](../../packages/web/src/core/i18n/date-fr.ts) :
       `parseLocalDate`, `toIsoDate`, `formatEntryLabel`,
       `formatMonthLabel`, `formatLongDate`. 18 tests Vitest dans
       [`core/i18n/date-fr.test.ts`](../../packages/web/src/core/i18n/date-fr.test.ts)
       — couvrent le fix TZ (« Aujourd'hui » sur un timestamp UTC
       midnight) et un bug latent dans `formatMonthLabel` (l'input
       `'2026-'` rendait « Décembre 2025 » à cause de
       `Number('') === 0` ; corrigé par un range check explicit).
       Suppressions :
       [`flow/Journal/lib/date-format.ts`](../../packages/web/src/app/flow/Journal/lib/date-format.ts),
       [`flow/Library/lib/review-format.ts`](../../packages/web/src/app/flow/Library/lib/review-format.ts),
       et leurs tests. Les helpers spécifiques restent en local
       (`Mood/lib/date-format.ts` ne porte plus que `rangeFor`,
       lié à la heatmap ; `Review/views/List.tsx` garde
       `DRAFT_DATETIME_FMT` qui ajoute heure/minute, pattern
       unique à cette surface). Le `vitest.config.ts` web a aussi
       reçu l'alias `@/` qui manquait — pré-requis pour que les
       tests de `core/i18n/` résolvent leurs imports.
- [x] **Lite shapes Homepage** : évalués après refacto
       Homepage. `MoodEntryLite` dérive via
       `Pick<MoodEntry, 'dateIso' | 'score'> & { createdAt }` —
       le `createdAt` reste en shim local parce que la
       canonical `MoodEntry` n'a pas de timestamp serveur (le
       design minimum-readable-surface l'a supprimé). Pour
       `GoalEntryLite` et `LibraryReadingLite`, le Pick<>
       n'est **pas** un gain : Goal a un `status` plus étroit
       (`'open' | 'wip' | 'done'`) que la canonical
       `CanonicalStatus` (qui inclut `'active'`/`'archived'`),
       et Library a un `author` qui est un join dérivé du
       `creators[]` filtré, pas un champ direct. La raison de
       chaque décision est documentée dans la JSDoc des Lite
       — futur lecteur n'a pas à redécouvrir.
- [x] **`VALID_SCORES` / `VALID_STATUS`** — `VALID_SCORES` est
       maintenant exporté depuis [`Mood/lib/mappers.ts`](../../packages/web/src/app/flow/Mood/lib/mappers.ts)
       et `VALID_STATUS` depuis [`Goals/lib/mappers.ts`](../../packages/web/src/app/flow/Goals/lib/mappers.ts).
       Homepage les ré-importe au lieu de redéclarer ses propres
       `Set` — même source de vérité, plus de risque de drift si
       le domaine du score / statut change.
- [x] **Pattern « 3 contextes »** factorisé dans
       [`core/react/module-contexts.tsx`](../../packages/web/src/core/react/module-contexts.tsx)
       (108 LOC). Library / Goals / Journal / Mood l'utilisent
       via `createModuleContexts<Data, Filters, Actions>(name)`
       — chaque module gagne ~15 LOC, le helper
       `useRequiredContext` n'existe plus qu'à un seul endroit, et
       Habits / Review n'auront qu'à appeler la factory pour
       hériter du même pattern.

---

## Tier 4 — pages d'auth publiques (livré)

**Statut** : 7 pages refacto'ées (LoginMfa, RecoveryCode,
Recover, Reset, Register, Passkeys, Totp) + 2 dedups
cross-pages (PasswordRulesList + StrengthBar dans
`ui/atoms/auth/`, RecoveryCodeDisplay dans `ui/atoms/auth/`).
Aucun `useReducer` introduit — le `useState`-par-stage
existait déjà partout, le coût d'un reducer n'aurait pas
amorti le risque.

- [x] [`pages/Totp/`](../../packages/web/src/app/pages/Totp/) —
       909 → 106 LOC orchestrator + 7 fichiers ≤ 218 LOC.
       Dedup interne `BackupCodesPanel` (factorise
       `CodesPanel` + `RegenDisplayPanel`) et `PasswordPanel`
       (utilisé par RegenFlow + DisableView).
- [x] [`pages/Passkeys/`](../../packages/web/src/app/pages/Passkeys/) —
       581 → 140 LOC orchestrator + 4 panels (List/Add/Remove/
       Rename) + `lib/error-helpers.ts` (`isPasswordError`,
       `isWebAuthnCancel`).
- [x] [`pages/Register/`](../../packages/web/src/app/pages/Register/) —
       550 → 110 LOC orchestrator + `RegisterForm` (262) +
       `Stages` (135 — les 5 panels triviaux groupés).
- [x] [`pages/Recover/`](../../packages/web/src/app/pages/Recover/) —
       539 → 183 LOC orchestrator + `FormPanel` (181). Le
       `DisplayPanel` post-recovery est passé sur le partagé
       `ui/atoms/auth/RecoveryCodeDisplay`.
- [x] [`pages/Reset/`](../../packages/web/src/app/pages/Reset/) —
       360 → 191 LOC orchestrator + `ResetForm` (146) +
       `InvalidLinkPanel` (25) + `DonePanel` (33).
- [x] [`pages/RecoveryCode/`](../../packages/web/src/app/pages/RecoveryCode/) —
       323 → 136 LOC orchestrator + `FormPanel` (83). Le
       `DisplayPanel` est passé sur le partagé.
- [x] [`pages/LoginMfa/`](../../packages/web/src/app/pages/LoginMfa/) —
       461 → 232 LOC orchestrator + `TotpStep` (168) +
       `PasskeyStep` (94) + `LostFlow` (106) +
       `lib/validation.ts` (avec 11 tests Vitest).
- [x] **`pages/ChangePassword.tsx`** : 318 → 227 LOC après le
       dedup `PasswordRulesList` + `StrengthBar` (sous le
       plafond, pas besoin de découpage supplémentaire).
- [x] **Dedup cross-pages** :
       - [`ui/atoms/auth/PasswordRulesList.tsx`](../../packages/web/src/ui/atoms/auth/PasswordRulesList.tsx)
         + [`StrengthBar.tsx`](../../packages/web/src/ui/atoms/auth/StrengthBar.tsx)
         (Register, Recover, ChangePassword partageaient le
         même JSX byte-for-byte).
       - [`ui/atoms/auth/RecoveryCodeDisplay.tsx`](../../packages/web/src/ui/atoms/auth/RecoveryCodeDisplay.tsx)
         (RecoveryCode, Recover partageaient le même
         « show this mnemonic ONCE »).

---

## Tier 5 — routes API (≥ 500 LOC) — livré

Le côté serveur avait deux routes monolithiques + le schéma
Drizzle + le dispatcher ISBN. Livré dans son intégralité.

- [x] [`api/src/routes/auth.ts`](../../packages/api/src/routes/auth.ts)
       — **809 → 49 LOC** (orchestrateur). Sous-routeurs Hono
       montés sur `/` : `auth-login.ts` (login/logout, 282),
       `auth-reset.ts` (request-reset / reset/start / reset/finish,
       215), `auth-change-password.ts` (130),
       `auth-account.ts` (GET /me, PATCH email/username,
       /onboarding/complete, DELETE /me, 217),
       `auth-shared.ts` (`isUniqueViolation` + 3 rate limiters, 53).
       Surface externe inchangée.
- [x] [`api/src/routes/auth-passkey.ts`](../../packages/api/src/routes/auth-passkey.ts)
       — **800 → 63 LOC** (orchestrateur). Sous-routeurs montés
       sur `/` : `auth-passkey-enroll.ts` (start/finish, 229),
       `auth-passkey-manage.ts` (list/rename/remove + auto-
       downgrade §6.1, 169), `auth-passkey-login.ts` (login
       start/finish, 323), `passkey-helpers.ts` (handles + b64url
       + transports + rate limiters, 98).
- [x] [`api/src/lookup/dispatcher.ts`](../../packages/api/src/lookup/dispatcher.ts)
       — **568 → 162 LOC** (orchestrateur).
       `lookup/providers.ts` (PROVIDERS array, 31),
       `lookup/merge.ts` (`collectResults` + `mergeOnce` +
       `cleanSummary`, 151), `lookup/dedupe.ts`
       (`dedupeAcrossProviders` + `identityTokens` +
       `filterByLanguage`, 123), `lookup/probe.ts` (health
       check + `TEST_ISBN_BY_PROVIDER`, 116). `dispatcher.ts`
       garde la cache + `reorderForLang` + `lookupByIsbn` +
       `streamLookupByQuery` + re-export `probeLibraryProviders`.
- [x] [`api/src/db/schema.ts`](../../packages/api/src/db/schema.ts)
       — **678 → 113 LOC** (barrel). Découpé par domaine :
       `schema/enums.ts` (101), `schema/users.ts` (users +
       sessions, 177), `schema/auth.ts` (opaque + factors + totp
       + bypass + email-verifs + reset-tokens, 225),
       `schema/admin.ts` (invites + appSettings + announcements,
       100), `schema/entries.ts` (factory + 9 tables, 90),
       `schema/modules.ts` (modulesConfig + userPreferences, 35).
       Le barrel re-exporte tout + tous les `Row` / `New` types
       inférés ; les 200+ call-sites n'ont pas bougé.

---

## Tier 6 — petites lignes — livré

Bricoles repérées au passage, traitées dans la foulée.

- [x] [`web/src/core/auth/use-session.ts`](../../packages/web/src/core/auth/use-session.ts)
       — **1208 → 159 LOC** (hook React seul). Modules sous
       `core/auth/session/` :
       `types.ts` (68), `login.ts` (236), `register.ts` (99),
       `change-password.ts` (126), `recovery-code.ts` (274),
       `passkeys.ts` (268), `totp.ts` (90),
       `security-mode.ts` (54), `freshen-reauth.ts` (15).
       Chaque helper reçoit un `deps` étroit (mutations store +
       user) bindé par le hook depuis les sélecteurs Zustand.
       Surface du hook inchangée — les 14 consommateurs (Login,
       Register, Recover, RecoveryCode, ChangePassword,
       LoginMfa, Totp, Passkeys, SecurityMode, DangerTab,
       ProtectedRoute, Layout, SidebarHeader, use-session
       lui-même) n'ont pas bougé.
- [x] [`web/src/core/api/client.ts`](../../packages/web/src/core/api/client.ts)
       — **937 → 122 LOC** (barrel re-export). Modules par
       domaine sous `core/api/` :
       `internal.ts` (82, request + ApiError + helpers),
       `auth.ts` (299), `mfa.ts` (80), `passkeys.ts` (86),
       `totp.ts` (43), `security-mode.ts` (20),
       `library.ts` (148), `admin.ts` (153),
       `storage.ts` (43, modules-config + user-preferences).
       Surface inchangée — les 38+ call-sites continuent
       d'importer depuis `core/api/client.ts`.
- [x] [`web/src/app/flow/Review/config/steps.ts`](../../packages/web/src/app/flow/Review/config/steps.ts)
       — **505 → 267 LOC**. Types extraits dans
       `step-types.ts` (92), tableaux de champs YearCompass
       dans `step-fields.ts` (190). Le fichier `steps.ts`
       garde STEPS, GROUP_LABELS, QUESTION_STEPS,
       `questionPosition`, `setByPath`, `getByPath`. Surface
       inchangée pour les 5 importeurs (Wizard, Reader, List,
       StepNav, SectionForm) via re-export des types.
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
