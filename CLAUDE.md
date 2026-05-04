# CLAUDE.md — Nodea

This file is read automatically by Claude Code at the start of every session. It provides the context needed to contribute to the project without re-explaining the foundation.

---

## The project

**Nodea** is a self-hosted, **end-to-end encrypted** journaling / life-tracking web app. Data is encrypted in the browser with a user-derived main key — the server stores only ciphertext + HMAC guards, never plaintext, never keys.

Modules: **Mood** · **Goals** · **Journal** · **Habits** · **Library** · **Review** (all implemented; Library Phase 4 imports remaining — see [`docs/Modules/Library.md`](./docs/Modules/Library.md)).

Active work lives on `refacto-design-v2` until it merges to `main`.

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
| `packages/web/src/app/pages/docs/content/tech.md` (rendered at `nodea.app/docs/security/tech`) | Before touching anything crypto, auth, or guards — single source of truth |
| `docs/Database.md` | Before touching schema, collections, or guard validation |
| `docs/Modules.md` + `docs/Modules/*` | Before touching a specific module (Mood, Goals, Journal, Habits, Library, Review) |
| `docs/Auth-Spec.md` | Before touching anything in the auth flows (OPAQUE, MFA, recovery, re-auth) |
| `docs/Internationalisation.md` | Before touching i18n files |
| `docs/security-audit.md` | Findings list + per-area sweep — cross-check before closing any crypto / auth / response-leakage task |
| `docs/adr/` | Before changing an architectural decision documented in an ADR |

---

## Stack

- **Backend**: Node 22 · Hono · Drizzle ORM · PostgreSQL 16 · Zod · session cookies (not JWT)
- **Frontend**: React 19 · Vite · Tailwind · React Router v7 · **TypeScript strict** · Zustand · React Hook Form + Zod
- **Monorepo**: pnpm workspaces (`packages/api`, `packages/web`, `packages/shared`)
- **Crypto**: WebCrypto (AES-GCM + HMAC-SHA-256) + OPAQUE via `@serenity-kit/opaque` + WebAuthn via `@simplewebauthn/{server,browser}`
- **Deployment**: docker-compose (postgres + api + web). Postgres data
  persists under `$HOME/data/nodea/postgres/` via a bind mount
  (set by `infra/scripts/deploy.sh`). Drizzle migrations run on api
  boot and evolve the schema without touching user rows — every
  deploy is non-destructive. Never use `docker compose down -v` or
  `docker volume prune` on a Nodea host: the bind mount makes both
  no-ops, but the muscle memory is what kills prod data.
- **Tests**: Vitest + Playwright (e2e)

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

1. **All queries are parameterized** via Drizzle (`eq(x.field, value)`). Never string-interpolate user input.
2. **Every record mutation goes through a guard middleware.** The factory of module routes must be driven by a single typed array of collections — adding a collection automatically enrolls it in guard validation.
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
- There is **one** store. Never add a parallel singleton module that holds app state.
- State shape, selectors, actions all live in `packages/web/src/core/store/`.
- Subscribe with Zustand selectors, not `useContext` + reducer.

### Data fetching
- All API calls go through the typed clients in `packages/web/src/core/api/`.
- No direct `fetch()` in components. No axios.

### Forms
- React Hook Form + Zod resolver. Zod schema lives in `packages/shared/src/schemas/` — one source of truth, reused for backend validation and frontend form validation.
- Password fields: show zxcvbn strength + min length. Never a silent "too weak" acceptance.
- **Forms à 1 seul champ** (genre email d'un magic-link, ou un seul bouton de confirmation) → `useState` direct est OK, RHF est overkill.
- **Forms à 2+ champs** → React Hook Form obligatoire. Pas de `useState` à la main pour gérer plusieurs inputs : la cohérence (validation, error state, dirty tracking) coûte moins cher en boilerplate avec RHF.

### Page-level file organisation
- **Page sous 200 LOC + un seul panel logique** → fichier flat dans `pages/<Name>.tsx`.
- **Page > 200 LOC OU ≥ 2 panels distincts** → dossier `pages/<Name>/` avec `index.tsx` (orchestration) + sous-fichiers (un par panel ou par responsabilité). Pattern de référence : `pages/Register/{index.tsx, RegisterForm.tsx, Stages.tsx}`.
- Cette règle s'applique à toute page nouvelle ou retouchée. Une page existante qui passe le seuil sur une PR mérite la migration dans la même PR.

### Routing
- **URL stays at `/flow` regardless of which module is active.** The active module lives in the Zustand `flow` slice (`currentModule: ModuleId`), never in the URL or query string. **Privacy invariant** — module-visited / sub-view metadata must not leak through Nginx access logs, Hono request logs, or browser referrers. No `/flow/:moduleId` paths, no `?subview=`, no `?tab=`. (See `App.tsx` `popstate` listener for the back-button sync that preserves UX without exposing the module in the URL.)
- **`document.title` on `/flow` must stay generic ("Nodea") — never per-module.** The browser tab title is read by every screen-recording / sharing tool, every "what's on my screen" plugin, and every shoulder-surfer. A title like *« Mood — Nodea »* leaks the active module just as much as a `/flow/mood` URL would. Same privacy invariant. Public routes (`/login`, `/docs`, etc.) DO set per-page titles via `useDocumentTitle` (see `lib/use-document-title.ts`) — the leak risk only applies to the authenticated surface. If you add a new module/sub-view, do NOT call `useDocumentTitle` from inside `/flow`.
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
- **File-overview header on every non-trivial file (> 50 LOC).** Start the file with a short JSDoc block that answers three questions: (1) **what** the file does, (2) **where** it sits architecturally (which layer, which module, why here vs elsewhere), (3) **what assumptions / decisions** are baked in that aren't obvious from the code (e.g. "single store on purpose — not split per slice", "guards in headers because logger leaked them in query strings", "camelCase only on the wire — see ADR-0012"). One paragraph is usually enough; the goal is that someone opening the file in 6 months understands its place without grep+blame. This convention is the project's main onboarding lever — preserve it on new files, extend it when refactoring an existing one.

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
- **Fail soft on user input.** Zod validation errors become 4xx responses with actionable messages; they never reach the global error handler or surface as an `error` log line.
- **Never swallow errors silently.** If a `catch {}` is intentional, document *why* in a one-line comment (e.g. `// stale blob on logout — expected`). A silent catch without rationale is a code-review block.
- **No secrets, tokens, session cookies, or raw crypto material in logs** — not even at `debug`. If you need to log a key for debugging, log its presence (`hasMainKey: true`), never its value. The api currently uses `hono/logger()` (request line + status + duration), which is enough for a single-instance self-host ; structured logging would be added the day a real need shows up.

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
- [ ] Is the UI using an existing `ui/atoms/*` primitive, or does it actually need a new one?
- [ ] Is any new base64/random/crypto helper calling the central module (not reimplementing it)?

---

## Git hygiene

- **Never commit without the user explicitly asking.** "It works, should I commit?" — ask. Don't preempt.
- **Never push to `main` directly.** Work happens on `refacto-design-v2` (current dev branch) or feature branches off it.
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
