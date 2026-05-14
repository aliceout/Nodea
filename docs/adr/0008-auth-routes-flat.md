# 0008 — Flat `auth/` folder rather than layered

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)

## Context

Server-side authentication code lives in `packages/api/src/routes/`
across roughly a dozen flat files: `auth-login.ts`,
`auth-recovery.ts`, `auth-passkey-enroll.ts`,
`auth-passkey-login.ts`, `auth-passkey-manage.ts`, `auth-totp.ts`,
`auth-mfa.ts`, `auth-mfa-bypass.ts`, `auth-reauth.ts`,
`auth-register-v2.ts`, `auth-account.ts`, `auth-security-mode.ts`,
`auth-change-password.ts`, `auth-reset.ts`. Each file mixes HTTP
handlers, Zod validation, DB calls, and cryptographic logic.

The classic server-architecture alternative is to split into
layers:
- `auth/services/` — business logic (OPAQUE orchestrators, session
  management).
- `auth/domain/` — domain entities (User, Session, RecoveryCode).
- `auth/infra/` — DB access, mailer, external services.
- The `routes/` files would only do HTTP → service binding.

That's the Domain-Driven Design pattern applied to an auth layer.
Many codebases do it.

## Decision

**Keep the flat organisation, don't split into layers.**

## Consequences

**Positive:**
- **No empty or thinly-populated layers.** Nodea's auth domain is
  infrastructure cryptography (OPAQUE handshake, key derivation,
  HMAC verification, session management). There's no rich business
  logic like "compute the risk score of a login" or "apply the
  eligibility rule X" that would justify a proper `domain/` layer.
  Splitting would mostly produce mostly-empty folders or folders
  with a single file inside.
- **Each flow reads in a single file.** Understanding how passkey
  enrollment works happens by reading `auth-passkey-enroll.ts`
  end to end. In a layered split, you'd jump between
  `routes/auth-passkey-enroll.ts`, `services/passkey-service.ts`,
  `domain/passkey.ts`, `infra/passkey-repository.ts` — needless
  friction on a flow that's already complex on its own.
- **Tests are easy.** `supertest(buildApp())` with a test DB, call
  the endpoint, check the result. No need to mock a service or
  inject a dependency — the logic is directly callable via HTTP.

**Negative:**
- **`auth-*.ts` files share some transverse behaviour that
  repeats a bit.** OPAQUE derivation is used in `auth-login.ts`,
  `auth-change-password.ts`, and `auth-recovery.ts`. Mitigated by
  helpers extracted into `packages/api/src/auth/` (the
  `opaque.ts`, `cookies.ts`, `mfa-bypass.ts`, etc. modules) that
  play the role of an implicit service layer without the
  formalism of a `services/` folder.
- **Risk that a "well-intentioned" dev attempts layered
  separation** because that's what they did on another project.
  This ADR is precisely meant to avoid that cost.

## Alternatives considered

- **Classic services/domain/infra split.** Discarded for the main
  reason above: no rich business domain to isolate. The `domain/`
  layer would be a set of TypeScript interfaces and three
  functions, and `infra/` would mostly be Drizzle wrapping. Cost
  (boilerplate, file jumps) higher than benefit (conceptual
  readability).
- **Halfway split**: an `auth/services/` folder for helpers
  (OPAQUE, cookies, sessions) and routes at the root level of
  `routes/`. That's roughly what we have —
  `packages/api/src/auth/` plays this role. The distinction is
  implicit rather than explicit, which is OK as long as it stays
  obvious on reading.

## When to revisit

If the auth layer gains a real business domain (e.g. a risk
policy evaluated at login based on user history, or a multi-tenant
strategy with different rules per organisation), at that point the
cost of layered separation becomes justified. While we're in the
current pattern (HTTP handlers + crypto helpers + direct DB
access), keep flat.
