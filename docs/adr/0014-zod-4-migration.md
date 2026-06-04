# 0014 — Zod 3 → 4 migration

- **Status**: Accepted
- **Date**: 2026-06

## Context

`@hono/zod-openapi` 1.x and `@hookform/resolvers` 5.x both gated on
Zod 4 — staying on Zod 3 blocked two distinct dep majors and kept the
workspace one minor behind upstream's actively-developed line. Zod
itself is a *singleton* dependency across the workspace
(`packages/shared` exports schemas that `packages/api` and
`packages/web` consume), so its major must move on every workspace at
once or `@hono/zod-openapi`'s `instanceof ZodType` runtime checks
would fail across version boundaries.

Pre-flight reading on the three concrete unknowns:

- `@hookform/resolvers` 5.x kept the single `@hookform/resolvers/zod`
  import path. `zodResolver()` runtime-detects v3 vs v4 schemas — no
  per-form import change required.
- `@hono/zod-openapi` 1.4.0 retained the discriminated-union
  `defaultHook` shape from 0.19 (`{ success: true, data } |
  { success: false, error }`) — our hooks compile unchanged.
- `z.string().regex(pattern, 'invalid_username')` still works in
  Zod 4 as a positional shorthand; `ZodIssue.message` keeps the
  literal string, so `RegisterForm`'s
  `formState.errors.username?.message === 'invalid_username'`
  discriminator survives.

The `.default()` semantic that did change (`.default('x').optional()`
now fills the field where Zod 3 left it absent) hits the *opposite*
chain order from the one site we use (`moodEmoji:
z.string().optional().default('')` — safe order), so the upgrade is
runtime-neutral for the encrypted-payload parsers.

## Decision

Migrate the workspace from Zod `^3.25.76` to Zod `^4.4.3`, lockstep
with `@hookform/resolvers ^5.4.0` and `@hono/zod-openapi 1.4.0`.

The migration lands as **9 small commits** rather than one big-bang
PR, with green tests between each:

1. Atomic dep bump (`zod`, `@hookform/resolvers`, `@hono/zod-openapi`
   together) — single revertable commit if CI explodes.
2. Factor the 6 inline `defaultHook` sites into a canonical
   `defaultInvalidBodyHook` exported from `openapi/index.ts`.
3. Codemod the string-format validators to the Zod 4 top-level forms:
   `z.string().email/url/uuid/datetime` → `z.email/url/uuid` +
   `z.iso.datetime`.
4. Migrate `UsernameField`'s regex error to the canonical `{ error:
   ... }` form + add canary tests that pin the literal `ZodIssue.
   message === 'invalid_username'` (RegisterForm reads it as an
   error code).
5. Audit `.default()` sites — confirm safe — add canary tests round-
   tripping the module-payload defaults.
6. Replace `.passthrough()` with `z.looseObject(...)` everywhere
   (~26 sites across shared + api).
7. Swap `ZodTypeAny` → `z.ZodType` in the 3 helper generic
   constraints.
8. Sync docs/ with the new idioms.

The post-bump commits are technically optional — Zod 4 keeps the
deprecated APIs working — but landing them inside the same PR keeps
the codebase idiomatic and avoids leaving deprecation noise for
future grep-archaeology.

## Consequences

**Positive:**
- Unblocks `@hono/zod-openapi` 1.x (canonical Zod-4 path for the
  OpenAPI bindings) and `@hookform/resolvers` 5.x (runtime-detects
  v3/v4 — leaves room to bump zod minors freely).
- `.default()` semantics now match what most consumers already
  assumed (field always populated, never silently `undefined` on
  optional-with-default chains).
- The string formats (`z.email`, `z.iso.datetime`) ship as top-level
  constructors — simpler call sites, less chaining noise.
- The audit-config ignore `GHSA-5xrq-8626-4rwp` (Vitest UI) had
  already been dropped during the Vitest 4 migration — the Zod 4
  bump doesn't reintroduce any advisory.

**Negative:**
- Atomic bump in commit 1 means the rollback story is
  `git revert <sha>` for the whole stack — schema rewrites are
  isolated in commits 2-8 specifically so this revert stays a
  pure dep change. Never mix schema codemods into commit 1.
- The `'invalid_username'` regex message is the single behaviour-
  coupled string in the migration. The canary test in
  `packages/shared/src/schemas/auth.test.ts` pins
  `ZodIssue.message === 'invalid_username'` — *never delete it.*
  If a future Zod release localises or prefixes the literal, the
  canary fails before the user-facing UX silently degrades to a
  generic error.
- `z.uuid()` tightens RFC 9562/4122 validation (variant bits must
  be set). `crypto.randomUUID()` output satisfies it and no
  hand-rolled UUID strings live in seeds/fixtures, but any
  future test fixture or seed that hand-rolls a placeholder UUID
  (`'00000000-...'`) will now fail `safeParse`.

## Notes

- Vitest 4 (separately migrated, commit `292bc02`) is the test
  harness the migration runs on — 352 api + 388 web tests stayed
  green at every stage.
- The pre-flight reading was captured in the Workflow run
  `wf_02964082-80c` (live transcript dir under the session's
  `subagents/workflows/`); it documents the exact source-code
  evidence for the three unknowns above.
