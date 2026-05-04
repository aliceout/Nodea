# 0001 — Hybrid layered architecture (layered + feature-first)

- **Status**: Accepted
- **Date**: 2026-01 (JSX → TS cutover, Auth-Roadmap Phase 1)

## Context

The historical project lived under a purely **layer-by-type**
organisation (`pages/`, `components/`, `hooks/`, `services/`) — the
standard React 16 convention. As the business modules (Mood, Goals,
Library, Journal, Habits, Review) grew, two problems emerged:

1. **Modules became "scattered clients"**: to understand how Library
   worked you had to bounce between `pages/Library.jsx`,
   `components/library/*`, `hooks/useLibrary.js`,
   `services/library-api.js`. No folder represented the whole.
2. **Shared components got drowned**: `components/Button.jsx`
   (reusable UI atom) and `components/MoodScoreBar.jsx`
   (Mood-specific) lived at the same level with no reusability
   signal.

The team considered three alternatives:

- **Pure feature-first** (`features/library/*`, `features/goals/*`
  with everything inside) — but this either duplicates UI primitives
  inside each feature or creates a `shared/` catch-all.
- **Pure layered** (the existing situation) — already identified as
  problematic.
- **Hybrid layered + feature-first** — technical layers for infra
  (`core/`, `ui/`) + one folder per business module.

## Decision

**Adopt a hybrid organisation**:

- `packages/web/src/core/` — cross-cutting infra layer: crypto,
  store, API client, auth, modules registry, i18n. No knowledge of
  business modules.
- `packages/web/src/ui/` — reusable UI primitives, organised as
  `atoms/` (Button, Input, Field…) and `dirk/` (composed components
  for the Nodea-specific Direction K design system). No knowledge
  of a business module.
- `packages/web/src/app/flow/<Module>/` — one folder per
  authenticated business module. Contains module-specific
  `context.tsx` (or `state/` since REFACTO-08), `views/`,
  `components/`, and `lib/`. Can consume `core/` and `ui/` but never
  the reverse.
- `packages/web/src/app/pages/` — public pages (auth, docs) outside
  the modular flow — their lifecycle is independent and their URL
  is exposed.

The import rule is unidirectional: `app/flow/<Module>` → `core/`,
`ui/`, `app/pages/` → `core/`, `ui/`. Never the reverse.

## Consequences

**Positive:**
- **Per-module discovery**: opening `app/flow/Library/` shows
  everything that makes up Library.
- **Explicit reusability**: `ui/atoms/` cannot depend on a module —
  no hidden coupling.
- **Newcomer**: the `core` / `ui` / `module` boundary is a usable
  mental map in 5 minutes.

**Negative:**
- **`lib/` (web root) vs `core/utils/` boundary**: created
  accidentally during the cutover, never arbitrated.
- **Temptation to drop "almost-atoms"** in
  `app/flow/<Module>/components/` instead of promoting them to
  `ui/`. Mitigated by the CLAUDE.md *"reuse before creating"* rule.
- **Learning cost** for someone used to pure feature-first: needs
  to understand that `ui/atoms/` is not a "shared catch-all".

## Alternatives considered

- **Pure feature-first à la Next.js 14 `app/`** — discarded:
  duplicates primitives or creates a `_shared/` catch-all. Fine for
  a 1-2 feature app, heavy at 6 modules.
- **Strict Domain-Driven Design (entities/aggregates/repositories)**
  — overkill for an E2EE SPA. The server just does encrypted CRUD,
  no complex domain logic.
