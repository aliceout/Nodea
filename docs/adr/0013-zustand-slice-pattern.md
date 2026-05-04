# 0013 — Slice pattern Zustand pour `nodea-store`

- **Status** : Accepted
- **Date** : 2026-05
- **Compagnon de** : [ADR-0006 — `nodea-store` en un seul fichier vs splitté en plusieurs slices](./0006-zustand-mono-store-rationale.md), qui décide *que le store reste mono-instance pour préserver l'atomicité multi-slices*. ADR-0006 reste la décision parente non remise en cause : on ne change pas le nombre de stores. Cet ADR-ci décide *comment ce store unique est physiquement organisé sur disque*.

## Context

Le store Zustand racine, `packages/web/src/core/store/nodea-store.ts`, hébergeait neuf slices (`auth`, `crypto`, `modules`, `preferences`, `notifications`, `ui` (drawer mobile), `flow`, `composer`, `versions` — cinq compteurs `bumpXVersion`) dans un seul fichier de **415 LOC**. Le plafond pratique du repo, documenté dans la mémoire onboarding, est de **200-300 LOC par fichier de composant ou de module**, à splitter avant d'y arriver et non après.

ADR-0006 avait formulé la décision sous l'angle *« un store ou plusieurs ? »* et conclu mono-store pour l'atomicité du `set` lors d'actions multi-slices (le `login` qui touche `auth`, `crypto` et `modules` en une seule transaction, par exemple). Cette analyse n'avait pas explicitement comparé la troisième option offerte par Zustand : **un seul store, mais réparti sur plusieurs fichiers via le slice pattern** ([Zustand docs — Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)).

Dans le slice pattern, chaque slice expose un `StateCreator<RootState, [], [], TheSlice>` qui reçoit le `set` / `get` partagés et retourne son sous-état + ses actions. L'assembly file fait un `create<RootState>()((...a) => ({ ...createAuthSlice(...a), ...createCryptoSlice(...a), … }))`. Le store reste unique, le `set` reste partagé — l'atomicité d'ADR-0006 est préservée par construction. Seule la répartition sur disque change.

## Decision

**Adopter le slice pattern Zustand.** Un seul `create()`, plusieurs `createXSlice` répartis dans `packages/web/src/core/store/slices/*.ts`, assemblés via spread dans `nodea-store.ts`. Les selectors sont regroupés dans `packages/web/src/core/store/selectors.ts`. La surface publique de `@/core/store/nodea-store` reste strictement identique : tous les imports existants (~30 fichiers consommateurs) continuent de pointer sur le barrel.

Structure finale :

```
packages/web/src/core/store/
├── nodea-store.ts         ← assembly + resetAll + re-exports (~150 LOC)
├── selectors.ts           ← selectX regroupés (~40 LOC)
└── slices/
    ├── auth.ts            ← SessionUser, AuthStatus, AuthSlice
    ├── crypto.ts          ← KeyStatus, CryptoSlice
    ├── modules.ts         ← ModuleRuntimeEntry, ModulesRuntime, ModulesSlice
    ├── preferences.ts     ← PreferencesSlice
    ├── notifications.ts   ← ToastNotification, NotificationsSlice
    ├── ui.ts              ← UiSlice (mobileMenuOpen)
    ├── flow.ts            ← LIBRARY_SUBVIEWS, isLibrarySubview, FlowSlice
    ├── composer.ts        ← ComposerType, ComposerEditing, ComposerSlice
    └── versions.ts        ← VersionsSlice (5 compteurs + bumpers)
```

