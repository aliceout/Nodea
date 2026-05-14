# 0003 — snake_case ↔ camelCase frontier between server and client

- **Status**: Superseded by [ADR-0012](./0012-camel-case-only-on-the-wire.md)
- **Date**: 2026-02
- **Superseded**: 2026-05 — the "all-camelCase" decision replaced the
  frontier. The content below describes the prior code state and is
  kept as historical context.

## Context

The server (Hono + Drizzle + Postgres) speaks `snake_case` everywhere:
column names (`module_user_id`, `cipher_iv`, `created_at`), JSON
field names emitted as-is (`item_rid`, `cover_rid`). The client
(TypeScript + React) follows the standard JS `camelCase`
convention everywhere (`moduleUserId`, `cipherIv`, `itemRid`).

Three conventions were on the table at the JSX → TS cutover:

1. **All-snake-case**: the client keeps `module_user_id` in its types
   and selectors. Consistent with what seed fixtures and DB payloads
   expose; but rubs against ESLint, React conventions, and the
   TypeScript standard.
2. **All-camelCase**: the server transforms on JSON emission, the
   client stays idiomatic. Cleaner on the client side, but requires a
   server-side mapping layer and breaks the transparency of a direct
   `c.json(row)`.
3. **Explicit frontier**: both conventions coexist, frontier
   documented and enforced by the compiler.

## Decision

**Explicit, documented, and typed frontier.**

- **Server side** (`packages/api/`): everything stays `snake_case` —
  DB columns, JSON payloads on the wire, public Zod schemas. Drizzle
  exposes columns as `camelCase` in TS code (lib convention) but the
  `toView()` in `collection-factory.ts` explicitly re-projects to
  `snake_case` on the HTTP response.
- **Client side** (`packages/web/`):
  - **Encrypted payloads** consumed by the client (encrypted JSON
    out of AES-GCM in the browser) keep the server's `snake_case` —
    the `LibraryItemPayload`, `MoodPayload`, etc. types in
    `@nodea/shared` expose fields as-is (`item_rid`, `cipher_iv`,
    `cover_rid`).
  - **Mappers** in each module (`Library/lib/mappers.ts`,
    `Goals/lib/mappers.ts`, etc.) translate `payload.cipher_iv` →
    `entry.cipherIv` when consuming code expects the JS convention.
    The mapper is the only place where the frontier is crossed.
- **The shared package** (`packages/shared/`) exposes Zod schemas in
  `snake_case` (DB / wire side) **and** TypeScript types derived via
  `z.infer` that inherit the same convention. No `camelCase` field
  shared-side — the web mapper is the one that re-conventions if the
  UI wants it.

## Consequences

**Positive:**
- **No server-side mapping**: `c.json(row)` direct, the server stays
  thin.
- **The encrypted payload is testable**: a test can compare
  `payload.item_rid === 'rid_xxx'` without wondering whether the
  mapper has already run.
- **The frontier is enforced by the compiler**: a dev who writes
  `payload.itemRid` on a `LibraryItemPayload` type gets a tsc error
  — they know they should consume `payload.item_rid` or use the
  mapper.

**Negative:**
- **Cognitive inertia**: a new web-side contributor may wonder why
  `entry.completedAt` (`GoalEntry` post-mapper) coexists with
  `payload.completed_at` (`GoalsPayload` pre-mapper). The rule
  *"types ending in `Payload` are snake_case"* is documented but
  takes a second to absorb.
- **Field duplication** on the client side: for Goals, the encrypted
  payload has `completed_at` and the post-mapper entry has
  `completedAt`. Intended but it can look redundant to a drive-by
  reviewer.
- **The mapper becomes a centralised mutation point**: when a new
  field is added the mapper must be updated. Mitigated by tsc
  yelling at the destructure exhaustiveness.

## Alternatives considered

- **All-camelCase with a Hono middleware** that transforms
  `snake_case` → `camelCase` on JSON emission. Discarded: breaks
  test fixture readability, requires a global layer that has to
  handle encrypted blobs differently from metadata fields (blobs
  must NOT be touched).
- **`type Foo = SnakeCaseToCamel<…>` at the type level**: a purely
  TS transformation via template literal types. Discarded: the
  type-level transformation doesn't help the runtime mapper code,
  and initial writing is heavy.
