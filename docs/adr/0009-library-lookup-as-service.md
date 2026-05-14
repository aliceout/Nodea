# 0009 — `library-lookup` moved to `services/library-lookup/`

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)

## Context

The book metadata lookup code (Library module) currently lives in
`packages/api/src/routes/library-lookup.ts`. It coexists at the
root of `routes/` with thin HTTP handlers like `auth-login.ts`,
`admin.ts`, `modules-config.ts`, etc.

But `library-lookup` isn't a route like the others:

- Its neighbours are **thin handlers**: validate input with Zod,
  call the database, return the result. A few dozen lines per
  route.
- `library-lookup` is a **full-on service**: it calls 4-5 external
  providers in parallel (Google Books, Open Library, BNF, Wikidata,
  BNE), runs a dispatcher with language-based ranking, streams
  NDJSON to ship results progressively. Several hundred lines.

Leaving it at the root of `routes/` sends a misleading signal — a
new dev opening the file expects 50 LOC of thin HTTP handler and
lands on a 500+ LOC service. The friction isn't about code quality
(which is good), it's about the **ambiguous convention**: is the
root of `routes/` for thin HTTP handlers only, or for anything
that answers a URL?

## Decision

**Move `library-lookup` into a subfolder
`packages/api/src/services/library-lookup/`** containing:

- The business-logic file(s) (dispatcher, providers, ranking,
  streaming).
- The service-internal types and schemas.

**Keep a thin file `packages/api/src/routes/library-lookup.ts`**
that only:

- Defines the HTTP routes (`GET /library/lookup/by-isbn`,
  `POST /library/lookup/by-query/stream`,
  `GET /library/lookup/cover-fetch`).
- Validates Zod inputs.
- Calls the internal service.
- Returns / streams the response.

Result: the root of `routes/` only holds thin HTTP handlers, and
the complexity of `library-lookup` is architecturally marked as a
service.

## Consequences

**Positive:**
- **The `routes/` root convention is clear again.** Every file in
  `routes/` is a thin handler (validate + call + return). Anything
  bigger migrates to `services/`.
- **The service is testable independently of HTTP.** We can write
  a dispatcher test without booting a Hono `app` — instantiate the
  service, call `lookupByQuery({ q, lang })`, check the result.
- **A new dev looking for "where is the book search logic?" finds
  `services/library-lookup/`** by folder name instead of stumbling
  into it while exploring `routes/`.

**Negative:**
- **Migration cost.** A `git mv` to preserve blame, imports to
  update, tests to re-route. Estimated half an hour.
- **Precedent to apply consistently.** If `library-lookup`
  deserves `services/`, would others (e.g. `auth-mfa-bypass.ts`,
  also big and complex) deserve it too? Proposed rule: `services/`
  when the code passes ~200 LOC AND does more than the
  validate→DB→return chain. For the other `auth-*.ts`, complexity
  stays in the handler because it's fundamentally HTTP-bound
  (OPAQUE derivation produces the session cookie that goes
  straight into the response — no need to extract a service).

## Alternatives considered

- **Keep at the root of `routes/`.** The code works and moving it
  is pure tidying. Discarded because the convention ambiguity
  costs a re-demonstration to every new dev opening the file.
- **Move EVERY big route to `services/`** (auth-login,
  auth-recovery, auth-mfa-bypass, etc.). Discarded: their
  complexity is intrinsically HTTP-bound (cookies, sessions,
  redirects), not business logic we'd usefully isolate. The
  handler/service split wouldn't pay off on these files.

## When to revisit

If another server route passes ~200 LOC and fans out to external
services (e.g. a payment provider integration, a third-party
OAuth connector), it likely deserves the same treatment. The
pattern stays the same: thin handler in `routes/`, logic in
`services/<feature>/`.
