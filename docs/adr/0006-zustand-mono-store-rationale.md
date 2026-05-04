# 0006 — `nodea-store` as a single file vs split across slices

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)
- **Companion to**: [ADR-2 — Zustand single store + per-module React contexts](./0002-zustand-single-store.md),
  which decides *that we use a global Zustand store*. This ADR
  decides *how that store is physically organised*.

## Context

The root Zustand store lives in
`packages/web/src/core/store/nodea-store.ts`, ~400 LOC, and hosts
seven named slices:

- **auth**: session status, user profile (`user`).
- **mainKey**: in-memory crypto material (`mainKeyMaterial`,
  `keyStatus`).
- **modules**: table of hydrated modules with their sid + guard.
- **flow**: active module (`currentModule`), business sub-views.
- **composer**: state of the global Composer modal (open/closed,
  type, edit mode).
- **mobileMenu**: open flag for the mobile sidebar.
- **libraryVersions**: counters `goalsVersion`,
  `libraryItemsVersion`, etc. used to invalidate fetch caches
  after a mutation.

Zustand allows several physical organisations: one store with all
slices (current state), or several independent stores exposed via
separate hooks (`useAuthStore`, `useModulesStore`, etc.). As the
`nodea-store.ts` file grew, the question keeps coming back: should
we split it?

## Decision

**Keep one mono-file store.** Slices coexist inside the same
Zustand `create()` and are read via disciplined selectors
(`selectMainKey`, `selectModules`, `selectAuthStatus`, etc.).

## Consequences

**Positive:**
- **Free atomicity when an action touches multiple slices.**
  `login` updates `auth.user`, `mainKey.material`, and
  `modules.byId` in a single `set(...)` — trivially ordered and
  impossible to observe in an intermediate state. In a multi-store
  setup, we'd need either an event bus to coordinate the three, or
  to push the transitional state burden onto components.
- **One boundary to know.** A new dev learns
  `useNodeaStore(selectX)` and that's it. No wondering which store
  contains which slice.
- **Fine-grained selectors.**
  `useNodeaStore((s) => s.mainKey)` only re-renders the component
  on `mainKey` changes, exactly as a dedicated store would. The
  main perf benefit of splitting is moot.
- **Easy tests.** `useNodeaStore.setState({ ... })` in a test
  seeds the necessary slices in one line.

**Negative:**
- **The file passes 400 LOC.** Less pleasant to read than an
  80 LOC per-slice file. Mitigated by section comments in the
  file and the selector naming convention.
- **Any action is technically able to touch any slice.**
  Discipline required: a `setMobileMenuOpen` action must not touch
  `auth`. Code review catches these slips, but a dedicated store
  would make the slip impossible by construction.
- **Testing a component that reads the store requires bootstrapping
  the necessary slices.** Mitigated by `useNodeaStore.setState()`
  which allows explicit seeding.

## Alternatives considered

- **One store per slice, exposed via several hooks**
  (`useAuthStore`, `useModulesStore`, etc.). Discarded for the
  loss of multi-slice atomicity and for the coordination
  complexity it would have introduced (event bus or global
  orchestrator).
- **Slices via `create()(combine(...))`** (the Zustand helper
  that separates initial state from actions in distinct objects).
  Discarded because it moves the problem: still one store, just
  with a different writing syntax. Solves nothing.
- **Migrate to Redux Toolkit with slices** in separate files.
  Discarded: RTK adds ~30 KB gzip and a lot of boilerplate
  (createSlice, configureStore, types) for a problem that isn't
  one.

## When to revisit

If the boundary between slices gets fuzzy (two slices start
referencing each other, or an action systematically touches six
slices at once), that's the signal that domain logic is leaking
into the store. At that point, splitting into dedicated stores or
migrating to a real domain-driven architecture becomes relevant.
While we're in the current pattern (independent slices, actions
touching 1-3 slices max), keep mono.