Chaque slice file expose son `interface XSlice`, son `createXSlice` typé contre `NodeaState` (pour pouvoir lire les autres slices via `get()` au besoin, même si c'est rare), et les types/constantes/type-guards qui lui appartiennent conceptuellement (par exemple `flow.ts` est propriétaire de `LIBRARY_SUBVIEWS` + `isLibrarySubview`).

L'assembly file `nodea-store.ts` :
- Définit `interface NodeaState extends AuthSlice, CryptoSlice, …, VersionsSlice { resetAll(): void }`.
- Construit le store via `create<NodeaState>()((...a) => ({ ...createAuthSlice(...a), …, resetAll: () => set({…}) }))`.
- Re-exporte la surface publique (slice types, selectors, helpers `MODULE_IDS` / `isModuleId` / etc.) pour préserver les imports des consommateurs.

L'action `resetAll` reste dans l'assembly file, pas dans une slice : elle touche toutes les slices d'un coup et c'est précisément là que vit la garantie d'atomicité d'ADR-0006.

## Consequences

**Positives :**
- **Plafond LOC respecté.** Plus aucun fichier du store ne dépasse 150 LOC ; les slices oscillent entre 21 et 94 LOC. Le repo retrouve la lisibilité que ADR-0006 reconnaissait comme le seul vrai inconvénient du mono-fichier.
- **Pattern explicite pour ajouter une slice.** Un nouveau slice = un nouveau fichier sibling dans `slices/`, un import + un spread dans l'assembly, une re-export depuis le barrel si elle expose des types publics. Pas de tentation de tout entasser dans un seul fichier.
- **Selectors regroupés.** Les `selectX` étaient en fin de monolithe et passaient inaperçus ; les avoir dans leur propre fichier les rend découvrables (un dev qui ajoute un selector voit immédiatement les conventions des voisins, notamment la règle "primitives plutôt qu'objets").
- **Atomicité préservée.** Le `set` est partagé entre tous les slices via l'argument `(...a)` passé à chaque `createXSlice`. Le `resetAll` reste un seul `set({…})` qui touche les neuf slices en une transaction.
- **Surface publique inchangée.** Aucun consommateur n'a eu à modifier ses imports. La migration est zéro-impact pour le reste du codebase.

**Négatives :**
- **Neuf fichiers à parcourir** au lieu d'un seul. Un dev qui cherche *« où vit `bumpGoalsVersion` »* doit savoir que c'est dans `slices/versions.ts`. Mitigation : le re-export depuis le barrel `nodea-store.ts` garantit qu'il y a **un seul import path public** (`@/core/store/nodea-store`), donc l'IDE résout le symbole en un click — la fragmentation n'est visible que si on ouvre l'arborescence.
- **Couplage typage circulaire** entre slices et assembly. Chaque slice file fait `import type { NodeaState } from '../nodea-store.ts'`, et `nodea-store.ts` importe le runtime des slices. C'est un cycle uniquement *au niveau des types* (effacé à la compilation), donc sans incidence à l'exécution. TypeScript le résout sans avertissement, mais c'est un point d'attention si quelqu'un est tenté d'importer un runtime de slice depuis un autre slice file (à éviter — passer par `get()` à la place).
- **Discipline des cross-slice references à maintenir.** Le pattern donne à chaque slice creator un `set` / `get` qui voient toute `NodeaState`. Rien n'empêche techniquement `createAuthSlice` de muter `crypto.main`. La revue de code reste l'unique garde-fou — comme dans le monolithe précédent.

## Alternatives considered

- **Garder un seul fichier (status quo).** Écarté : le fichier dépasse déjà le plafond LOC documenté, et la trajectoire est mauvaise (chaque nouvelle slice ajoute 30-80 LOC). ADR-0006 avait déjà identifié la lecture moins agréable comme l'unique vraie négative — le slice pattern résout exactement ce point sans rien sacrifier.
- **Splitter en stores indépendants** (un `useAuthStore`, un `useModulesStore`, etc.). Déjà rejeté par ADR-0006 pour la perte d'atomicité multi-slices et la complexité de coordination que ça aurait introduite (système d'événements ou orchestrateur global). Cette décision tient.
- **`combine()` helper Zustand.** Sépare le state initial des actions dans des objets distincts, mais ne change pas la répartition sur disque — on aurait toujours un seul fichier. Ne résout pas le problème de LOC. Écarté.
- **Migration vers Redux Toolkit avec slices.** RTK ajoute ~30 KB gzip et beaucoup de boilerplate (`createSlice`, `configureStore`, types) pour un problème que le slice pattern Zustand résout en ~10 lignes par fichier. Écarté pour les mêmes raisons que dans ADR-0006.

## Quand reconsidérer

Mêmes signaux que ADR-0006 : si la frontière entre slices devient floue (deux slices commencent à se référencer mutuellement via `get()`, ou une action touche systématiquement six slices à la fois), c'est le signal qu'on construit du domaine métier dans le store. À ce moment-là, splitter en stores dédiés ou migrer vers une vraie architecture par domaine devient pertinent. Tant qu'on est dans le pattern actuel (slices indépendantes, actions qui touchent 1-3 slices au maximum, `resetAll` comme seule véritable action multi-slice), le slice pattern reste l'organisation la plus propre.
