# 0013 — Zustand slice pattern for `nodea-store`

- **Status**: Accepted
- **Date**: 2026-05
- **Companion to**: [ADR-0006 — `nodea-store` as a single file vs split across slices](./0006-zustand-mono-store-rationale.md),
  which decides *that the store stays single-instance to preserve
  multi-slice atomicity*. ADR-0006 is the parent decision and is
  not revisited: the number of stores doesn't change. This ADR
  decides *how that single store is physically organised on disk*.

## Context

The root Zustand store, `packages/web/src/core/store/nodea-store.ts`,
hosted nine slices (`auth`, `crypto`, `modules`, `preferences`,
`notifications`, `ui` (mobile drawer), `flow`, `composer`,
`versions` — five `bumpXVersion` counters) in a single **415 LOC**
file. The repo's practical ceiling, documented in onboarding
memory, is **200-300 LOC per component or module file**, to split
before reaching it, not after.

ADR-0006 framed the decision as *"one store or many?"* and
concluded mono-store for the atomicity of `set` during multi-slice
actions (the `login` that touches `auth`, `crypto`, and `modules`
in a single transaction, for example). That analysis hadn't
explicitly compared the third option Zustand offers: **a single
store, but spread across multiple files via the slice pattern**
([Zustand docs — Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)).

In the slice pattern, each slice exposes a
`StateCreator<RootState, [], [], TheSlice>` that receives the
shared `set` / `get` and returns its sub-state + actions. The
assembly file does
`create<RootState>()((...a) => ({ ...createAuthSlice(...a), ...createCryptoSlice(...a), … }))`.
The store stays single, the `set` stays shared — ADR-0006's
atomicity is preserved by construction. Only the on-disk layout
changes.

## Decision

**Adopt the Zustand slice pattern.** A single `create()`,
multiple `createXSlice` spread across
`packages/web/src/core/store/slices/*.ts`, assembled via spread in
`nodea-store.ts`. Selectors are grouped in
`packages/web/src/core/store/selectors.ts`. The public surface of
`@/core/store/nodea-store` stays strictly identical: every existing
import (~30 consumers) keeps pointing at the barrel.

Final structure:

```
packages/web/src/core/store/
├── nodea-store.ts         ← assembly + resetAll + re-exports (~150 LOC)
├── selectors.ts           ← selectX grouped (~40 LOC)
└── slices/
    ├── auth.ts            ← SessionUser, AuthStatus, AuthSlice
    ├── crypto.ts          ← KeyStatus, CryptoSlice
    ├── modules.ts         ← ModuleRuntimeEntry, ModulesRuntime, ModulesSlice
    ├── preferences.ts     ← PreferencesSlice
    ├── notifications.ts   ← ToastNotification, NotificationsSlice
    ├── ui.ts              ← UiSlice (mobileMenuOpen)
    ├── flow.ts            ← LIBRARY_SUBVIEWS, isLibrarySubview, FlowSlice
    ├── composer.ts        ← ComposerType, ComposerEditing, ComposerSlice
    └── versions.ts        ← VersionsSlice (5 counters + bumpers)
```

Each slice file exposes its `interface XSlice`, its `createXSlice`
typed against `NodeaState` (so it can read other slices via `get()`
when needed, even if rare), and the types/constants/type-guards
that conceptually belong to it (e.g. `flow.ts` owns
`LIBRARY_SUBVIEWS` + `isLibrarySubview`).

The assembly file `nodea-store.ts`:
- Defines `interface NodeaState extends AuthSlice, CryptoSlice, …, VersionsSlice { resetAll(): void }`.
- Builds the store via
  `create<NodeaState>()((...a) => ({ ...createAuthSlice(...a), …, resetAll: () => set({…}) }))`.
- Re-exports the public surface (slice types, selectors, helpers
  `MODULE_IDS` / `isModuleId` / etc.) to preserve consumer
  imports.

