# 0007 — Web API client: 14 dedicated functions vs Hono's `hc<AppType>`

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)

## Context

The web client talks to the Hono server via roughly a dozen files
in `packages/web/src/core/api/` (`auth.ts`, `passkeys.ts`,
`mfa.ts`, `totp.ts`, `library.ts`, `admin.ts`, etc.). Each file
exposes around ten dedicated functions like `apiLoginStart`,
`apiPasskeyEnrollFinish`, `apiAdminListAnnouncements` that call an
internal `request<T>()` wrapper (cf. ADR-12 on runtime validation).
Body and response types are imported from `@nodea/shared` (the Zod
schemas published in the shared package).

Hono ships an alternative: `hc<AppType>(baseUrl)`. It's a typed
HTTP client that automatically infers each endpoint's shape from
the server definition (the `AppType` type exported by
`buildApp()`). The client becomes usable without any per-endpoint
hand-writing — `client.auth.login.start.$post({ json: { email, ... } })`
is typed end to end, from body to response.

`hc<AppType>` ergonomics are better than dedicated functions (zero
boilerplate, zero risk of server/client drift). The question is:
why didn't we adopt it?

## Decision

**Keep the hand-rolled dedicated functions, don't adopt
`hc<AppType>`.**

## Update (2026-06) — the client grew, the decision stands

The "14" in the title is historical. The client is now **15 files** in
`core/api/` exposing **~71 `api*` functions** (`auth.ts` alone holds
~28). The decision is unchanged: wrappers stay hand-rolled over a
shared `request<T>()`, typed against `@nodea/shared` schemas rather
than `hc<AppType>`. Read "14" as "one `request<T>()` wrapper + one
dedicated function per endpoint".

## Consequences

**Positive:**
- **No strong coupling to the server's internal shape.** If we
  refactor the server routing (e.g. move `library-lookup` from
  routes/ to services/, or change file names), the client isn't
  affected — it depends on the Zod schemas published in
  `@nodea/shared`, not the server's file structure.
- **The client is usable from any other consumer** (seed script,
  integration tests, future mobile SDK generated from OpenAPI)
  because Zod schemas are the source of truth, not the Hono
  typing.
- **Routing errors are explicit on the client.** If the server
  changes an endpoint path, the client fails with a visible 404
  — easy to debug. With `hc<AppType>`, a path mismatch translates
  to an opaque TypeScript typing error pointing at a generic
  definition instead of the actual endpoint.

**Negative:**
- **14 files to maintain by hand.** Each new endpoint takes ~10
  lines of wrapper code. Repetitive, and there's a drift risk
  between server and client signatures (mitigated by shared
  `*Body` / `*Response` types via `@nodea/shared`, so drift is
  caught by tsc).
- **No path autocomplete on the client.** Autocomplete on
  `client.auth.login.start.$post(...)` would have been nice.
  Instead the dev types `apiLoginStart(...)`, which requires
  knowing the function name.

## Alternatives considered

- **`hc<AppType>` with a server-side routing refactor.** The
  current `app.route('/auth', authRoutes)` pattern breaks Hono's
  inference: `hc<AppType>` doesn't see routes mounted via
  `route()`, only routes defined inline on the root `app`. To make
  `hc<AppType>` work, we'd need to redo the route organisation —
  not negligible, and the trade-offs become debatable (a giant
  `app.ts` file, or forced centralisations). The benefit of
  `hc<AppType>` doesn't justify that overhaul.
- **A custom centralised client** like
  `apiClient.send('auth.login.start', body)` with internal
  dispatch. Discarded: replicates `hc<AppType>` without the
  automatic typing — worst of both worlds.
- **`@hono/zod-openapi` + automatic client generation from the
  OpenAPI definition.** Relevant later to generate a mobile client.
  For the web client we can keep the dedicated functions: it
  works, it reads well, it tests well.

## When to revisit

If the maintenance cost of the 14 wrapper files becomes visible
(typically: repeated regressions because of missed client
updates after a server change), or if we generate a mobile client
via OpenAPI anyway and want to unify both clients on the same
approach. As long as drift is caught by tsc and wrappers don't
take more than a few minutes per new endpoint, keep.
