# 0010 — `getConfig()` as a global singleton

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)

## Context

API configuration (Postgres URL, cookie signing secret, OPAQUE
setup, SMTP parameters, web base URL, etc.) lives in
`packages/api/src/config.ts`. It's read from environment variables,
validated against a Zod schema at boot, and exposed via a
`getConfig()` function that returns the memoised result.

This function is called everywhere in server code — middlewares,
route handlers, services — every time a module needs a config
parameter. It's effectively a global singleton: one instance,
shared across all code via `getConfig()`.

The alternative would be **injection**: pass a config object as an
argument to every function that needs it (or via a React-style
server-side context). That's the classic dependency-injection
pattern.

## Decision

**Keep the `getConfig()` singleton. Don't adopt injection.**

## Consequences

**Positive:**
- **No plumbing across layers.** A deeply nested function that
  needs `WEB_BASE_URL` calls `getConfig().WEB_BASE_URL` directly.
  With injection, the config would need to be passed from the root
  through every intermediate call — many function signatures
  carrying a dependency they don't care about.
- **Fail-fast boot.** `getConfig()` parses env variables with a
  strict Zod schema on first call. If a variable is missing or
  malformed, the error explodes at boot with a clear message
  (e.g. `WEB_BASE_URL: Required, received undefined`). With
  injection, the error would surface when a function tries to
  read the config — possibly after a long apparently successful
  boot.
- **Easy ad-hoc test overrides.** Vitest exposes
  `vi.stubEnv('VITE_API_URL', 'http://test.local')` which mutates
  `process.env` at the JS-VM level, and `getConfig()` re-reads
  `env` if called after the stub. That's exactly the pattern we
  use. Injection wouldn't add testability here — we already stub
  at the right level (env-var).

**Negative:**
- **Testing a behaviour with a specific config requires stubbing
  `process.env`.** No clean stub like
  `service.lookup({ apiKey: 'fake' })`. Mitigated by
  `vi.stubEnv()`, the standard API for this.
- **Implicit coupling.** Any function that calls `getConfig()`
  depends on the right environment variables being set. That's
  invisible in the function's signature. Mitigated by the fact
  that `getConfig()` is typed — a call to
  `getConfig().WEB_BASE_URL` for a non-existent variable fails at
  compile time.

## Alternatives considered

- **Full injection via a `buildApp(config)` function that
  distributes config to modules.** That's the proper-DI pattern.
  Discarded because the testability benefit is absent (we already
  stub at env-var level) and the plumbing cost is non-negligible
  (every module would expose a factory taking config as an
  argument). For a single-instance E2EE project, it's ceremony
  for nothing.
- **Partial injection via a `Container` object** threaded through
  `c.set('config', ...)` in Hono. Discarded for the same reasons
  — added complexity has no use case that justifies it.
- **TTL cache on `getConfig()` to handle hot-reload.** Discarded:
  the server doesn't hot-reload config in prod (an env-var change
  requires a container restart, which is explicit). In dev, the
  tsx hot-reload restarts everything anyway. Lifetime cache is
  fine.

## When to revisit

If we start having use cases where the same function must run
with two different configs in the same process (e.g. server-side
multi-tenant, or tests that must simulate several instances in
parallel), the singleton stops being enough and injection becomes
necessary. While we're single-instance with one config per boot,
keep the singleton.
