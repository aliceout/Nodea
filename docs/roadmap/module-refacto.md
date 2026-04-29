# Module internal refacto — split + 3 contexts

> **Statut** : Library livré (référence). Goals → Journal → Mood à faire.
> **Mise à jour** : à chaque commit qui touche un module concerné, cocher la
> case correspondante dans ce fichier.

Trois modules en `packages/web/src/app/flow/<Module>/index.tsx` font
encore plus de **900 lignes monolithiques** chacun. La refacto qu'on a
appliquée à Library est validée : `pnpm typecheck` vert, 29 tests
pure-logic, comportement inchangé. Cette roadmap propage le même
pattern.

L'objectif n'est pas un changement fonctionnel — c'est de mettre l'app
en état d'**être touchable sans peur**. Chaque feuille reste sous les
~200 lignes ; chaque mutation passe par un context typé ; les helpers
purs ont leur Vitest.

Référence d'implémentation : commits `fc45b07` → `b845403` sur la
branche `refacto-design-v2`. La structure cible vit dans
[`packages/web/src/app/flow/Library/`](../../packages/web/src/app/flow/Library/).

---

## La recette (à appliquer telle quelle)

5 commits par module, chacun isolé et reviewable :

### 1. `refactor(<module>): extract pure helpers to lib/ + Vitest coverage`

Sortir du `index.tsx` :

- **Types** (`lib/types.ts`) — interfaces / unions partagées par plusieurs
  composants (`<Module>Entry`, `LoadState`, etc.).
- **Constantes UI** (`lib/constants.ts`) — labels FR, mappings de tons,
  ordres canoniques (`STATUS_LABEL`, `SCORE_FILL`…).
- **Mappers** (`lib/mappers.ts`) — `recordToEntry`, normalisations
  (`normalizeStatus`, `normalizeScore`).
- **Logique métier** (`lib/<sujet>.ts`) — calculs purs : grouping, tri,
  stats, formats de date, parsing de threads.

Pour chaque fichier de logique : un `lib/<sujet>.test.ts` Vitest
co-localisé. Cibler les fonctions où une régression silencieuse
serait coûteuse (calculs, tris, parsings — pas les passes triviales).

Cette étape **ne change aucun comportement** ; le `index.tsx` importe
maintenant depuis `./lib/*`.

### 2. `feat(<module>): introduce 3 contexts + <Module>Provider`

Créer `<Module>/context.tsx` avec :

- **3 contextes** :
  - `<Module>DataContext` — données déchiffrées + `LoadState`. Bouge
    quand on fetch / mute / refetch.
  - `<Module>FiltersContext` — état des filtres + dérivés
    (`filteredEntries`, `groups`…) + setters. Bouge à chaque clic
    d'utilisateur·ice.
  - `<Module>ActionsContext` — handlers (CRUD + transitions UI). Stable
    via `useCallback` + refs sur les snapshots, pour que les feuilles
    qui ne dépendent que des actions ne re-render pas quand la data
    change.
- **3 hooks** : `use<Module>Data()`, `use<Module>Filters()`,
  `use<Module>Actions()`. Throw si appelés hors provider.
- **`<Module>Provider`** — héberge tout `useState` / `useEffect` /
  `useMemo` / `useCallback` du module ; mémoïse chaque value de
  contexte avec `useMemo`.

`<Module>Page` devient un wrapper :

```tsx
export default function <Module>Page() {
  return (
    <<Module>Provider>
      <<Module>View />
    </<Module>Provider>
  );
}
```

`<Module>View` est l'ancien JSX, mais il **lit via les hooks** au lieu
d'avoir l'état dans son scope local. Les sous-composants restent
**prop-driven** à cette étape (aucun changement de leur API), c'est la
feuille suivante qui les migrera.

### 3. `refactor(<module>): extract components/ (sidebar, dialogs, toggles)`

Sortir vers `<Module>/components/` les UI **partagées** entre vues
(filter sidebar, toggles, modals de dialog secondaires). Chacune
consomme directement les contextes — **plus de props** quand elles
peuvent disparaître. Les conditions de rendu (`{open ? <Modal/> :
null}`) deviennent **self-conditional** dans le composant lui-même
(`return null` si fermé) — le call-site monte le composant
unconditionally.

