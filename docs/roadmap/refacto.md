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
| 1 fichier | `Goals/lib/date-format.ts` dupliquait la logique short-month du module central déjà i18n-aware `core/i18n/date-format` | livré — `formatPartialDate` ajouté au module central, fichier Goals supprimé (REFACTO-05) |

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

### REFACTO-09 — Purger `ui/atoms/` du code mort — livré

- **Type** : suppression
- **Sites** (20 fichiers, supprimés) :
  - `ui/atoms/actions/EditDeleteActions.tsx`
  - `ui/atoms/base/{Alert,Button,Card,Modal}.tsx`
  - `ui/atoms/data/TableShell.tsx`
  - `ui/atoms/feedback/{Badge,StatusBanner}.tsx`
  - `ui/atoms/form/{DateMonthPicker,FormError,FormField,Input,Select,SuggestInput,Textarea}.tsx`
  - `ui/atoms/specifics/{AccountSettingsCard,EncryptedActionGate,LanguageSelector,ThemeSelector}.tsx`
  - `ui/atoms/typography/SectionHeader.tsx`
- **Tâches**
  - [x] Vérifier 1 dernière fois (grep strict par chemin) que chaque fichier a 0 import.
  - [x] `git rm` les 20 fichiers + retirer les dossiers vides résultants (`actions/`, `base/`, `data/`, `form/`, `typography/`).
  - [x] Le tsc doit passer sans modif (le code est déjà mort).
  - [x] Documenter la nouvelle structure dans [`docs/Architecture.md`](../Architecture.md).
- **Gain** : ~1000 LOC mortes en moins, plus d'ambiguïté
  « quel Modal/Button/Input importer » (les vrais sont dans
  `dirk/`, `feedback/`, `layout/`, `auth/`).
- **Effort** : S — ~30 min
- **Risque** : faible (0 import, donc 0 régression possible)
- **Dépendances** : aucune

### REFACTO-10 — Déplacer `Settings/components/ModulesManager` → `Account/components/` — livré

- **Type** : déplacement + suppression dossier fantôme
- **Sites** : `flow/Settings/components/ModulesManager.tsx`,
  consommé par [`flow/Account/views/ModulesTab.tsx`](../../packages/web/src/app/flow/Account/views/ModulesTab.tsx) seul.
- **Tâches**
  - [x] `git mv packages/web/src/app/flow/Settings/components/ModulesManager.tsx packages/web/src/app/flow/Account/components/ModulesManager.tsx`
  - [x] Mettre à jour l'import dans `ModulesTab.tsx`.
  - [x] `rmdir` les dossiers `Settings/components/` et `Settings/` qui deviennent vides.
- **Gain** : élimination d'un pseudo-module, Account devient
  vraiment propriétaire du widget qu'il consomme exclusivement.
- **Effort** : S — ~10 min
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-01 — Centraliser le type `LoadState` — livré

- **Type** : dédup
- **Sites** (tous migrés) :
  - `Goals/lib/types.ts` (déf locale supprimée)
  - `Journal/lib/types.ts` (déf locale supprimée)
  - `Mood/lib/types.ts` (déf locale supprimée)
  - `Library/context.tsx` (déf locale supprimée)
- **Source unique** : [`core/types/load-state.ts`](../../packages/web/src/core/types/load-state.ts)
  expose le type + les helpers `isReady`, `errorMessageOf`.
- **Tâches**
  - [x] Créer le fichier + tests minimaux (1 par variant + helpers).
  - [x] Migrer les 4 sites vers `import type { LoadState } from '@/core/types/load-state'`.
  - [x] Supprimer les 4 définitions locales.
- **Gain** : 4 occurrences → 1 ; toute nouvelle page (Habits,
  Review v2) le réutilise gratis.
- **Effort** : S — ~30 min
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-05 — `core/i18n/date-format` exposé en source unique i18n-aware — livré

- **Type** : centralisation + i18n
- **Constat à l'audit (mis à jour à la livraison)** : le module
  central [`core/i18n/date-format.ts`](../../packages/web/src/core/i18n/date-format.ts)
  était **déjà i18n-aware** (chaque helper prend `language` en argument
  et délègue à `Intl.DateTimeFormat` via `intlLocale`). Le seul reliquat
  était `Goals/lib/date-format.ts` qui dupliquait la logique short-month
  pour gérer le format hybride `YYYY-MM` / `YYYY-MM-DD`.