The `resetAll` action stays in the assembly file, not in a slice:
it touches every slice at once and that's precisely where
ADR-0006's atomicity guarantee lives.

## Consequences

**Positive:**
- **LOC ceiling respected.** No store file exceeds 150 LOC
  anymore; slices range between 21 and 94 LOC. The repo recovers
  the readability ADR-0006 acknowledged as the only real downside
  of the mono-file.
- **Explicit pattern for adding a slice.** A new slice = a new
  sibling file in `slices/`, an import + a spread in the
  assembly, a re-export from the barrel if it exposes public
  types. No temptation to dump everything in a single file.
- **Selectors grouped.** `selectX` were at the bottom of the
  monolith and went unnoticed; having them in their own file
  makes them discoverable (a dev adding a selector immediately
  sees the neighbours' conventions, especially the "primitives
  rather than objects" rule).
- **Atomicity preserved.** `set` is shared across every slice via
  the `(...a)` argument passed to each `createXSlice`. `resetAll`
  stays a single `set({…})` touching the nine slices in one
  transaction.
- **Public surface unchanged.** No consumer had to update
  imports. The migration is zero-impact on the rest of the
  codebase.

**Negative:**
- **Nine files to navigate** instead of one. A dev looking for
  *"where does `bumpGoalsVersion` live?"* needs to know it's in
  `slices/versions.ts`. Mitigation: re-exporting from the
  `nodea-store.ts` barrel guarantees a **single public import
  path** (`@/core/store/nodea-store`), so the IDE resolves the
  symbol in one click — fragmentation is only visible when
  opening the tree.
- **Circular type coupling** between slices and assembly. Each
  slice file does
  `import type { NodeaState } from '../nodea-store.ts'`, and
  `nodea-store.ts` imports the runtime of the slices. It's a
  cycle only *at the type level* (erased at compile time), with
  no runtime impact. TypeScript resolves it without warnings, but
  it's a watch-out if someone is tempted to import a slice's
  runtime from another slice file (avoid — go through `get()`
  instead).
- **Cross-slice reference discipline to maintain.** The pattern
  gives each slice creator a `set` / `get` that sees all of
  `NodeaState`. Nothing technically prevents `createAuthSlice`
  from mutating `crypto.main`. Code review remains the only
  guardrail — same as in the previous monolith.

## Alternatives considered

- **Keep a single file (status quo).** Discarded: the file
  already exceeded the documented LOC ceiling, and the trajectory
  was bad (every new slice added 30-80 LOC). ADR-0006 had
  already identified the less-pleasant reading as the only real
  downside — the slice pattern fixes exactly that point without
  sacrificing anything.
- **Split into independent stores** (a `useAuthStore`, a
  `useModulesStore`, etc.). Already rejected by ADR-0006 for the
  loss of multi-slice atomicity and the coordination complexity
  it would have introduced (event bus or global orchestrator).
  That decision stands.
- **Zustand's `combine()` helper.** Splits initial state from
  actions in distinct objects, but doesn't change the on-disk
  layout — we'd still have a single file. Doesn't solve the LOC
  problem. Discarded.
- **Migrate to Redux Toolkit with slices.** RTK adds ~30 KB gzip
  and a lot of boilerplate (`createSlice`, `configureStore`,
  types) for a problem the Zustand slice pattern solves in ~10
  lines per file. Discarded for the same reasons as in ADR-0006.

## When to revisit

Same signals as ADR-0006: if the boundary between slices gets
fuzzy (two slices start referencing each other via `get()`, or an
action systematically touches six slices at once), that's the
signal that domain logic is leaking into the store. At that
point, splitting into dedicated stores or migrating to a real
domain-driven architecture becomes relevant. While we're in the
current pattern (independent slices, actions touching 1-3 slices
max, `resetAll` as the only true multi-slice action), the slice
pattern stays the cleanest organisation.
