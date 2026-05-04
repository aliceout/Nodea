# 0002 — Zustand single store + per-module React contexts

- **Status**: Accepted
- **Date**: 2026-01

## Context

Nodea has two distinct state needs:

1. **Global durable state**: user session, in-memory main key
   (`mainKey`), hydrated modules, active module, UI prefs (theme,
   mobile sidebar), cache-bust versions to force a refetch
   (`goalsVersion`, `libraryItemsVersion`, …). This state is shared
   across dozens of components at every depth.
2. **Per-module local state**: for Library, the loaded `items` /
   `reviews` / `covers`, active filters, the review picker open
   state. For Goals, the `entries`, the `statusFilter`, the
   `carryOver` dialog. This state is never consumed outside the
   module.

The team hesitated between:

- **All Zustand**, with one store per slice or a single mono-file
  store.
- **All React Context**, several nested providers.
- **Hybrid**: Zustand for global, Context for per-module.

## Decision

**Hybrid: a single Zustand store for all global state, per-module
React contexts for page-local state.**

- **The Zustand store** lives in
  [`packages/web/src/core/store/nodea-store.ts`](../../packages/web/src/core/store/nodea-store.ts).
  One file, ~7 named slices (auth, mainKey, modules, flow,
  composer, mobileMenu, libraryVersions). Disciplined selectors
  (`selectMainKey`, `selectModules`, etc.) avoid unnecessary
  re-renders.
- **The React contexts** live in
  `packages/web/src/app/flow/<Module>/context.tsx`. Each module
  creates THREE contexts via
  `createModuleContexts<Data, Filters, Actions>('Module')` — a
  consumer that only needs the actions doesn't re-render when data
  or filters change.

## Consequences

**Positive:**
- **Clear boundary**: if state is consumed outside the module, it's
  in the store; otherwise it's in the module context. No ambiguity.
- **Modules stay lazy-loaded**: their state is not in the global
  store, so loading Library doesn't wake up Goals.
- **Zustand selectors are fine-grained**:
  `useNodeaStore((s) => s.mainKey)` only re-renders on mainKey
  changes. Dispatches are stable (no identity thrash).
- **No need for Redux Toolkit / RTK Query**: the store is small,
  selectors trivialise middleware.

**Negative:**
- **The mono-file store passes 400 LOC** — subjective, ADR-pinned.
  The *"split into 7 stores"* argument was examined: would deliver
  little real gain (selectors already work), would introduce wiring,
  and would break the atomicity guarantee of a single operation
  touching multiple slices.
- **Testing a component that reads the store** requires
  bootstrapping the full store. Mitigated: unit tests use
  `useNodeaStore.setState()` to explicitly seed the necessary
  slices.
- **Per-module contexts aren't testable in isolation** without
  mounting a Provider. Mitigated in REFACTO-08: the
  `state/use-X-data.ts`, `state/use-X-filters.ts`,
  `state/use-X-actions.ts` hooks can be called from a unit test
  without the Provider.

## Alternatives considered

- **Pure Zustand multi-store** — one store per module. Discarded:
  duplicates hydration wiring and complicates cross-module
  references via cache-bust versions.
- **Pure React Context global** — a single root mega-Provider.
  Discarded: a change to `mainKey` would re-render the whole app
  since Context doesn't do fine-grained selectors.
- **Redux + Redux Toolkit** — good stack, but disproportionate
  boilerplate for a single-instance E2EE SPA. Zustand does the
  same job in 1/5 the code.