- **Solution livrée** : promotion de la fonction `formatDate` (Goals)
  en `formatPartialDate(dateIso, language)` dans le module central,
  avec ses tests transposés (FR + EN). Goals migre vers cet import
  partagé ; le fichier `Goals/lib/date-format.ts` et son test sont
  supprimés.
- **Tâches**
  - [x] Ajouter `formatPartialDate` + tests FR/EN dans `core/i18n/date-format`.
  - [x] Migrer `Goals/views/GoalRow.tsx` (`formatDate` → `formatPartialDate`).
  - [x] Supprimer `Goals/lib/date-format.ts` + `date-format.test.ts`.
- **Gain** : -1 fichier legacy, single source of truth pour
  toutes les dates (déjà la cible de fait, désormais sans exception).
- **Effort** : S — ~30 min (la roadmap visait M ~1h30 sur la base
  d'un audit antérieur où `core/i18n/date-fr.ts` existait encore et
  était FR-only ; entre-temps il a été promu à `date-format.ts`
  i18n-aware, ce qui a réduit le périmètre).
- **Risque** : faible
- **Dépendances** : aucune

### REFACTO-11 — Renommages cohérents (single-file folders + casse) — livré

- **Type** : renommage / aplatissage
- **Cibles** (toutes livrées)

| Avant | Après | Statut |
|---|---|---|
| `core/preferences/usePreferences.ts` | `core/auth/use-preferences.ts` | livré (les prefs vivent avec la session) |
| `core/react/module-contexts.tsx` | `core/contexts/module-contexts.tsx` | livré |
| `app/config/modules_list.tsx` | `app/modules-registry.tsx` | livré (kebab + flat) |
| `core/utils/ImportExport/` | `core/api/modules/import-export/` (fichiers en kebab-case) | livré |

