# CLAUDE.md — Nodea

Read automatically at the start of every session. The rules of the road; detailed specs live in `docs/` (see table below).

---

## The project

**Nodea** is a self-hosted, **end-to-end encrypted** journaling / life-tracking web app. Data is encrypted in the browser with a user-derived main key — the server stores only ciphertext + HMAC guards, never plaintext, never keys.

Modules **Mood · Goals · Journal · Library · Review · HRT** are shipping. **Habits** is **dormant** — its data layer exists but the module is hidden (`to_toggle: false`, `display: false` in `modules-registry.tsx`, issue #98); its code still lives via import/export, so keep its data-layer invariants intact on shared paths.

---

## Documentation — fundamental rule

**Docs and code are a single source of truth; one always reflects the other.** Read the relevant `docs/` file **before** touching an area, not after. Any technical decision (new dep, pattern, architecture) is reflected in the docs **in the same commit**. Code that diverges from docs is a documentation bug — fix it like a code bug.

| File | When to read |
|---|---|
| `docs/Architecture.md` | Code structure, runtime flow |
| `packages/web/src/app/pages/docs/content/tech.md` (rendered at `nodea.app/docs/security/tech`) | Before touching crypto, auth, or guards — single source of truth |
| `docs/Database.md` | Before touching schema, collections, or guard validation |
| `docs/Modules/<Module>.md` + `docs/Architecture.md` §7 (cross-module schema + invariants) | Before touching a specific module |
| `docs/Auth-Spec.md` + `docs/auth/<Flow>.md` (Register, Login, ChangePassword, ChangeEmail, Recovery, BypassMfa, Lifecycle) | Before touching auth flows (OPAQUE, MFA, recovery, re-auth) |
| `docs/Internationalisation.md` | Before touching i18n files |
| `docs/adr/` | Before changing a decision documented in an ADR |

---

## Stack

- **Backend**: Node 24 · Hono · Drizzle ORM · PostgreSQL 16 · Zod · session cookies (not JWT)
- **Frontend**: React 19 · Vite · Tailwind · React Router v7 · **TypeScript strict** · Zustand · React Hook Form + Zod
- **Monorepo**: pnpm workspaces (`packages/api`, `packages/web`, `packages/shared`, `packages/e2e`)
- **Crypto**: WebCrypto (AES-GCM + HMAC-SHA-256) + OPAQUE (`@serenity-kit/opaque`) + WebAuthn (`@simplewebauthn/{server,browser}`)
- **Deployment**: docker-compose (postgres + api + web); Drizzle migrations run on api boot (non-destructive). Postgres data is a bind mount under `$HOME/data/nodea/postgres/`, so **`docker compose down -v` / `docker volume prune` are no-ops on data — but never run them on a Nodea host anyway.**
- **Tests**: Vitest + Playwright (e2e)

---

## Crypto — MANDATORY rules

Crypto mistakes are never "just a bug" — they silently break the security model.

1. **Never log, persist, or expose a `CryptoKey` or raw key material.** No `console.log(mainKey)`, no localStorage, no `window.mainKey`. Any global-object key fallback is a critical regression.
2. **AES and HMAC keys are domain-separated via HKDF** with distinct labels (`"nodea:aes"` / `"nodea:hmac"`). Never import the same raw bytes as both AES-GCM and HMAC — derive each sub-key separately, import as non-extractable.
3. **One source for base64** (and `randomBytes`) — the shared module. Never add a second encoder.
4. **Guards are never persisted.** No cache since audit 2026-06 — re-derived on demand (two HMAC passes). Any future cache must be in-memory only and purged at logout.
5. **Branded types for crypto primitives** (e.g. `type Base64 = string & { readonly __b: 'Base64' }`, `type AesMainKey = CryptoKey & { readonly __b: 'AesMainKey' }`) — mixing Base64/Base64Url or AES/HMAC keys must fail at compile time.
6. **Every crypto round-trip needs a Vitest test** before the old code is removed. No "trust the refactor".
7. **No theatrical wiping.** `wipeMainKeyMaterial` can't erase `CryptoKey` objects — zero the source bytes (`bytes.fill(0)`), document the limitation. Full purge = `location.reload()`.

---

## Backend rules (Hono + Drizzle)

1. **All queries parameterized** via Drizzle (`eq(x.field, value)`). Never string-interpolate user input.
2. **Every record mutation goes through a guard middleware**, driven by a single typed array of collections (adding a collection auto-enrolls it).
3. **`modules_config` is PK on `user_id`** and needs no guard; `requireUser` suffices. Document this in the route.
4. **Invite codes stored hashed.** Validation only inside `/auth/register`, never a standalone "check" endpoint. Rate-limit `/auth/*`.
5. **Session cookies, not JWT** — `httpOnly; Secure; SameSite=Strict; Signed` (`auth/cookies.ts`, SEC-08). Server-side logout invalidates the session immediately.
6. **Multi-table writes wrapped in a transaction.** Invite atomicity (`SELECT … FOR UPDATE` → create user → delete invite) is a hard requirement.
7. **Response serialization never leaks `guard` or other users' `encrypted_key`** — covered by an integration test.
8. **Argon2id** for password hashing. Zod + zxcvbn (score ≥ 3) enforced server-side.
9. **Measure before optimising.** Confirm a suspected N+1 via Drizzle query logging first; no optimisation lands without a before/after number.

---

## Frontend rules

**TypeScript** — all new files `.ts`/`.tsx`, strict. `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. `any` is forbidden — use `unknown` + narrowing.

**State** — one Zustand store, never a parallel state singleton. Shape/selectors/actions in `core/store/`. Subscribe via selectors, not `useContext` + reducer.

**Data fetching** — all API calls through the typed clients in `core/api/`. No raw `fetch()` in components, no axios.

**Forms** — React Hook Form + Zod resolver; the Zod schema lives in `packages/shared/src/schemas/` (one source, reused front + back). Password fields show zxcvbn strength + min length. 1 field → `useState` is fine; **2+ fields → RHF, mandatory** (no hand-rolled multi-input state).

**Page file organisation** — ≤ 200 LOC + one panel → flat `pages/<Name>.tsx`. > 200 LOC OR ≥ 2 panels → `pages/<Name>/` with `index.tsx` (orchestration) + one file per panel (ref: `pages/Register/`). Applies to any new or retouched page, including one that crosses the threshold in a PR.

**Routing — privacy invariant.** The URL stays `/flow` whatever the active module (it lives in the Zustand `flow` slice, never the URL/query); `document.title` on `/flow` stays generic `"Nodea"`, never per-module. Both leak the active module (logs, referrers, screen-share, shoulder-surfing) otherwise. No `/flow/:moduleId`, no `?subview=`/`?tab=`, no `useDocumentTitle` inside `/flow`. Public routes (`/login`, `/docs`, …) keep their own URLs + titles. Modules are lazy-loaded (`React.lazy` + `<Suspense>`); `ErrorBoundary` at two levels (global `App.tsx` + per-module) so a crashed module can't take down the app.

**UI — reuse before creating.** Check `packages/web/src/ui/` first; extend an existing primitive via props/variants rather than duplicating. Primitives → `ui/atoms/`; composed/feature components → `ui/dirk/`; per-module views → `app/flow/<Module>/`. A third inline copy of anything = stop and factor.

**Accessibility** (this app handles mental-health data — not optional):
- Every interactive element has a label (`<label htmlFor>`, `aria-label`, or visible text). No bare icon buttons.
- Every input wires its error path: `aria-describedby` + a `role="alert"` live region, not just a red border.
- Everything clickable is focusable with a visible focus ring (`focus-visible:*`). No `onClick` on a `<div>`.
- Colour contrast at WCAG AA — fix via the design token, not a local class.
- Never concatenate HTML strings — pass children / i18n placeholders.

---

## Monorepo & shared types

`packages/shared/` is the **keystone**: every type/schema used on both sides lives there, never duplicated. Zod schemas → `shared/src/schemas/`; crypto branded types → `shared/src/crypto-types.ts`; cross-side enums → `shared/src/enums.ts`. One-sided shapes stay local until the other side touches them.

---

## Code conventions

- **UTF-8 everywhere** — preserve French accents in i18n, labels, UI-visible comments.
- **Comments/JSDoc in English.** User-facing strings follow i18n rules.
- **Inclusive French for people only** (`utilisateur.ice.s`), not objects (`un critère actif`, not `actif.ve`).
- **Naming**: `camelCase` vars/functions, `PascalCase` types/components, `SCREAMING_SNAKE` env vars + constants.
- **No commented-out code** — delete it, git remembers.
- **Small commits, imperative mood** (`feat:`/`fix:`/`docs:`/`refactor:`/`chore:`). Minimal diffs; no reformatting unrelated code.
- **Edit in place; never delete-and-recreate** (wipes pending changes, breaks blame, hides the diff). Rename/move with `git mv`.
- **File-overview header on every non-trivial file (> 50 LOC)** — a short JSDoc block answering: (1) **what** it does, (2) **where** it sits (layer/module, why here), (3) **what non-obvious assumptions** are baked in (e.g. "single store on purpose", "guards in headers because the logger leaked them in query strings"). This is the project's main onboarding lever — preserve and extend it.

---

## Testing

- **Crypto code: Vitest unit tests before removing the old version** — AES-GCM round-trip, `deriveGuard` determinism, HKDF separation, base64/base64url round-trips. Aim ≥ 90 % coverage on `core/crypto/`.
- **Auth flows: integration tests** — register → login → change-password → logout → stale-cookie rejection.
- **Invite atomicity: tested explicitly** — the same code used twice; the second attempt must fail.

---

## Error handling & logging

- **Fail loud on developer errors** (bugs, misconfig, invariant violations) — throw early; don't catch-and-ignore.
- **Fail soft on user input** — Zod errors become 4xx with actionable messages; they never hit the global handler or an `error` log line.
- **Never swallow errors silently.** An intentional `catch {}` carries a one-line rationale (`// stale blob on logout — expected`); a silent one is a review block.
- **No secrets/tokens/cookies/crypto material in logs**, not even at `debug` — log presence (`hasMainKey: true`), never value. The api uses `hono/logger()` (request line + status + duration); structured logging waits for a real need.

---

## Dependencies

- **Prefer stdlib + workspace utils** before a new package — check `packages/shared/` first.
- **Justify every new dep in the PR** (what, why existing code can't, maintainer, last release). Pin versions (no `^`/`~`); upgrades go through their own PR.
- **Crypto-adjacent deps — read the source first.** Unaudited or unmaintained → don't add.
- **Remove unused deps in the commit that drops their last caller.**

---

## Git hygiene

- **Never run `git push` — the user always pushes.** Commit locally, hand back, let them push. (A `PreToolUse` hook + deny permission in `.claude/settings.json` hard-block `git push`; if it fires, that's the guard working.)
- **Never commit without the user explicitly asking** — and one "commit" covers only the current change, not the next.
- Work on feature branches off `main`. Never force-push shared branches; never `--no-verify`, `--no-gpg-sign`, `--amend` on pushed commits.
- **Dependabot PRs stay open** until the user decides — don't delete their branches.
- After any push (by the user), if CI is configured, check `gh run list` and fix failures.

---

## PR checklist (scan before marking ready)

- [ ] No `any`; no string interpolation in DB queries (parameterized via Drizzle)
- [ ] All record mutations go through the guard middleware (or are documented-exempt like `modules_config`)
- [ ] Multi-table writes wrapped in `db.transaction()`
- [ ] No secrets/keys/tokens in localStorage; no `window.mainKey` fallback
- [ ] Responses never include `guard` or another user's `encrypted_key`
- [ ] Rate limit on any new `/auth/*` endpoint
- [ ] Crypto additions respect HKDF domain separation + branded types
- [ ] Zod schema lives in `shared/src/schemas/` (Update DTO derived from Create via `.partial()`)
- [ ] Forms use shared field components; UI reuses an `ui/atoms/*` / `ui/dirk/*` primitive when one fits
- [ ] Any new base64/random/crypto helper calls the central module
- [ ] Docs updated in the same commit where code diverged from them

---

## Notification — MANDATORY

When a task is done and the hand goes back to the user, send a Windows toast **before** the final reply (so it fires even if they're away):

```bash
powershell -command "New-BurntToastNotification -Text 'Claude Code — Nodea', '<short description>'"
```
