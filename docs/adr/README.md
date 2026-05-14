# Architecture Decision Records

This folder holds the **ADRs** (Architecture Decision Records) for
the Nodea project. An ADR is a short note that documents **one
technical decision** taken at a given point in time, **the context**
that motivated it, **the alternatives considered**, and **the
consequences** accepted.

## Why?

Without ADRs, architectural decisions live in scattered code comments,
PR discussions, or in the memory of whoever made them. When someone
(you in 6 months, a future maintainer, a drive-by contributor) wonders
*"why didn't we use X here, it would've been simpler?"*, the answer
must be **findable in under 30 seconds**, without grepping the code
or asking.

ADRs live next to the code (`docs/adr/`) rather than on an external
wiki for two reasons:
1. **They're versioned with the code.** The historical context stays
   coherent with the repo state at decision time.
2. **A PR that changes the decision updates the ADR in the same
   commit.** The ADR never silently turns wrong.

## Format

We follow the [MADR](https://adr.github.io/madr/) format (Markdown
ADR), simplified. Each ADR contains:

- **Status**: `Accepted`, `Superseded by ADR-XXXX`, or `Deprecated`.
  Once `Accepted`, we don't rewrite the ADR: we create a new one
  that supersedes it.
- **Context**: what we were trying to solve, the constraints in
  play.
- **Decision**: the decision taken, framed in one or two sentences.
- **Consequences**: the trade-offs we accept (positive and negative).
- **Alternatives considered** *(optional)*: the discarded options,
  with one line stating why.

## Naming convention

`NNNN-short-kebab-case-title.md` where `NNNN` is a 4-digit number
incremented monotonically. No reuse after `Deprecated` — one number
= one decision in time.

## Index

| # | Title | Status |
|---|---|---|
| [0001](./0001-layered-hybrid-architecture.md) | Hybrid layered architecture (layered + feature-first) | Accepted |
| [0002](./0002-zustand-single-store.md) | Zustand single store + per-module React contexts | Accepted |
| [0003](./0003-snake-case-camel-case-frontier.md) | snake_case ↔ camelCase frontier between server and client | Superseded by [0012](./0012-camel-case-only-on-the-wire.md) |
| [0004](./0004-no-request-cache.md) | No request cache (TanStack Query, SWR, etc.) | Accepted |
| [0005](./0005-no-ssr.md) | No SSR — pure CSR, single-page application | Accepted |
| [0006](./0006-zustand-mono-store-rationale.md) | `nodea-store` as a single file vs split across slices | Accepted |
| [0007](./0007-hand-rolled-api-client.md) | Web API client: 14 dedicated functions vs Hono's `hc<AppType>` | Accepted |
| [0008](./0008-auth-routes-flat.md) | Flat `auth/` folder rather than layered | Accepted |
| [0009](./0009-library-lookup-as-service.md) | `library-lookup` moved to `services/library-lookup/` | Accepted |
| [0010](./0010-getconfig-singleton.md) | `getConfig()` as a global singleton | Accepted |
| [0011](./0011-drizzle-forward-only-migrations.md) | Drizzle forward-only migrations, no rollback | Accepted |
| [0012](./0012-camel-case-only-on-the-wire.md) | All-camelCase on the wire (supersedes 0003) | Accepted |
| [0013](./0013-zustand-slice-pattern.md) | Zustand slice pattern for `nodea-store` (complements 0006) | Accepted |

## When to write a new ADR

A change is worth an ADR if **one** of the following holds:

- The decision affects **more than one file** or **more than one
  layer** of the project.
- A reasonable alternative exists and was discarded for a
  non-trivial reason.
- Someone, in 6 months, will be tempted to revisit the decision
  without the context.

No need for an ADR for: picking an isolated utility lib, renaming,
local refactoring, bug fixes.