- **Tâches**
  - [x] `git mv` chaque cible (préserve l'historique).
  - [x] Mettre à jour les imports (estimé < 20 sites — 19 réels).
  - [x] tsc + tests (302 unit tests verts).
- **Gain** : conventions homogènes, 4 dossiers fantômes éliminés
  (`core/preferences/`, `core/react/`, `app/config/`, `core/utils/`).
- **Effort** : M — ~1h cumulée
- **Risque** : faible
- **Dépendances** : aucune

---

## Tier 1 — Hooks & extractions

> Effort moyen, risque faible. Pose les bases sémantiques pour
> les chantiers de Tier 2.

### REFACTO-02 — Hook `useModuleClient(moduleId)` — livré

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
  - [x] Créer le hook + test unit.
  - [x] Migrer les 13 sites un par un (commit par module pour facilité).
  - [x] Documenter la convention dans `CLAUDE.md` § Frontend rules.
  - [x] Optionnel : règle ESLint `no-restricted-syntax` flaggant `!mainKey || !moduleUserId` directement.
- **Gain** : sémantique « module hydraté » nommée explicitement,
  types resserrés downstream (les callers n'ont plus à narrow
  `mainKey | null`), 13 sites simplifiés.
- **Effort** : M — ~3h
- **Risque** : moyen — touche le flow data de chaque module.
  Tests vitest existants à passer après migration.
- **Dépendances** : faire **après REFACTO-01** (le LoadState
  partagé sera utilisé par les mêmes sites).

### REFACTO-07 — Splitter `core/auth/passkey-flow.ts` — livré

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
  - [x] Créer les 4 fichiers + déplacer le contenu.
  - [x] Vérifier que la frontière enroll/login/shared est nette (pas d'imports croisés non triviaux).
  - [x] Mettre à jour les imports (~5 sites).
- **Gain** : -1 fichier 530 LOC → 3 fichiers ~150 LOC, navigation
  enroll vs login évidente.
- **Effort** : M — ~2h
- **Risque** : faible (séparation nette, tests passkey
  existants)
- **Dépendances** : aucune

### REFACTO-04 — Splitter `bodies/LibraryItem.tsx` — livré

- **Type** : split fichier
- **Statut** : livré (commit `51bf6c4`).
- **Réalité du split** : la proposition initiale (6 sub-components
  par section visuelle) a été abandonnée au profit d'un découpage
  par **responsabilité logique** plutôt que visuelle :
  - [`ui/dirk/ComposerModal/bodies/LibraryItem.tsx`](../../packages/web/src/ui/dirk/ComposerModal/bodies/LibraryItem.tsx)
    (438 LOC) — ne porte plus que l'état du formulaire + le rendu JSX.
  - [`bodies/library-item/save.ts`](../../packages/web/src/ui/dirk/ComposerModal/bodies/library-item/save.ts)
    (245 LOC) — fonction pure `saveLibraryItem({ ctx, editing,
    fields })` qui enchaîne validation + assemblage payload + create/
    update + persistance best-effort de la couverture. Aucune
    dépendance React.
  - [`bodies/library-item/use-lookup.ts`](../../packages/web/src/ui/dirk/ComposerModal/bodies/library-item/use-lookup.ts)
    (166 LOC) — hook `useLibraryLookup()` qui encapsule le ballet
    de recherche (routage ISBN vs free-text, abort-on-new-run,
    snapshots NDJSON, gestion d'erreurs, cleanup unmount).
- **Pourquoi ce split plutôt que 6 sub-components** : la complexité
  cachée de LibraryItem n'était pas dans le rendu (qui est plat) mais
  dans l'orchestration `handleSave` (~150 LOC) et le ballet streaming
  de la lookup (~70 LOC). Découper le rendu en 6 fichiers visuels
  aurait propagé 13 props + 13 setters sur chaque sub-component sans
  réduire la complexité réelle. Extraire les deux moteurs (save +
  lookup) en pièces testables indépendamment a un meilleur ratio.
- **Tâches**
  - [x] Sortir `saveLibraryItem` en fonction pure dans `save.ts`.
  - [x] Sortir le ballet recherche en hook `useLibraryLookup` dans
    `use-lookup.ts`.
  - [x] LibraryItem.tsx réduit à 438 LOC (sous le plafond 200-300
    LOC du factor-early pour un body composer, mais acceptable car
    le JSX porte 13 champs de formulaire).
  - [x] Comportement form préservé (création + édition + lookup).
  - [x] Aucune spec Playwright pour Library aujourd'hui ; vérifier
    manuellement reste recommandé.
- **Gain** : moteurs save + lookup testables sans React, shell JSX
  lisible, plafond factor-early respecté sur les nouveaux fichiers.
- **Effort** : M — réalisé.
- **Risque** : faible une fois les 313 tests verts.
- **Dépendances** : aucune

---

## Tier 2 — Refactos structurantes

> Effort élevé, risque moyen. Décollent quand le Tier 1 a
> stabilisé les hooks de base.

### REFACTO-08 — Splitter `Library/context.tsx` et `Goals/context.tsx` — livré

- **Type** : split fichier (×2)
- **Statut** : livré.
- **Réalité du split** :
  - **Library** : `context.tsx` 477 → 191 LOC (-60 %). Trois sous-hooks dans `flow/Library/state/` :
    - [`use-library-data.ts`](../../packages/web/src/app/flow/Library/state/use-library-data.ts) (79 LOC) — fetch parallèle items + reviews + covers + LoadState.
    - [`use-library-filters.ts`](../../packages/web/src/app/flow/Library/state/use-library-filters.ts) (116 LOC) — statut/tag/group-by/viewMode + dérivés (allTags, filteredItems, groups) + persistence localStorage du viewMode.
    - [`use-library-actions.ts`](../../packages/web/src/app/flow/Library/state/use-library-actions.ts) (265 LOC) — 11 callbacks (add/edit/delete item, toggleFavorite, add/edit/delete review, picker open/close/pick) avec refs internes pour l'optimistic-rollback.
  - **Goals** : `context.tsx` 408 → 155 LOC (-62 %). Trois sous-hooks dans `flow/Goals/state/` :
    - [`use-goals-data.ts`](../../packages/web/src/app/flow/Goals/state/use-goals-data.ts) (81 LOC) — fetch + LoadState + stats (sur la full array, pas sur filtered).
    - [`use-goals-filters.ts`](../../packages/web/src/app/flow/Goals/state/use-goals-filters.ts) (112 LOC) — statusFilter/groupBy/search/sortBy/hideDone + filtered + groups.
    - [`use-goals-actions.ts`](../../packages/web/src/app/flow/Goals/state/use-goals-actions.ts) (204 LOC) — cycleStatus/edit/delete/carryOver + carry-over dialog state.
- **Pattern refs internes** : chaque actions hook gère `useRef(items|entries|reviews)` mirrorée dans `useEffect`, et les callbacks lisent via la ref. Résultat : les identités de callbacks restent stables entre fetches, ce qui est tout l'intérêt de séparer `actions` de `data` / `filters`. Sans ça, lister `items` dans la dep array invaliderait chaque callback à chaque fetch et re-renderait tous les consumers du context actions.
- **Tâches**
  - [x] Library : créer `state/`, déplacer en 3 fichiers, Provider orchestre.
  - [x] Goals : idem.
  - [x] Closures vérifiées : pattern refs internes maintenu, identités callbacks stables.
  - [x] Commentaires d'en-tête mis à jour sur les deux `context.tsx` pour décrire le nouveau découpage.
- **Gain réalisé** : chaque fichier <300 LOC, isolation testable des handlers indépendamment du Provider, lecture facilitée (data fetch et filter logic plus mêlés au cycle de vie React du Provider).
- **Effort** : L — réalisé.
- **Risque** : moyen, validé par 313/313 vitests + tsc clean. Le run UI manuel reste recommandé sur les flows Library/Goals avant déploiement (les callbacks d'actions touchent du code crypto e2e côté optimistic update).
- **Dépendances** : REFACTO-02 ✓

### REFACTO-12 — Harmoniser pages auth (flat → folder) — livré

- **Type** : split fichier (×5)
- **Statut** : livré.
- **Règle figée dans CLAUDE.md** : « page > 200 LOC OU ≥ 2 panels distincts → folder avec `index.tsx` + sous-fichiers ». Documentée dans la section *Page-level file organisation*.
- **Pages migrées** :
  - **Login.tsx** (239 LOC) → `Login/{index.tsx, LoginForm.tsx, PasskeyButton.tsx}`. Form RHF + bouton passkey extraits ; index orchestre les bannières + AuthLayout.
  - **ChangePassword.tsx** (225 LOC) → `ChangePassword/{index.tsx, ChangePasswordForm.tsx}`. Form RHF avec strength UX déménage ; index garde le AuthLayout + back link.
  - **RequestReset.tsx** (260 LOC) → `RequestReset/{index.tsx, ForkPanel.tsx, DestroyForm.tsx, SentPanel.tsx, Warning.tsx}`. Une page par stage du state machine. `Warning` réutilisé entre `DestroyForm` et `SentPanel`.
  - **BypassConfirm.tsx** (287 LOC) → `BypassConfirm/{index.tsx, PendingPanel.tsx, SuccessPanel.tsx, ErrorPanel.tsx}`. Le `Countdown` reste inline dans `SuccessPanel` (seul consommateur).
  - **SecurityMode.tsx** (296 LOC) → `SecurityMode/{index.tsx, ModeSelector.tsx, PasswordProofForm.tsx}`. La derivation des options reste dans index (a besoin du store user).
- **`git mv` à chaque page** pour préserver la blame history.
- **Effort** : L — réalisé.
- **Risque** : moyen (auth = critique). Tests vitests verts (313/313), tsc clean ; un run UI manuel reste recommandé sur les 5 flows avant deploy.
- **Dépendances** : couplé avec REFACTO-06 ci-dessous, le tout dans un même commit.

### REFACTO-06 — Standardiser le form lib des pages auth — livré

- **Type** : cohérence
- **Statut** : livré.
- **Règle figée dans CLAUDE.md** : « forms à 1 seul champ → `useState` direct OK, RHF overkill ; forms à 2+ champs → React Hook Form obligatoire ». Documentée dans la section *Forms*.
- **Pages migrées vers RHF + zodResolver** :
  - `RequestReset/DestroyForm.tsx` — schéma `email`.
  - `Reset/ResetForm.tsx` — schéma `password ≥ 12 + confirm match + acknowledged literal-true`. Le crypto-heavy submit reste dans `Reset/index.tsx` ; le form appelle `onValidSubmit(password)` après validation.
- **Pages laissées en `useState` (justifié)** :
  - `Activate.tsx` — pas de form (auto-process magic link).
  - `BypassConfirm.tsx` — pas de form (auto-process).
  - `Recover/index.tsx` — multi-field mais le flow vient juste d'être refait (recovery code consommé, pas rotaté en place — Tier 3 §4 SEC-06/07/08 follow-up). Migration RHF différée pour ne pas chaîner deux changements lourds sur le même flow critique. Sera traitée si on retouche cette page pour autre chose.
  - `SecurityMode/PasswordProofForm.tsx` — single-field (juste le mot de passe de confirmation), `useState` cohérent avec la règle.
- **Effort** : L — réalisé.
- **Risque** : moyen-élevé (auth = critique). Tests vitests verts (313/313), tsc clean. Run UI manuel recommandé sur les flows reset + request-reset avant deploy.
- **Dépendances** : aucune restante.

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