### 4. `refactor(<module>): extract all catalogue views to views/`

Sortir vers `<Module>/views/` les surfaces de rendu principales
(`PrimaryColumn`, ses sous-vues, les rows). Chacune lit ce qu'il faut
des 3 contextes. Les rows prennent uniquement `entry` (ou équivalent)
en prop — le reste vient des hooks.

### 5. `refactor(<module>): finish split — index.tsx becomes a 100-line wrapper`

Souvent regroupé avec l'étape 4. À la fin :

- `index.tsx` ≤ 100 LOC — imports, JSDoc, le wrapper provider, le
  `<Module>View` qui dispatche.
- Aucun fichier dans le module ne fait plus de **220 LOC** sauf le
  provider (`context.tsx`, qui est le « big controller » par design,
  ~500 LOC).
- `pnpm typecheck` vert, tests verts.

---

## Goals — 963 lignes → ~12 fichiers

État de départ : un `index.tsx` monolithique avec 6 composants
inlines (`PrimaryColumn`, `GoalRow`, `StatusPill`, `StatusGlyph`,
`SideColumn`, `CarryOverDialog`) + 8 helpers purs.

### Spécificités à anticiper

- **Cycle de statut** open → wip → done est central. La fonction
  `nextStatus(current)` doit aller dans `lib/sort.ts` (ou un futur
  `lib/status.ts`) et la transition côté actions context comme
  `cycleStatus(entry)`.
- **`CarryOverDialog`** est un modal de fin d'année (re-baliser les
  goals « ouverts » de l'année passée). Son state (`open` + sélection)
  vit dans actions context comme `reviewPicker` côté Library.
- **`splitThreads`** est dupliqué avec Journal — sortir dans `lib/
  threads.ts` côté Goals, on gérera la mutualisation après le refacto
  des deux modules (cf. § Suites cross-modules).

### Checklist

- [x] **1. lib/ + tests**
  - [x] `lib/types.ts` — `GoalEntry`, `CanonicalStatus`, `SortBy`,
        `LoadState`
  - [x] `lib/constants.ts` — `STATUS_TONE`, `STATUS_LABEL`,
        `SORT_LABEL`, `CANONICAL_STATUSES`
  - [x] `lib/mappers.ts` — `recordToEntry`, `normalizeStatus`,
        `VALID_STATUS`
  - [x] `lib/sort.ts` — `byDateDesc` + tests
  - [x] `lib/status.ts` — `nextStatus` + tests
  - [x] `lib/threads.ts` — `splitThreads` + tests
  - [x] `lib/date-format.ts` — `formatDate`, `FRENCH_MONTHS` + tests
