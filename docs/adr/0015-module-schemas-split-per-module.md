# 0015 — Split module payload schemas one-file-per-module

- **Status**: Accepted
- **Date**: 2026-06

## Context

The encrypted payload schemas for every feature module (Mood, Goals,
Journal, Habits, Library, Review) lived together in a single file,
`packages/shared/src/schemas/modules.ts`. Each module was a clearly
delimited section (a `// ---- Mood ----` banner, its enums, its
`z.looseObject` schema, its inferred type).

Adding the **HRT** module (three schemas + three enum groups + their
types) pushed that file to **417 LOC** — the largest schema file in the
repo, ahead of `auth.ts` (294). The file only ever grows: every new
module appends a section, and every module that gains a collection
appends a schema. Meanwhile the **auth** schemas next door are already
split one-file-per-flow (`auth-mfa.ts`, `auth-opaque.ts`,
`auth-passkey.ts`, … — a dozen flat files), so the repo had two
conventions for the same directory: auth split, modules monolithic.

The project's page/file-size guidance (CLAUDE.md: « > 200 LOC or ≥ 2
distinct panels → split by responsibility ») applies in spirit to a
shared schema file holding seven independent domains.

## Decision

**Split `schemas/modules.ts` into one file per module under
`schemas/modules/`, re-exported by a flat barrel
`schemas/modules/index.ts`.**

```
schemas/modules/
  mood.ts        goals.ts      journal.ts    habits.ts
  library.ts     review.ts     hrt.ts
  index.ts       <- export * from './mood.ts'; … ; export * from './hrt.ts';
```

The public surface is unchanged: `@nodea/shared` re-exports the barrel,
so every api/web consumer keeps importing module payloads from
`@nodea/shared` and is unaware of the split. Only three internal,
`shared`-local imports moved to the new paths (the top-level barrel,
`hrt-presets.ts`'s `HrtCategory`/`HrtRoute` type import, and the
cross-module `modules.test.ts`).

## Consequences

**Positive:**
- **Each module's payload reads in one focused file** (30–140 LOC) with
  its own file-overview header, instead of scrolling a 400-LOC monolith.
- **Bounded growth.** A new module adds a file + one barrel line; it
  never inflates a shared hot file that the whole app diffs against.
- **One convention in `schemas/`.** Modules now match auth (ADR-0008):
  one file per cohesive unit, flat, barrel-exported. No more « auth is
  split but modules aren't » surprise.
- **Smaller blast radius on review.** A change to Library's schema
  touches `library.ts`, not a file every other module also edits.

**Negative:**
- **A 1→7 split is not a clean `git mv`.** History for most sections is
  a delete+add; `git mv modules.ts modules/library.ts` anchors only the
  largest chunk (Library) and even that may fall under git's rename
  threshold. Accepted: blame continuity on data-shape declarations is
  low-value compared to readability, and the schemas rarely change line
  by line (they're append-mostly).
- **Two hops to read « all module payloads »** (open the dir, pick a
  file) instead of one scroll. Mitigated by the barrel + by the fact
  that you almost never need all seven at once.

## Alternatives considered

- **Flat files in `schemas/` like auth** (`schemas/mood.ts`,
  `schemas/hrt.ts`, …, no `modules/` subdir). Truer to auth's literal
  layout, but it scatters seven sibling files into a directory that
  already holds ~20 auth/admin/envelope files. The `modules/` subdir
  groups the feature-module payloads as a unit while still being
  one-file-per-module — the readability win without the sprawl.
- **Leave it as one file.** Rejected: the file only grows, and the
  next module would push it past 450 LOC. The cost compounds; paying
  the split once is cheaper than re-deciding every module.
- **Extract only HRT** (the new, biggest contributor) and leave the
  other six in `modules.ts`. Rejected: it would create a *third*
  convention (mostly-monolith + one outlier) — strictly worse than
  either consistent option.

## When to revisit

If a future module's payloads are tiny and tightly coupled to another
module's (e.g. a sub-feature that only ever ships with its parent),
co-locating the two in one file is fine — the rule is « one cohesive
unit per file », not « exactly one module per file ». Keep the barrel
as the single import point regardless.
