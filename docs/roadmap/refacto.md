# Factorisation & organisation — roadmap

> **Statut** : audit posé après les chantiers `module-refacto`,
> `factoring-audit` et la migration logo. Cette roadmap consolide
> deux passes d'audit (factorisation et organisation des dossiers)
> en un seul plan d'attaque ordonné. **13 chantiers identifiés**,
> de la simple purge de code mort jusqu'au split de fichiers
> éléphants.
>
> **Mise à jour** : à chaque PR qui livre un chantier, cocher la
> case correspondante et déplacer la ligne récap en bas du
> document si tu veux. Si une refacto change un pattern
> documenté (ex : standardiser RHF, introduire `useModuleClient`),
> mettre à jour `CLAUDE.md` ou `documentation/Architecture.md`
> dans le **même commit**.

Audit mené sur `packages/web/src/`, `packages/api/src/`,
`packages/shared/src/` au commit `f09d73c`. Référence d'audit
antérieur : `health.md` (livré et retiré) — celui-ci avait déjà signé
le pattern `createModuleContexts<>()` et la promotion de
`splitThreads` à `@nodea/shared`. La roadmap ci-dessous est en
**continuité** de ces travaux, pas en concurrence.

---

## État des lieux

### Côté typage et hygiène

- **TS strict + extras** appliqué partout (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
  **0 `:any` explicites**, 1 seul `@ts-ignore` dans tout le
  code, 13 `eslint-disable`. Plancher de typage solide.
- **49 fichiers de test** (vitest + e2e Playwright). Couverture
  non mesurée à la pose de l'audit (depuis : baseline posé via le Tier A 3 de `health.md`, livré).
- **1 seul fichier `.jsx` legacy** restant
  ([`I18nProvider.jsx`](../../packages/web/src/i18n/I18nProvider.jsx)),
  qui était suivi par le Tier A 2 de `health.md` (roadmap livrée et retirée).

### Côté Zod & schémas partagés

**Déjà bien centralisé.** 16 fichiers dans
[`packages/shared/src/schemas/`](../../packages/shared/src/schemas/),
~220 exports nommés, **127 sites d'import** depuis api + web.
Les 4 schémas définis hors-shared sont tous
**légitimement locaux** :

- [`api/src/config.ts`](../../packages/api/src/config.ts) — env
  vars, process-local.
- [`api/src/routes/admin.ts:197`](../../packages/api/src/routes/admin.ts#L197)
  — `SettingsPatchBodySchema` (1 champ aujourd'hui, à recentraliser
  quand un 2ᵉ champ s'ajoute).
- [`pages/ChangePassword.tsx`](../../packages/web/src/app/pages/ChangePassword.tsx),
  [`pages/Register/RegisterForm.tsx`](../../packages/web/src/app/pages/Register/RegisterForm.tsx)
  — form schemas avec `.refine(confirmPassword)` UX-only ; le
  schéma serveur n'a pas ce champ. Centraliser forcerait deux
  shapes artificielles, gain négatif. **Pas de refacto Zod
  proposée.**

### Côté factorisation

Dédup trouvée à la règle de trois :

| Sites | Pattern | Sévérité |
|---|---|---|
| 4 fichiers | type `LoadState` discriminé identique caractère par caractère | dédup évidente |
| 13 sites | garde `if (!mainKey \|\| !moduleUserId) return` répétée | hook manquant |
| 1 fichier | `Goals/lib/date-format.ts` réimplémente `FRENCH_MONTHS` alors que `core/i18n/date-fr` les centralise déjà — et le module `date-fr` est lui-même FR-only | scorie d'historique + à promouvoir en `date.ts` i18n-aware (REFACTO-05) |

Fichiers éléphants à splitter :

| Lignes | Fichier | Verdict |
|---|---|---|
| 662 | [`bodies/LibraryItem.tsx`](../../packages/web/src/ui/dirk/ComposerModal/bodies/LibraryItem.tsx) | mélange responsabilités, splitter |
| 531 | [`core/auth/passkey-flow.ts`](../../packages/web/src/core/auth/passkey-flow.ts) | 2 orchestrateurs distincts (enroll + login), splitter |
| 483 | [`Library/context.tsx`](../../packages/web/src/app/flow/Library/context.tsx) | data + filters + actions dans 1 fichier malgré la factory |
| 416 | [`Goals/context.tsx`](../../packages/web/src/app/flow/Goals/context.tsx) | même profil |
| 409 | [`bodies/Goal.tsx`](../../packages/web/src/ui/dirk/ComposerModal/bodies/Goal.tsx) | borderline, à voir |
| 414 | [`core/store/nodea-store.ts`](../../packages/web/src/core/store/nodea-store.ts) | **garder** — store unique volontaire |
| 430 | [`api/seed/shared.ts`](../../packages/api/src/seed/shared.ts) | **garder** — seed structurel |

### Côté organisation

Le plus gros foyer de désordre : **`ui/atoms/`**.

| Métrique | Valeur |
|---|---|
| Fichiers TSX dans `ui/atoms/` | 33 |
| Fichiers avec **0 import** | **20** |
| Sous-dossiers entièrement morts (`actions/`, `base/`, `data/`, `form/`, `typography/`) | **5** |
| Implémentations du theme picker | 3 (`ThemeToggle`, `ThemeSwitch`, `ThemeSelector`) |
| Implémentations du language picker | 2 (`LanguageToggle` + `LanguageSelector` mort) |

Dossiers fantômes (single-file folders incohérents) :

- [`flow/Settings/components/ModulesManager.tsx`](../../packages/web/src/app/flow/Settings/components/ModulesManager.tsx)
  — consommé seul par `flow/Account/views/ModulesTab.tsx`. Pas un
  module, pas une page. Faux modulaire.
- [`flow/Goals/hooks/useGoalDraft.ts`](../../packages/web/src/app/flow/Goals/hooks/useGoalDraft.ts)
  — Goals est le **seul** module avec un dossier `hooks/`.
- [`core/preferences/usePreferences.ts`](../../packages/web/src/core/preferences/usePreferences.ts),
  [`core/react/module-contexts.tsx`](../../packages/web/src/core/react/module-contexts.tsx),
  [`app/config/modules_list.tsx`](../../packages/web/src/app/config/modules_list.tsx)
  (snake_case isolé) — autant de single-file folders à
  consolider ou aplatir.

Pages auth incohérentes :

| Pages flat (.tsx racine) | Pages folder (avec index.tsx + sub-views) |
|---|---|
| Login (242), ChangePassword (227), RequestReset (260), BypassConfirm (285), SecurityMode (293), Activate (168), Docs (93), NotFound (15) | LoginMfa, Passkeys, Recover, RecoveryCode, Register, Reset, Totp, docs |

Asymétrie flagrante : **Login.tsx flat (242 LOC) vs Register/
en folder** alors que les deux pages sont symétriques
fonctionnellement.

---

## Tier 0 — Purge & quick wins

> ~3h30 cumulées, risque nul à faible. **À faire en bloc, en
> premier.** C'est le tier qui rend le rapport effort/gain le
> plus élevé du document.

### REFACTO-09 — Purger `ui/atoms/` du code mort

- **Type** : suppression
- **Sites** (20 fichiers) :
  - [`ui/atoms/actions/EditDeleteActions.tsx`](../../packages/web/src/ui/atoms/actions/EditDeleteActions.tsx)
  - [`ui/atoms/base/{Alert,Button,Card,Modal}.tsx`](../../packages/web/src/ui/atoms/base/)
  - [`ui/atoms/data/TableShell.tsx`](../../packages/web/src/ui/atoms/data/TableShell.tsx)
  - [`ui/atoms/feedback/{Badge,StatusBanner}.tsx`](../../packages/web/src/ui/atoms/feedback/)
  - [`ui/atoms/form/{DateMonthPicker,FormError,FormField,Input,Select,SuggestInput,Textarea}.tsx`](../../packages/web/src/ui/atoms/form/)
  - [`ui/atoms/specifics/{AccountSettingsCard,EncryptedActionGate,LanguageSelector,ThemeSelector}.tsx`](../../packages/web/src/ui/atoms/specifics/)
  - [`ui/atoms/typography/SectionHeader.tsx`](../../packages/web/src/ui/atoms/typography/SectionHeader.tsx)
- **Tâches**
  - [ ] Vérifier 1 dernière fois (grep strict par chemin) que chaque fichier a 0 import.
  - [ ] `git rm` les 20 fichiers + retirer les dossiers vides résultants (`actions/`, `base/`, `data/`, `form/`, `typography/`).
  - [ ] Le tsc doit passer sans modif (le code est déjà mort).
  - [ ] Documenter la nouvelle structure dans [`documentation/Architecture.md`](../../documentation/Architecture.md).
- **Gain** : ~1000 LOC mortes en moins, plus d'ambiguïté
  « quel Modal/Button/Input importer » (les vrais sont dans
  `dirk/`, `feedback/`, `layout/`, `auth/`).
- **Effort** : S — ~30 min
- **Risque** : faible (0 import, donc 0 régression possible)
- **Dépendances** : aucune

### REFACTO-10 — Déplacer `Settings/components/ModulesManager` → `Account/components/`

- **Type** : déplacement + suppression dossier fantôme
- **Sites** : [`flow/Settings/components/ModulesManager.tsx`](../../packages/web/src/app/flow/Settings/components/ModulesManager.tsx),
  consommé par [`flow/Account/views/ModulesTab.tsx`](../../packages/web/src/app/flow/Account/views/ModulesTab.tsx) seul.
- **Tâches**
  - [ ] `git mv packages/web/src/app/flow/Settings/components/ModulesManager.tsx packages/web/src/app/flow/Account/components/ModulesManager.tsx`
  - [ ] Mettre à jour l'import dans `ModulesTab.tsx`.
  - [ ] `rmdir` les dossiers `Settings/components/` et `Settings/` qui deviennent vides.
- **Gain** : élimination d'un pseudo-module, Account devient
  vraiment propriétaire du widget qu'il consomme exclusivement.
- **Effort** : S — ~10 min
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-01 — Centraliser le type `LoadState`

- **Type** : dédup
- **Sites** :
  - [`Goals/lib/types.ts:33`](../../packages/web/src/app/flow/Goals/lib/types.ts#L33)
  - [`Journal/lib/types.ts:26`](../../packages/web/src/app/flow/Journal/lib/types.ts#L26)
  - [`Mood/lib/types.ts:26`](../../packages/web/src/app/flow/Mood/lib/types.ts#L26)
  - [`Library/context.tsx:57`](../../packages/web/src/app/flow/Library/context.tsx#L57)
- **Proposition** : créer `packages/web/src/core/types/load-state.ts`
  ```ts
  export type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready' }
    | { status: 'error'; message: string };
  ```
  Optionnel : helpers `isReady`, `errorMessageOf`.
- **Tâches**
  - [ ] Créer le fichier + tests minimaux (1 par variant).
  - [ ] Migrer les 4 sites vers `import type { LoadState } from '@/core/types/load-state'`.
  - [ ] Supprimer les 4 définitions locales.
- **Gain** : 4 occurrences → 1 ; toute nouvelle page (Habits,
  Review v2) le réutilise gratis.
- **Effort** : S — ~30 min
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-05 — Promouvoir `core/i18n/date-fr.ts` en `core/i18n/date.ts` i18n-aware

- **Type** : centralisation + i18n
- **Sites** :
  - [`core/i18n/date-fr.ts`](../../packages/web/src/core/i18n/date-fr.ts)
    (helpers actuels, FR uniquement)
  - [`Goals/lib/date-format.ts`](../../packages/web/src/app/flow/Goals/lib/date-format.ts)
    (32 LOC, FRENCH_MONTHS array + `formatDate` YYYY-MM)
- **Proposition (option B)** : remplacer `core/i18n/date-fr.ts` par
  `core/i18n/date.ts` qui lit la langue active depuis `useI18n()`
  et expose des helpers i18n-aware :
  ```ts
  // core/i18n/date.ts
  export function useDateFmt() {
    const { lang } = useI18n();
    return {
      formatPartialDate: (iso: string) => /* YYYY-MM ou YYYY-MM-DD */,
      formatLongDate:    (iso: string) => /* dimanche 1 mai 2026 */,
      formatRelative:    (iso: string) => /* il y a 3 jours / 3 days ago */,
    };
  }
  ```
  Tables MONTHS / WEEKDAYS / RELATIVE par langue,
  bootstrappées avec `fr` et `en` (les deux langues actuelles
  d'`I18nProvider`). Toute future langue ajoute juste une entrée.
- **Tâches**
  - [ ] `git mv core/i18n/date-fr.ts core/i18n/date.ts` (préserve l'historique).
  - [ ] Remplacer les constantes FR-only par des tables `MONTHS[lang]`, `WEEKDAYS[lang]`.
  - [ ] Exposer un hook `useDateFmt()` qui consomme `useI18n()`.
  - [ ] Garder une API non-hook `formatPartialDate(iso, lang)` pour les rares appelants hors composants.
  - [ ] Migrer les sites consommant `date-fr` (grep `from .*core/i18n/date-fr`).
  - [ ] Migrer `Goals/views/GoalRow.tsx` (et tout site qui consomme `formatDate` de `Goals/lib/date-format.ts`).
  - [ ] Supprimer `Goals/lib/date-format.ts` + `date-format.test.ts`.
  - [ ] Tests : un par helper × FR + EN (round-trip de chaînes attendues).
- **Gain** : single source of truth pour les dates,
  vraie traduction des dates (plus de noms de mois français
  en dur côté UI quand la langue active est `en`). -1 fichier
  legacy (Goals).
- **Effort** : M — ~1h30
- **Risque** : faible (couverture de test à étendre, pas
  de breaking côté serveur — purement frontend display).
- **Dépendances** : aucune

### REFACTO-11 — Renommages cohérents (single-file folders + casse)

- **Type** : renommage / aplatissage
- **Cibles**

| Avant | Après | Justification |
|---|---|---|
| `core/preferences/usePreferences.ts` | `core/auth/use-preferences.ts` (les prefs vivent avec la session) ou `core/use-preferences.ts` | dossier 1-fichier |
| `core/react/module-contexts.tsx` | `core/contexts/module-contexts.tsx` | naming `react/` ambigu |
| `app/config/modules_list.tsx` | `app/modules-registry.tsx` (kebab + flat) | seul snake_case du codebase |
| `core/utils/ImportExport/` | `core/api/modules/import-export/` (fichiers en kebab-case) | seul PascalCase folder dans `core/utils/` |

- **Tâches**
  - [ ] `git mv` chaque cible (préserve l'historique).
  - [ ] Mettre à jour les imports (estimé < 20 sites).
  - [ ] tsc + tests.
- **Gain** : conventions homogènes, dossiers fantômes éliminés.
- **Effort** : M — ~1h cumulée
- **Risque** : faible
- **Dépendances** : aucune

---

## Tier 1 — Hooks & extractions

> Effort moyen, risque faible. Pose les bases sémantiques pour
> les chantiers de Tier 2.

### REFACTO-02 — Hook `useModuleClient(moduleId)`

- **Type** : extraction hook
- **Sites** (13 occurrences) :
  - Goals/context.tsx:146,238,299,319 — Journal/context.tsx:124,236
  - Library/context.tsx:207,280,313,367 — Mood/context.tsx:120,210
  - ComposerModal/bodies/Goal.tsx:101 — ComposerModal/bodies/Journal.tsx:188
- **Proposition** : `packages/web/src/core/modules/use-module-client.ts`
  ```ts
  export function useModuleClient(moduleId: ModuleId): {
    mainKey: AesMainKey;
    moduleUserId: string;
  } | null {
    const mainKey = useNodeaStore(selectMainKey);
    const moduleUserId = useNodeaStore(
      s => selectModules(s)[moduleId]?.moduleUserId ?? null,
    );
    if (!mainKey || !moduleUserId) return null;
    return { mainKey, moduleUserId };
  }
  ```
  Caller :
  ```ts
  const ctx = useModuleClient('goals');
  useEffect(() => { if (!ctx) return; /* fetch */ }, [ctx]);
  ```
- **Tâches**
  - [ ] Créer le hook + test unit.
  - [ ] Migrer les 13 sites un par un (commit par module pour facilité).
  - [ ] Documenter la convention dans `CLAUDE.md` § Frontend rules.
  - [ ] Optionnel : règle ESLint `no-restricted-syntax` flaggant `!mainKey || !moduleUserId` directement.
- **Gain** : sémantique « module hydraté » nommée explicitement,
  types resserrés downstream (les callers n'ont plus à narrow
  `mainKey | null`), 13 sites simplifiés.
- **Effort** : M — ~3h
- **Risque** : moyen — touche le flow data de chaque module.
  Tests vitest existants à passer après migration.
- **Dépendances** : faire **après REFACTO-01** (le LoadState
  partagé sera utilisé par les mêmes sites).

### REFACTO-07 — Splitter `core/auth/passkey-flow.ts`

- **Type** : split fichier
- **Sites** :
  [`core/auth/passkey-flow.ts`](../../packages/web/src/core/auth/passkey-flow.ts)
  (531 LOC, 2 orchestrateurs distincts : `enrollPasskey`
  + `loginWithPasskey`)
- **Proposition** : créer `core/auth/passkey/`
  - `enroll.ts` — exporte `enrollPasskey`
  - `login.ts` — exporte `loginWithPasskey`
  - `shared.ts` — helpers communs (PRF zero-padding, etc.)
  - `index.ts` — re-exports pour backward-compat des imports
- **Tâches**
  - [ ] Créer les 4 fichiers + déplacer le contenu.
  - [ ] Vérifier que la frontière enroll/login/shared est nette (pas d'imports croisés non triviaux).
  - [ ] Mettre à jour les imports (~5 sites).
- **Gain** : -1 fichier 530 LOC → 3 fichiers ~150 LOC, navigation
  enroll vs login évidente.
- **Effort** : M — ~2h
- **Risque** : faible (séparation nette, tests passkey
  existants)
- **Dépendances** : aucune

### REFACTO-04 — Splitter `bodies/LibraryItem.tsx`

- **Type** : split fichier
- **Sites** :
  [`ui/dirk/ComposerModal/bodies/LibraryItem.tsx`](../../packages/web/src/ui/dirk/ComposerModal/bodies/LibraryItem.tsx)
  (662 LOC, 25 `useState`, ~6 sections logiques)
- **Proposition** : créer
  `ui/dirk/ComposerModal/bodies/library-item/`
  - `index.tsx` (orchestration form, ~150 LOC)
  - `CoverSection.tsx` (lookup + thumbnail)
  - `MetadataFields.tsx` (titre, auteur, ISBN, année)
  - `StatusBlock.tsx` (statut + favoris)
  - `TagsInput.tsx` (chips + input)
  - `DatesBlock.tsx` (lu le, ajouté le)
- **Tâches**
  - [ ] Découper en sub-components, props fines.
  - [ ] Préserver le comportement form (création + édition).
  - [ ] Vérifier e2e Playwright si une spec existe pour Library.
- **Gain** : chaque fichier ~100-150 LOC, responsabilité claire.
- **Effort** : M — ~3h
- **Risque** : moyen (le plus gros body composer, à tester
  manuellement aussi).
- **Dépendances** : aucune

---

## Tier 2 — Refactos structurantes

> Effort élevé, risque moyen. Décollent quand le Tier 1 a
> stabilisé les hooks de base.

### REFACTO-08 — Splitter `Library/context.tsx` et `Goals/context.tsx`

- **Type** : split fichier (×2)
- **Sites** : [`Library/context.tsx`](../../packages/web/src/app/flow/Library/context.tsx)
  (483) + [`Goals/context.tsx`](../../packages/web/src/app/flow/Goals/context.tsx)
  (416)
- **Proposition** : pour chaque module, créer `flow/<X>/state/`
  - `data.ts` — effect de chargement, state `{ entries, load, stats }`
  - `filters.ts` — filtering dérivé + setters
  - `actions.ts` — handlers (toggleStatus, edit, delete, carryOver…)
    avec rollback optimiste
  - Le `context.tsx` devient le wiring : import des 3 + appel à
    `createModuleContexts.Provider`
- **Tâches** (par module)
  - [ ] Library : créer `state/`, déplacer en 3 fichiers, garder Provider dans `context.tsx`.
  - [ ] Goals : idem.
  - [ ] Vérifier les closures (les actions captent souvent des refs).
  - [ ] Mettre à jour le commentaire d'architecture en haut de chaque `context.tsx`.
- **Gain** : chaque fichier ~150 LOC, isolation testable des
  handlers indépendamment du Provider.
- **Effort** : L — ~1 jour/module = 2 jours
- **Risque** : moyen (les 3 zones se réfèrent l'une à l'autre
  via refs, attention aux closures stale).
- **Dépendances** : faire **après REFACTO-02** (les effects
  utiliseront `useModuleClient` à ce stade).

### REFACTO-12 — Harmoniser pages auth (flat vs folder)

- **Type** : split fichier (×5)
- **Sites** :
  - [`pages/Login.tsx`](../../packages/web/src/app/pages/Login.tsx) (242)
  - [`pages/ChangePassword.tsx`](../../packages/web/src/app/pages/ChangePassword.tsx) (227)
  - [`pages/RequestReset.tsx`](../../packages/web/src/app/pages/RequestReset.tsx) (260)
  - [`pages/BypassConfirm.tsx`](../../packages/web/src/app/pages/BypassConfirm.tsx) (285)
  - [`pages/SecurityMode.tsx`](../../packages/web/src/app/pages/SecurityMode.tsx) (293)
- **Proposition** : appliquer la règle « page > 200 LOC OU
  ≥ 2 panels distincts → folder avec `index.tsx` ». Pour Login,
  créer `pages/Login/{index.tsx, LoginForm.tsx}` mirroring
  Register. Pour les 4 autres, juger au cas par cas (BypassConfirm
  a déjà des panels logiques internes).
- **Tâches**
  - [ ] Décider la règle (à figer dans `CLAUDE.md`).
  - [ ] Migrer les 5 pages une par une.
  - [ ] Tester chaque flow auth manuellement.
- **Gain** : pattern cohérent dans `pages/`, fichiers
  individuels < 200 LOC.
- **Effort** : L — ~1 jour pour les 5 pages
- **Risque** : moyen (auth = critique, valider e2e).
- **Dépendances** : à coordonner avec REFACTO-06 si on veut
  faire les deux passes simultanément (sinon faire 12 d'abord
  puis 06).

### REFACTO-06 — Standardiser le form lib des pages auth

- **Type** : cohérence
- **Sites** : 5 pages en `useState` brut (Activate, RequestReset,
  Reset, Recover, BypassConfirm, SecurityMode) vs 3 en RHF
  (Login, ChangePassword, Register/RegisterForm).
- **Proposition** : décider — soit migrer les 5 vers
  `react-hook-form` + `zodResolver`, soit documenter dans
  CLAUDE.md une règle explicite (« forms à 1 seul champ →
  useState OK, sinon RHF »). Penche pour migrer : la cohérence
  vaut 1 jour de boulot et les schémas Zod existent déjà côté
  `@nodea/shared` (sauf pour les forms client-only — voir
  Tier 0 § Zod).
- **Tâches**
  - [ ] Décider la règle.
  - [ ] Migrer les 5 pages vers RHF.
  - [ ] Tester chaque flow auth.
- **Gain** : règle claire pour toute nouvelle page, validation
  côté client en lockstep avec le serveur via les mêmes schémas
  Zod (quand applicable).
- **Effort** : L — ~1-2 jours
- **Risque** : moyen-élevé (auth = critique, e2e impératif)
- **Dépendances** : à coordonner avec REFACTO-12 (renommage de
  fichier + migration RHF dans le même mouvement = moins de PR).

---

## Tier 3 — À évaluer / décider

> Refactos qui demandent une décision design avant exécution.
> Pas urgent.

### REFACTO-13 — `ThemeSwitch` vs `ThemeToggle`

- **Type** : peut-être suppression abstraction, peut-être à laisser
- **Sites** :
  - [`dirk/ThemeToggle.tsx`](../../packages/web/src/ui/dirk/ThemeToggle.tsx) (150 LOC, sidebar privée — Headless UI Listbox)
  - [`dirk/ThemeSwitch.tsx`](../../packages/web/src/ui/dirk/ThemeSwitch.tsx) (98 LOC, DocsTopbar publique — switch binaire light/dark)
- **Question design** : est-ce que la sidebar privée a vraiment
  besoin d'un picker 3-way (light / system / dark) avec icônes
  dans une Listbox, alors que la barre publique se contente d'un
  switch binaire ? Ou peut-on consolider en 1 composant ?
- **Tâches**
  - [ ] Décider (avec un screenshot avant/après).
  - [ ] Si consolidation : supprimer l'un, adapter l'autre.
- **Effort** : S si décision rapide
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-14 — Réorganiser `ui/dirk/` racine plate (cosmetic)

- **Type** : organisation
- **Sites** : `ui/dirk/` contient 22 fichiers à plat + 2
  sous-dossiers (`ComposerModal/`, `sidebar/`).
- **Proposition** : sous-grouper en
  - `ui/dirk/layouts/{auth,docs}/` — AuthLayout, AuthMarketingPanel, AuthPanelHeader, DocsLayout, DocsTopbar, DocsToc
  - `ui/dirk/theme/` — LanguageToggle, ThemeToggle, ThemeSwitch
  - racine restante — Topbar, Tabs, PageHeading, ModuleShell, RowCard, EmptyHint, FilterChip, GroupBlock, HoverActions, SectionLabel, Sidebar
- **Tâches** : à faire seulement après que les autres refactos
  soient livrées — c'est cosmétique, pas structurel.
- **Effort** : S
- **Risque** : faible
- **Dépendances** : aucune (mais à faire en dernier)

### REFACTO-15 — `SettingsPatchBodySchema` → shared (marginal)

- **Type** : centralisation
- **Sites** :
  [`api/src/routes/admin.ts:197`](../../packages/api/src/routes/admin.ts#L197)
  + [`web/src/core/api/admin.ts`](../../packages/web/src/core/api/admin.ts)
  (interface dupliquée à la main)
- **Proposition** : à faire **quand un 2ᵉ champ s'ajoute aux app
  settings**. Pour 1 champ (`open_registration: boolean`), le
  gain est négligeable. Marquer dans le code que cette frontière
  bouge dès qu'on étoffe.
- **Effort** : S quand activable
- **Risque** : faible

### REFACTO-16 — Aplatir API `collections/` et `cron/`

- **Type** : organisation
- **Sites** :
  - [`api/src/collections/registry.ts`](../../packages/api/src/collections/registry.ts) (1 fichier)
  - [`api/src/cron/index.ts`](../../packages/api/src/cron/index.ts) (1 fichier)
- **Proposition** : aplatir en `api/src/collections.ts` et
  `api/src/cron.ts`. Ou attendre qu'un 2ᵉ fichier rejoigne, ce
  qui justifierait le dossier.
- **Tâches** : `git mv` + mise à jour des imports.
- **Effort** : S — ~10 min
- **Risque** : faible

### REFACTO-17 — Harmoniser `api/src/services/` (depth)

- **Type** : organisation
- **Sites** :
  - [`api/src/services/email/`](../../packages/api/src/services/email/) (sous-dossier)
  - [`api/src/services/settings.ts`](../../packages/api/src/services/settings.ts) (fichier direct)
- **Proposition** : choisir une profondeur. Deux options :
  (a) tout en sous-dossier → créer `services/settings/{index.ts}`,
  (b) tout en fichier → aplatir `services/email/` en plusieurs
  fichiers `services/email-{type}.ts`. (b) est plus simple ; (a)
  est plus extensible si on ajoute des templates spécialisés.
- **Effort** : S
- **Risque** : faible

---

## Anti-patterns à corriger systématiquement

| Anti-pattern | Règle | Outillage |
|---|---|---|
| Garde `if (!mainKey \|\| !moduleUserId) return` directe | Doit utiliser `useModuleClient` (REFACTO-02) | ESLint `no-restricted-syntax` faisable, ou règle CLAUDE.md |
| Définition locale de `LoadState` | Doit importer depuis `@/core/types/load-state` (REFACTO-01) | ESLint `no-restricted-syntax` flaggant `type LoadState` dans `flow/**/lib/types.ts` |
| Form sans RHF dans `pages/` | Si REFACTO-06 validé : règle CLAUDE.md | Pas d'ESLint, revue PR |
| Schéma Zod local côté serveur | Doit vivre dans `@nodea/shared/schemas/` sauf cas listés (env, form-only avec `.refine` UX) | Revue PR |
| Composant dans `ui/atoms/` non importé | Doit être supprimé (pas de code mort dans `atoms/`) | Script de check pré-commit possible |

---

## Ce qu'il NE faut **PAS** refactorer

| Cible | Pourquoi |
|---|---|
| Per-module `SideColumn.tsx` (×4) | Contenus vraiment différents (chips de statut Goals vs donut Mood vs grouping Library). Les blocs partagés (FilterChip, SectionLabel, EmptyHint) sont déjà extraits. |
| Composer body form skeleton | Les fields divergent trop (mood scores ≠ goal status ≠ library item metadata). Footer + MarkdownEditor déjà extraits. |
| `mappers.ts` par module | Les payloads divergent. Une union forcerait un type qui ne servirait à rien en aval. |
| `nodea-store.ts` (414 LOC) | Source de vérité unique = volontaire. Slices déjà nommés. |
| `api/seed/shared.ts` (430 LOC) | Code de seed structurel, pas de duplication. |
| Routes API > 300 LOC | Cohérentes par feature, splittage casserait la lecture linéaire des flows. |
| Layout `core/api/` (14 fichiers thématiques) | Bien centralisé, pattern uniforme. |
| `ui/atoms/auth/` (3 fichiers domain-coupled) | « atoms/auth » est un nom impur (atoms ≠ domain) mais les 3 composants sont co-localisés et utilisés ensemble par les pages auth. À garder tel quel. |
| `ui/atoms/specifics/{KeyMissingModal, SurfaceCard}` (les 2 vivants) | OK tels quels — `specifics/` est un fourre-tout passable pour les composants qu'on n'a pas envie de catégoriser. |
| Schémas Zod (déjà ~tout centralisé) | 127 imports depuis `@nodea/shared`, les 4 hors-shared sont légitimes. |
| `flow/<X>/{components,context,lib,views}/` standard | Pattern cohérent et utile, conserver. |

---

## Sequencing recommandé

```
Tier 0 (≈3h30, en bloc, 1 PR)
  ├─ REFACTO-09  (purge ui/atoms)            ← absolument en premier
  ├─ REFACTO-10  (Settings → Account)
  ├─ REFACTO-01  (LoadState centralisé)
  ├─ REFACTO-05  (date.ts i18n-aware)
  └─ REFACTO-11  (renommages)

Tier 1 (≈1 jour, 3 PRs séparées)
  ├─ REFACTO-02  (useModuleClient)            ← dépend de 01
  ├─ REFACTO-07  (split passkey-flow)
  └─ REFACTO-04  (split LibraryItem composer)

Tier 2 (≈3-4 jours, 2-3 PRs)
  ├─ REFACTO-08  (split contexts Library + Goals)   ← dépend de 02
  ├─ REFACTO-12  (harmonise pages auth)
  └─ REFACTO-06  (standardise RHF)            ← couplable avec 12

Tier 3 (≈à la demande)
  ├─ REFACTO-13  (Theme picker consolidation)
  ├─ REFACTO-14  (réorg ui/dirk)               ← cosmetic, en dernier
  ├─ REFACTO-15  (SettingsPatch shared)        ← attendre 2ᵉ champ
  ├─ REFACTO-16  (aplatir collections/cron)
  └─ REFACTO-17  (services depth)
```

**Total effort cumulé** : ~5-6 jours dev pour Tier 0 + 1 + 2.
Tier 3 = 1-2h supplémentaires si on les enchaîne.

---

## Décisions à figer (avant de commencer)

| Décision | Options | Impact |
|---|---|---|
| Forme du hook `useModuleClient` retour | `null` quand pas prêt vs throw | REFACTO-02 — préfère `null` pour cohérence avec le pattern existant |
| RHF obligatoire dans pages auth ? | Oui partout / Oui sauf 1-champ / Pas de règle | REFACTO-06 — sans décision claire, l'inconsistance survit |
| Split context : `flow/<X>/state/` ou `flow/<X>/{data,filters,actions}.ts` à la racine ? | Sous-dossier `state/` plus rangé, racine plus visible | REFACTO-08 — préfère `state/` pour ne pas étouffer la racine du module |
| Theme picker — 1 ou 2 composants ? | 1 (consolider) / 2 (garder Toggle + Switch) | REFACTO-13 — décision design |
| Seuil de split flat → folder | 200 LOC / 250 LOC / au cas par cas | REFACTO-12 — proposer 200 LOC comme défaut documenté |

---

## Comment cocher

- À chaque PR qui livre un chantier, cocher les `[ ]`
  correspondants dans la liste de tâches du REFACTO concerné.
- Quand tous les `[ ]` d'un REFACTO sont cochés, ajouter
  `— livré (commit `xxxxxxx`)` à côté du titre du REFACTO.
- Quand tout un Tier est livré, déplacer la section en bas du
  document sous une rubrique « Livré ».
- Quand toute la roadmap est livrée, retirer le fichier de
  `docs/roadmap/` (comme l'a fait `factoring-audit.md` quand il
  s'est terminé — cf. `health.md` Statut).
