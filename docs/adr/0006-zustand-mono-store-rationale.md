# 0006 — `nodea-store` en un seul fichier vs splitté en plusieurs slices

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)
- **Compagnon de** : [ADR-2 — Zustand single store + per-module React contexts](./0002-zustand-single-store.md), qui décide *qu'on utilise un store global Zustand*. Cet ADR-ci décide *comment ce store est physiquement organisé*.

## Context

Le store Zustand racine vit dans `packages/web/src/core/store/nodea-store.ts`, ~400 LOC, et héberge sept slices nommées :

- **auth** : statut de session, profil utilisateur (`user`).
- **mainKey** : matériel cryptographique en mémoire (`mainKeyMaterial`, `keyStatus`).
- **modules** : table des modules hydratés avec leur sid + guard.
- **flow** : module actif (`currentModule`), sub-views métier.
- **composer** : état du modal Composer global (ouvert/fermé, type, mode édition).
- **mobileMenu** : flag d'ouverture de la sidebar sur mobile.
- **libraryVersions** : compteurs `goalsVersion`, `libraryItemsVersion`, etc. utilisés pour invalider les caches de fetch après mutation.

Zustand permet plusieurs organisations physiques : un seul store contenant toutes les slices (situation actuelle), ou plusieurs stores indépendants exposés via des hooks séparés (`useAuthStore`, `useModulesStore`, etc.). À mesure que le fichier `nodea-store.ts` a grossi, la question revient : faut-il splitter ?

## Decision

**Garder un seul store mono-fichier.** Les slices coexistent dans le même `create()` Zustand et sont lues via des selectors disciplinés (`selectMainKey`, `selectModules`, `selectAuthStatus`, etc.).

## Consequences

**Positives :**
- **Atomicité gratuite quand une action touche plusieurs slices.** Le `login` met à jour `auth.user`, `mainKey.material` et `modules.byId` en un seul `set(...)` — c'est trivialement ordonné et impossible à observer dans un état intermédiaire. En multi-stores, il faudrait soit un système d'événements pour coordonner les trois, soit imposer aux composants de gérer l'état transitoire.
- **Une seule frontière à connaître.** Un nouveau dev apprend `useNodeaStore(selectX)` et c'est tout. Pas à se demander quel store contient quelle slice.
- **Selectors fins.** `useNodeaStore((s) => s.mainKey)` ne re-rend le composant que si `mainKey` change, exactement comme un store dédié l'aurait fait. Le bénéfice perf principal du split est absent.
- **Tests faciles.** `useNodeaStore.setState({ ... })` dans un test seede les slices nécessaires en une ligne.

**Négatives :**
- **Le fichier dépasse 400 LOC.** Lecture moins agréable qu'un fichier de 80 LOC par slice. Mitigé par les commentaires de section dans le fichier et la convention de nommage des selectors.
- **Toute action est techniquement capable de toucher n'importe quelle slice.** Discipline à maintenir : une action `setMobileMenuOpen` ne doit pas toucher `auth`. La revue de code attrape ces dérapages, mais un store dédié aurait rendu la dérapage impossible par construction.
- **Tester un composant qui lit le store demande de bootstrap les slices nécessaires.** Mitigé par `useNodeaStore.setState()` qui permet de seeder explicitement.

## Alternatives considered

- **Un store par slice, exposés via plusieurs hooks** (`useAuthStore`, `useModulesStore`, etc.). Écarté pour la perte d'atomicité multi-slices et pour la complexité de coordination que ça aurait introduite (système d'événements ou orchestrateur global).
- **Slices via `create()(combine(...))`** (le helper Zustand qui sépare le state initial des actions dans des objets distincts). Écarté parce que ça déplace le problème : on a toujours un seul store, juste avec une syntaxe d'écriture différente. Ne résout rien.
- **Migration vers Redux Toolkit avec slices** dans des fichiers séparés. Écarté : RTK ajoute ~30 KB gzip et beaucoup de boilerplate (createSlice, configureStore, types) pour un problème qui n'est pas un problème.

## Quand reconsidérer

Si la frontière entre slices devient floue (deux slices commencent à se référencer mutuellement, ou une action touche systématiquement six slices à la fois), c'est le signal qu'on construit du domaine métier dans le store. À ce moment-là, splitter en stores dédiés ou migrer vers une vraie architecture par domaine métier devient pertinent. Tant qu'on est dans le pattern actuel (slices indépendantes, actions qui touchent 1-3 slices au maximum), garder mono.
