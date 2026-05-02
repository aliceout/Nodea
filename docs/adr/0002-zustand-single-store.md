# 0002 — Zustand single store + per-module React contexts

- **Status** : Accepted
- **Date** : 2026-01

## Context

Nodea a deux besoins d'état distincts :

1. **État global durable** : session utilisateur, clé maîtresse en mémoire (`mainKey`), modules hydratés, module actif, préférences UI (thème, sidebar mobile), versions de cache-bust pour forcer un refetch (`goalsVersion`, `libraryItemsVersion`, …). Cet état est partagé entre dizaines de composants à toutes les profondeurs.
2. **État local par module** : pour Library, les `items` / `reviews` / `covers` chargés, les filtres actifs, le picker de review ouvert. Pour Goals, les `entries`, le `statusFilter`, la dialog `carryOver`. Cet état n'est jamais consommé en dehors du module.

L'équipe a hésité entre :

- **Tout en Zustand**, avec un store par slice ou un store mono-fichier.
- **Tout en React Context**, plusieurs providers imbriqués.
- **Hybride** : Zustand pour le global, Context pour le per-module.

## Decision

**Hybride : un seul store Zustand pour tout l'état global, des contextes React par module pour l'état page-local.**

- **Le store Zustand** vit dans [`packages/web/src/core/store/nodea-store.ts`](../../packages/web/src/core/store/nodea-store.ts). Un seul fichier, ~7 slices nommées (auth, mainKey, modules, flow, composer, mobileMenu, libraryVersions). Les selectors disciplinés (`selectMainKey`, `selectModules`, etc.) évitent les re-renders inutiles.
- **Les contextes React** vivent dans `packages/web/src/app/flow/<Module>/context.tsx`. Chaque module crée TROIS contextes via `createModuleContexts<Data, Filters, Actions>('Module')` — un consommateur qui n'a besoin que des actions ne re-render pas quand les data ou les filtres bougent.

## Consequences

**Positives :**
- **Frontière claire** : si l'état est consommé hors du module, il est dans le store ; sinon il est dans le contexte du module. Pas d'ambiguïté.
- **Les modules restent lazy-chargés** : leur state n'est pas dans le store global, donc charger Library ne réveille pas Goals.
- **Les sélecteurs Zustand sont fins** : `useNodeaStore((s) => s.mainKey)` ne re-render que sur changement de mainKey. Les dispatches sont stables (pas d'identity thrash).
- **Pas de besoin de Redux Toolkit / RTK Query** : le store est petit, les selectors trivialisent les middlewares.

**Négatives :**
- **Le store mono-fichier dépasse 400 LOC** — flaggé en [ARCH-03](../roadmap/architecture.md) comme « subjectif, à figer en ADR ». L'argument *« splitter en 7 stores »* a été examiné : couvrirait peu de gains réels (les selectors marchent déjà), introduirait du wiring, casserait la garantie d'atomicité d'une seule opération qui touche plusieurs slices.
- **Tester un composant qui lit le store** demande de bootstrap le store complet. Mitigé : les tests unitaires utilisent `useNodeaStore.setState()` pour seeder explicitement les slices nécessaires.
- **Les contextes par module ne sont pas testables en isolation** sans mounter un Provider. Mitigé en REFACTO-08 : les hooks `state/use-X-data.ts`, `state/use-X-filters.ts`, `state/use-X-actions.ts` peuvent être appelés depuis un test unitaire sans le Provider.

## Alternatives considered

- **Pure Zustand multi-stores** — un store par module. Écarté : duplique le wiring de hydratation et complique la cross-référence module ↔ module via les versions de cache-bust.
- **Pure React Context global** — un méga-Provider à la racine. Écarté : un changement de `mainKey` re-renderait toute l'app puisque Context ne fait pas de selectors fins.
- **Redux + Redux Toolkit** — bonne stack, mais boilerplate disproportionné pour une SPA single-instance E2EE. Zustand fait le même travail en 1/5 du code.
