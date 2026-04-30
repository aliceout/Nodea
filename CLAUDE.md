# CLAUDE.md — Nodea

This file is read automatically by Claude Code at the start of every session. It provides the context needed to contribute to the project without re-explaining the foundation.

---

## The project

**Nodea** is a self-hosted, **end-to-end encrypted** journaling / life-tracking web app. Data is encrypted in the browser with a user-derived main key — the server stores only ciphertext + HMAC guards, never plaintext, never keys.

Current modules: **Mood** · **Goals** · **Passage** (implemented). **Habits** · **Library** · **Review** (documented, not yet implemented).

The PocketBase → Hono/Drizzle/PostgreSQL migration is complete. Active work lives on the `refacto` branch until it merges to `main`.

---

## Documentation — fundamental rule

**Documentation and code are a single source of truth. One must always reflect the other.**

- Read the relevant `docs/` file **before** working on a module — not after.
- Any technical decision made during development (new dependency, new pattern, architecture decision) must be **immediately reflected in the documentation** before closing the task.
- If code diverges from the docs, it is a documentation bug — fix it the same way you would fix a code bug.
- Never leave a PR or commit that contradicts `docs/` without having updated the docs in the same commit.

| File | When to read |
|---|---|
| `docs/Architecture.md` | Code structure, runtime flow |
| `docs/Security.md` | Before touching anything crypto, auth, or guards |
| `docs/Database.md` | Before touching schema, collections, or guard validation |
| `docs/Modules.md` + `docs/Modules/*` | Before touching a specific module (Mood, Goals, Passage, Habits, Library, Review) |
| `docs/Internationalisation.md` | Before touching i18n files |
| `docs/security-audit.md` | Findings list + per-area sweep — cross-check before closing any crypto / auth / response-leakage task |
| `docs/roadmap/*.md` | Active roadmaps (health, i18n) — read before work in those areas |

---

## Stack

### Current (being phased out)
- **Backend**: PocketBase (SQLite + Go hooks in `config/pocketbase/pb_hooks`)
- **Frontend**: React 19 · Vite · Tailwind CSS · React Router v7 · JavaScript (JSX)
- **Crypto**: WebCrypto (AES-GCM + HMAC-SHA-256) · `argon2-wasm` · `hash-wasm`

### Target (current stack)
- **Backend**: Node 22 · Hono · Drizzle ORM · PostgreSQL 16 · Zod · Pino · session cookies (not JWT)
- **Frontend**: React 19 · Vite · Tailwind · React Router v7 · **TypeScript strict** · TanStack Query · Zustand · React Hook Form + Zod
- **Monorepo**: pnpm workspaces (`packages/api`, `packages/web`, `packages/shared`)
- **Deployment**: docker-compose (postgres + api + web)
- **Tests**: Vitest (+ optional testcontainers, Playwright)

When writing new code, **target the target stack**. When modifying existing JSX/PB code, follow existing patterns but do not add to the legacy burden.

---

## Crypto — MANDATORY rules

Nodea is E2E encrypted. Crypto mistakes are never "just a bug" — they silently break the security model.

1. **Never log, persist, or expose a `CryptoKey` or raw key material.** No `console.log(mainKey)`, no localStorage, no `window.mainKey`. Any fallback that stashes the key on the global object is a critical regression — do not reintroduce one under any circumstance.
2. **AES and HMAC keys must be domain-separated via HKDF** with distinct labels (`"nodea:aes"` / `"nodea:hmac"`). Never import the same raw bytes as both AES-GCM and HMAC-SHA-256 — each sub-key is derived separately and imported as a non-extractable `CryptoKey`.
3. **One source for base64.** Do not add a new base64 encoder/decoder. Use the shared module. Same for `randomBytes`.
4. **Guards are never persisted to localStorage.** In-memory cache only, purged at logout.
5. **Use branded types for crypto primitives** (TypeScript only):
   ```ts
   type Base64 = string & { readonly __b: 'Base64' };
   type AesMainKey = CryptoKey & { readonly __b: 'AesMainKey' };
   ```
   Mixing `Base64` and `Base64Url`, or AES and HMAC `CryptoKey`, must fail at compile time.
6. **Every crypto round-trip needs a Vitest test** before the old code is removed. No "trust the refactor".
7. **No theatrical wiping.** `wipeMainKeyMaterial` cannot erase `CryptoKey` objects — do not pretend it does. Zero the source bytes with `bytes.fill(0)` and document the limitation. Full purge = `location.reload()`.

---

## Backend rules (new stack — Hono + Drizzle)