- [x] **2. context.tsx** — `GoalsProvider` + 3 hooks
- [x] **3. components/** — `SideColumn` (avec `SectionLabel`),
       `CarryOverDialog`
- [ ] **4. views/** — `PrimaryColumn`, `GoalRow`, `StatusPill` (avec
       `StatusGlyph` co-localisé)
- [ ] **5. index.tsx final** ≤ 100 LOC

---

## Journal — 916 lignes → ~10 fichiers

État de départ : `PrimaryColumn` + `EntryRow` + `ClampedJournalContent`
+ `ReaderShell` + `SideColumn` + `SectionLabel` + 7 helpers purs.

### Spécificités à anticiper

- **`ReaderShell`** est un mode lecture plein-écran sur une entrée — UI
  state (open + entryId à lire) à mettre dans actions context.
- **`ClampedJournalContent`** clip 4 lignes max + onClick pour ouvrir
  le reader. Reste un composant dumb avec props (text + onExpand).
- **2 niveaux de groupement** (par mois × par fil). Le `groups` dérivé
  vit dans le filters context comme Library.
- **`splitThreads`** : duplication avec Goals — la garder identique au
  bit près pour faciliter la déduplication future.

### Checklist

- [ ] **1. lib/ + tests**
  - [ ] `lib/types.ts` — `JournalEntry`, `LoadState`, `JournalStats`
  - [ ] `lib/mappers.ts` — `recordToEntry`
  - [ ] `lib/threads.ts` — `splitThreads` + tests
  - [ ] `lib/date-format.ts` — `formatEntryLabel`, `formatMonthLabel`,
        `isoDay`
  - [ ] `lib/stats.ts` — `computeStats`, `countWords` + tests
- [ ] **2. context.tsx** — `JournalProvider` + 3 hooks
- [ ] **3. components/** — `SideColumn`
- [ ] **4. views/** — `PrimaryColumn`, `EntryRow`,
       `ClampedJournalContent`, `ReaderShell`
- [ ] **5. index.tsx final** ≤ 100 LOC

---

## Mood — 1332 lignes → ~14 fichiers

État de départ : le module le plus distinctif — héberge la **heatmap**
(52 × 7 cellules), des sélecteurs année/mois, le calcul de patterns.
~10 helpers purs.

### Spécificités à anticiper

- **Heatmap (`Chart`) est lourd à rendre** — 364 cellules. À surveiller
  : que sa value de contexte ne change pas à chaque toggle de filtre
  inutile. Mémoïser `buildHeatmap(year, entries)` côté provider, pas
  dans le composant.
- **`computePatterns`** calcule des observations textuelles sur les
  données (« meilleur jour de la semaine », tendances). Gros candidat
  Vitest — c'est de la logique de domaine, pas de l'UI.
- **Sélecteurs année / mois** sont du state filtres (mois affiché
  dans la heatmap). Filters context.
- **`buildHeatmap`** est la fonction la plus complexe du module
  (date arithmetic + array building). À tester en priorité.

### Checklist

- [ ] **1. lib/ + tests**
  - [ ] `lib/types.ts` — `MoodEntry`, `LoadState`, `Pattern`,
        `HeatmapCell`, `MonthLabel`
  - [ ] `lib/mappers.ts` — `recordToEntry`, `normalizeScore`,
        `VALID_SCORES`
  - [ ] `lib/constants.ts` — `SCORE_FILL`, `SCORE_LABELS`,
        `SCORE_TONE`, `DAY_NAMES_FR`, `SHORT_MONTHS_FR`,
        `MONTH_LABELS_LONG`, `MONTH_LABELS_SHORT`
  - [ ] `lib/date-format.ts` — `formatEntryLabel`, `toIsoDate`,
        `rangeFor`
  - [ ] `lib/heatmap.ts` — `buildHeatmap` + constantes + tests
        (priorité)
  - [ ] `lib/stats.ts` — `computeAverage30d`, `formatMoodAvg`,
        `computePatterns`, `signedFormat` + tests
- [ ] **2. context.tsx** — `MoodProvider` + 3 hooks
- [ ] **3. components/** — `YearSelector`, `MonthSelector`,
       `SideColumn`, `NoteBadge`
- [ ] **4. views/** — `PrimaryColumn`, `Chart` (heatmap), `EntryRow`
- [ ] **5. index.tsx final** ≤ 100 LOC

---

## Suites cross-modules (post-roadmap)

À garder pour plus tard, **à ne pas faire pendant** le refacto.

- [ ] **`splitThreads`** dupliqué entre Goals et Journal — promouvoir
       dans `packages/shared/src/threads.ts` une fois les deux refacto
       finis. Tests cross-package via `@nodea/shared`.
- [ ] **Date formatters FR** (`ENTRY_SAME_YEAR_FMT` etc.) reviennent
       partout. Candidat pour `core/i18n/date-fr.ts`. Cible : un seul
       endroit qui décide « 12 mars » vs « 12 mars 2024 ».
- [ ] **Pattern « 3 contextes »** identique sur Library / Goals /
       Journal / Mood. Une fois validé sur les 4, envisager une
       factory `createModuleContexts<Data, Filters, Actions>()` —
       seulement si la duplication devient gênante (à peu près 80
       LOC × 4 modules de boilerplate identique).
- [ ] **Lite shapes** (`MoodEntryLite`, `GoalEntryLite`) qui vivent
       dans Homepage redondent les vrais types. Une fois les `lib/
       types.ts` posés, Homepage peut soit les importer, soit dériver
       via `Pick<>` plutôt que les re-déclarer.

---

## Comment cocher

À chaque commit qui livre une étape, ouvre ce fichier, coche la case,
commit le changement de doc dans le même PR. À la fin de chaque
module : la checklist de la section est tout cochée + un dernier
commit ferme la suite (peut être groupé avec l'étape 5).

Référence : commits Library `fc45b07` → `b845403`, branche
`refacto-design-v2`.
