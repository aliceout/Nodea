# 0012 — All-camelCase on the wire (supersedes 0003)

- **Status**: Accepted (supersedes [ADR-0003](./0003-snake-case-camel-case-frontier.md))
- **Date**: 2026-05

## Context

[ADR-0003](./0003-snake-case-camel-case-frontier.md) enacted a
**frontier**: `snake_case` on the server side (Postgres DB +
JSON payloads emitted as-is) and `camelCase` on the TS client,
with a mapper translating at the boundary. The motivation was
that Drizzle exposed columns as camelCase but the `c.json(row)`
manually re-emitted snake_case, and a web-side mapper was enough
to isolate the JS convention from the rest.

Three things have changed since:

1. **The project is about to gain an external consumer**: the
   mobile chantier is starting. Today the web-side mapper absorbs
   the frontier, but tomorrow the mobile client (Swift / Kotlin)
   would either redo the same mapping or consume an API that
   changes convention per endpoint (`/auth/me` is camelCase,
   `/<module>/records` is snake_case). Both options waste dev
   time for nothing.

2. **An internal audit** flagged the frontier as a "high-severity
   finding — nowhere documented as a contract". The standard
   answer to an undocumented high-severity finding is to either
   pin the convention in the docs or eliminate the need for docs.
   With an imminent external consumer, eliminating is cheaper
   long-term than pinning.

3. **The OpenAPI generator** (a sibling chantier of this ADR)
   feeds Zod schemas into TS / Swift / Kotlin types. If Zod
   schemas land on systematic camelCase, the generated code on
   mobile is idiomatic without manual intervention. With two
   conventions, the generator produces mixed types that the
   client still has to re-map.

## Decision

**All-camelCase on the wire.** Public Zod schemas, JSON payloads
emitted by routes, encrypted-payload schemas (Mood, Goals, etc.)
and TS types derived via `z.infer` use **camelCase only**.

- **DB side** (`packages/api/src/db/schema/*`, `drizzle/*.sql`):
  Postgres columns stay `snake_case`. That's the standard SQL
  convention and changing columns would require a migration
  script. Drizzle keeps exposing columns as `camelCase` via the
  native `name → mappedName` translation — the TS code never
  sees snake_case.
- **Wire side**: routes emit `cipherIv`, `moduleUserId`,
  `updatedAt`, `buildDate` rather than `cipher_iv`,
  `module_user_id`, `updated_at`, `build_date`.
- **Encrypted payloads side**: schemas in
  `packages/shared/src/schemas/modules.ts` (Mood, Goals, Habits,
  Library, Review) use `moodScore`, `completedAt`, `itemRid`,
  `coverRid`, `lastYear`, etc. rather than `mood_score`,
  `completed_at`, etc. Old entries encrypted with the old names
  are **not re-decryptable after this migration** — the project
  has no prod users beyond the dev account, which can be
  truncated and re-seeded.

The web-side mapper (`Library/lib/mappers.ts`, etc.)
**disappears**: with a single convention, there's nothing left
for it to translate.

## Consequences

**Positive:**
- **One convention, no mapper.** TS code reading a decrypted
  payload accesses `entry.completedAt` directly — no more double
  `GoalsPayload` (snake) + `GoalEntry` (camel) types to maintain
  in parallel.
- **The mobile client is idiomatic on its own.** Whether the
  OpenAPI generator outputs Swift or Kotlin, the generated types
  match the target language's native convention (Swift / Kotlin
  are both camelCase).
- **The API-01 audit is resolved without creating
  `documentation/API.md`** — the "all-camelCase" convention
  documents itself as the code is read.

**Negative:**
- **Breaking migration** on existing encrypted blobs: a user with
  Goals entries holding `completed_at` snake_case can no longer
  decrypt them after the schema migration (Zod's `passthrough()`
  lets unknown fields through, but consuming code reads
  `entry.completedAt`, not `entry.completed_at`). Acceptable
  because the project is still at the "solo dev on their own
  account" stage — entries can be deleted and recreated.
- **The DB ↔ TS frontier stays implicit.** The Drizzle convention
  (`name: 'snake_case'` mapping to `mappedName: camelCase`)
  upholds this contract without human intervention, but a
  newcomer needs to know that `users.cipherIv` in code =
  `users.cipher_iv` in SQL. Mitigated by `db/schema/*.ts` files
  exposing both names side by side.

## Alternatives considered

- **Keep the frontier (ADR-0003 unchanged)** + create
  `documentation/API.md` documenting the duality. Discarded:
  adds a doc file to maintain, doesn't remove the double
  convention the mobile client will have to consume.
- **Migrate only the wire wrapper (`cipher_iv` → `cipherIv`)
  without touching encrypted payloads.** Discarded: leaves
  `completed_at`, `item_rid`, etc. as snake_case inside the
  encrypted payloads the mobile client will have to consume; the
  web-side mapper stays needed; only half the problem solved.
- **URL versioning (`/v1/...` snake_case + `/v2/...` camelCase
  coexisting)**. Discarded earlier by user decision (cf. Tier 4
  Phase 2 discussion): a solo-maintainer is incompatible with
  maintaining two parallel versions.