1. **All queries are parameterized** via Drizzle (`eq(x.field, value)`). Never string-interpolate user input — the legacy `Register.jsx` filter injection must never reappear.
2. **Every record mutation goes through a guard middleware.** The factory of module routes must be driven by a single typed array of collections — adding a collection must automatically enroll it in guard validation. `guard.pb.js` currently misses collections; the new design must make that impossible.
3. **`modules_config` is keyed PK on `user_id`** and does not need a guard; `requireUser` is sufficient. Document this in the route.
4. **Invite codes stored hashed**, never in clear. Validation happens only inside `/auth/register`, never exposed via a standalone "check" endpoint. Rate-limit `/auth/*`.
5. **Session cookies, not JWT.** `httpOnly; Secure; SameSite=Lax; Signed`. Server-side logout must invalidate the session immediately.
6. **Multi-table writes wrapped in a transaction.** Invite atomicity (`SELECT ... FOR UPDATE` → create user → delete invite) is a hard requirement.
7. **Response serialization never leaks `guard` or other users' `encrypted_key`.** Write an integration test that verifies this — once.
8. **Argon2id** for password hashing. Zod + zxcvbn (score ≥ 3) for password policy enforcement on the server.
9. **Measure before optimising.** Suspected N+1 queries get confirmed via Drizzle query logging first, then fixed with a join or batch — not pre-emptively eager-loaded. Optimisations without a before/after number don't land.

---

## Frontend rules

### TypeScript
- All new files are `.ts` / `.tsx` with strict mode.
- `tsconfig.base.json` has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`.
- `any` is forbidden in new code. Use `unknown` + narrowing, or proper types.

### State — Zustand (single source)
- There is **one** store. Never add a parallel singleton module that holds app state (the legacy `modulesRuntime.js` pattern is being removed).
- State shape, selectors, actions all live in `packages/web/src/core/store/`.
- Subscribe with Zustand selectors, not `useContext` + reducer.

### Data fetching — TanStack Query
- All API calls go through the typed Hono client (`hc<ApiType>` from `packages/shared`).
- No direct `fetch()` in components. No axios. No `pb.send()` in new code.
- Cache keys: derived from a factory per entity. No hardcoded string arrays.

### Forms
- React Hook Form + Zod resolver. Zod schema lives in `packages/shared/src/schemas/` — one source of truth, reused for backend validation and frontend form validation.
- Password fields: show zxcvbn strength + min length. Never a silent "too weak" acceptance.

### Routing
- **URL stays at `/flow` regardless of which module is active.** The active module lives in the Zustand `flow` slice (`currentModule: ModuleId`), never in the URL or query string. **Privacy invariant** — module-visited / sub-view metadata must not leak through Nginx access logs, Hono/Pino request logs, or browser referrers. No `/flow/:moduleId` paths, no `?subview=`, no `?tab=`. (See `App.jsx` `popstate` listener for the back-button sync that preserves UX without exposing the module in the URL.)
- Every module component lazy-loaded via `React.lazy()`. Wrap in `<Suspense>`. No JSX instantiated at module import.
- `ErrorBoundary` at two levels: global in `App.tsx`, and per-module inside the router resolver. A crashed module must not take down the whole app.
- Public routes (`/login`, `/register`, `/docs`, `/recover`, `/totp`, `/passkeys`, etc.) keep their own URLs — the privacy rule applies to the authenticated `/flow` surface only, where leakage would reveal *what an authenticated user is doing*.

### UI components — reuse before creating
Before creating any component, check `packages/web/src/ui/` first. If something close exists (Button, Input, Textarea, Modal, Badge, TableShell, Surface, FormField…), **extend it via props/variants** rather than duplicating.

- UI primitives → `packages/web/src/ui/atoms/`
- Shared feature components → `packages/web/src/ui/molecules/` (or equivalent)
- Per-module views → `packages/web/src/app/flow/<Module>/`

If you see yourself copy-pasting a third inline variant, stop and factor it instead.

### Accessibility
Basic a11y is not optional — this app handles mental-health data and must be usable by anyone who needs it.

- Every interactive element carries a label: native `<label htmlFor>`, `aria-label`, or visible text. No bare icon buttons.
- Every form input has an error path wired to it: `aria-describedby` + a `role="alert"` live region, not just red border.
- Keyboard: every clickable thing is focusable *and* has a visible focus ring (Tailwind `focus-visible:*`). No `onClick` on a `<div>`.
- Colour contrast stays at WCAG AA. If a tone change makes that hard, swap the design token, not the local class.
- Never build strings by concatenating HTML — pass children or i18n placeholders.

---

## Monorepo & shared types

`packages/shared/` is the **keystone**. Every type or schema used on both sides lives here — never duplicated.

- Zod schemas (payload shapes, request/response bodies) → `packages/shared/src/schemas/`
- Branded types for crypto → `packages/shared/src/crypto-types.ts`
- Enums shared between api and web → `packages/shared/src/enums.ts`

If a shape is only used by one side, it stays local. As soon as both sides touch it, move it to `shared/`.

---

## Code conventions

- **UTF-8 everywhere.** Preserve French accents in i18n files, labels, comments visible in UI.
- **Comments and JSDoc in English.** Prose-in-code is English; user-facing strings follow i18n rules.
- **Inclusive French** applies only to people (`utilisateur.ice.s`). Do not apply it to objects — `un critère actif`, not `actif.ve`.
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/types/components, `SCREAMING_SNAKE` for env vars and constants.
- **No commented-out code.** Delete it — git remembers.
- **Small commits, imperative mood** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). Keep diffs minimal; no reformatting unrelated code.
- **`git mv` to rename/move files** — never delete + recreate. History matters.

---

## File management

**Edit in place; don't delete and recreate.** Even for small content changes, update the file via your editor (or the `Edit` tool) rather than rewriting it from scratch. Delete+recreate wipes partial/pending changes, breaks git blame continuity, and hides the diff from reviewers.

Moving a file = `git mv`, never delete + rewrite.

```bash
git mv packages/web/src/core/crypto/old-name.ts packages/web/src/core/crypto/new-name.ts
```

Deleting then recreating breaks git history and loses traceability of past changes.

---

## Testing

- **Crypto code requires Vitest unit tests before the old version is removed.** Round-trip AES-GCM, `deriveGuard` determinism, HKDF separation, base64/base64url round-trips.
- **Auth flow requires integration tests**: register → login → change-password → logout → stale-cookie rejection.
- **Invite atomicity** must be tested explicitly: the same code used twice — the second attempt must fail.
- Aim for **≥ 90 % coverage on `core/crypto/`**.

---

## Error handling & logging

- **Fail loud on developer errors** (bugs, misconfig, invariant violations). Throw early, let the global handler surface them in dev; don't catch-and-ignore to make the screen stop complaining.
- **Fail soft on user input.** Zod validation errors become 4xx responses with actionable messages; they never reach the global error handler or a Pino `error` line.
- **Never swallow errors silently.** If a `catch {}` is intentional, document *why* in a one-line comment (e.g. `// stale blob on logout — expected`). A silent catch without rationale is a code-review block.
- **Structured logs** via Pino on the api. Include request id, user id when available, and the operation name. No secrets, tokens, session cookies, or raw crypto material in logs — not even at `debug`. If you need to log a key for debugging, log its presence (`hasMainKey: true`), never its value.

---

## Dependencies

- **Prefer stdlib + workspace utils** before reaching for a new package. `packages/shared/` already holds most of what's shared; check it first.
- **Justify every new dep in the PR description** (what it does, why the existing code can't, who maintains it, last release date). Kitchen-sink libs get rejected in favour of small focused ones.
- **Pin versions** (no `^` / `~`) in the new stack. Upgrades are deliberate and go through their own PR.
- **Crypto-adjacent deps — read the source before accepting.** Third-party crypto is where silent breakage hides. If the lib isn't audited or actively maintained, don't add it.
- **Remove unused deps in the same commit** that removes their last caller. Dead `package.json` entries cost install time and audit noise.

---

## Security checklist — for every PR

Before marking a PR as ready:

- [ ] No `any` in TypeScript code
- [ ] No string interpolation in DB queries (all parameterized via Drizzle)
- [ ] All record mutations go through the guard middleware (or are explicitly documented as exempt like `modules_config`)
- [ ] Multi-table writes wrapped in `db.transaction()`
- [ ] No secrets, keys, or tokens in localStorage
- [ ] No `window.mainKey` or equivalent key-leaking fallback
- [ ] Server responses never include `guard` or another user's `encrypted_key`
- [ ] Rate limit in place for new `/auth/*` endpoints
- [ ] Crypto additions: HKDF domain separation respected; branded types used

---

## Reuse & factorisation checklist — for every PR

- [ ] Is the Zod schema in `packages/shared/src/schemas/` (not redefined locally)?
- [ ] Is the Update DTO derived from Create via `.partial()`?
- [ ] Are form fields using shared field components (not raw inline `<input>`)?
- [ ] Is the TanStack Query hook generated from a factory, not hand-rolled?
- [ ] Is the UI using an existing `ui/atoms/*` primitive, or does it actually need a new one?
- [ ] Is any new base64/random/crypto helper calling the central module (not reimplementing it)?

---

## Git hygiene

- **Never commit without the user explicitly asking.** "It works, should I commit?" — ask. Don't preempt.
- **Never push to `main` directly.** Work happens on `refacto` (current migration branch) or feature branches off it.
- **Never force-push shared branches.** Never `--no-verify`, `--no-gpg-sign`, `--amend` on pushed commits.
- **Dependabot PRs stay open** until the user decides — do not delete their branches.
- After any push, if CI is configured, check `gh run list` and fix failures before moving on.

---

## Notification — MANDATORY

**When a task is complete and the hand goes back to the user, always send a Windows toast notification** so the user knows they can retrieve the prompt.

```bash
powershell -command "New-BurntToastNotification -Text 'Claude Code — Nodea', '<short description of what was done>'"
```

Keep the text short (it has to fit in a toast). Adapt to the task — e.g. `"Roadmap committée"`, `"Phase 1 bootstrap OK"`, `"Tests crypto verts"`, `"Migration Mood terminée"`.

Send the notification **before** your final text reply, so the toast fires even if the user is away from the terminal.
