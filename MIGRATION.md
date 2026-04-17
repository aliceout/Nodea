# MIGRATION — Nodea

Status document for the ongoing migration from PocketBase (current stack) to a self-hosted **Hono + Drizzle + PostgreSQL + TypeScript** stack. Detailed plan: [`documentation/Migration-Roadmap.md`](documentation/Migration-Roadmap.md).

> This file is the operational state of the migration. Update it at the end of every phase.

---

## Principles

1. **Parallèle, pas en place** — the new backend lives alongside PocketBase until Phase 10. No data-level cohabitation; no users to migrate (confirmed).
2. **TypeScript strict on all new code.** Existing JSX stays until touched.
3. **No big-bang on the front** — migration module by module once the new back is ready.
4. **Every fix is traced to an audit finding.** End of each phase = corresponding findings checked.
5. **Tests before the switch** for anything that touches crypto.
6. **No new feature work on PocketBase** during the migration. Security/breakage fixes only.

## Scope freeze

| Area | Frozen? | Notes |
|---|---|---|
| PocketBase hooks (`config/pocketbase/pb_hooks`) | Yes | Bugfix only |
| PocketBase schema (`pb_schema.json`) | Yes | No new collections |
| Frontend modules (Mood / Goals / Passage) | Maintenance only | UI tweaks tolerated; no new backend calls added |
| Missing modules (Habits / Library / Review) | **Not implemented on PB** | Will ship directly on the new stack in Phase 7 |
| Dependency updates | Security bumps only (Dependabot) | No proactive major-version upgrades |

## Phase progress

| Phase | Title | Status | Notes |
|---|---|---|---|
| 0 | Préparation & gel de portée | done | This document |
| 1 | Bootstrap monorepo TypeScript | done | pnpm workspaces, `packages/{api,web,shared}`, `tsconfig.base.json`, `docker-compose.yml`, zombie deps cleanup. `pnpm -r build` and `pnpm -r typecheck` green. |
| 2 | Back : DB, auth, sessions, invitations | done | Drizzle schema (users/sessions/invites), argon2id + zxcvbn policy, signed session cookies, 6 auth routes, admin invite mint, invite atomic consumption via `SELECT FOR UPDATE`, rate limiting, 15/15 integration tests green against real Postgres. |
| 3 | Back : modules CRUD + guards | done | 8 entry tables + `modules_config`, single `createCollectionRoutes` factory driven by typed `COLLECTIONS` registry, `requireGuard` middleware with timing-safe compare and `init → g_…` promotion. `guard` field stripped from every read response; cross-user reads proven isolated. 32/32 integration tests green. |
| 4 | Front : refonte du noyau crypto | done (new TS modules) | `base64`, `hkdf`, `aes`, `hmac`, `key-material`, `guard-derivation`, `argon2` rewritten in TS with branded types. HKDF domain separation (`nodea:aes` / `nodea:hmac`) replaces the raw-bytes double-import. `wipeMainKeyMaterial` placebo gone → honest `wipeRawBytes`. Guards cache moved to in-memory Map. 39/39 Vitest tests green. Legacy `*.js` modules left in place to not break JSX callers until Phases 5–6 migrate them. |
| 5 | Front : store unifié + flows auth | done (new TS, not yet wired into App.jsx) | Zustand store (`nodea-store.ts`) unifies auth + crypto + modules-runtime in one source. Typed API client (`client.ts`) with shared Zod schemas + `credentials: include`. `useSession` hook on the new back (`apiMe` → store). TSX pages `pages/next/Login`, `Register`, `ChangePassword` use React Hook Form + Zod + zxcvbn strength. CORS on the API for dev. 51/51 web Vitest tests green. Legacy JSX kept active until Phase 6 wires the new pages into the router. |
| 6 | Front : câblage Mood, Goals, Passage | done (partial — see notes) | Shared `MoodPayloadSchema`, `GoalsPayloadSchema`, `PassagePayloadSchema` in `@nodea/shared`. Generic `createCollectionClient(name, schema)` handles encrypt → POST → promote → list → decrypt → update → delete for any module. Mood/Goals/Passage TS services wire the generic to the new back. `window.mainKey` back door removed from `DeleteAccount.jsx` (SEC CRITIQUE closed). 4 end-to-end tests on real Postgres prove the full encrypted round-trip, including "no guard leak" contract. **Deferred to Phase 6b/8:** port the JSX module UIs (forms/history/graph) to TSX and swap their imports from the legacy `.js` services to these TS clients. The back is ready; the UI swap is the last carpentry step. |
| 7 | Modules manquants (Habits, Library, Review) | pending | |
| 8 | Routing, lazy, Error Boundaries, nettoyage libs | pending | |
| 9 | Tests & CI | pending | |
| 10 | Déploiement Docker + extinction PocketBase | pending | |

## Findings checklist

Mark each finding `[x]` when the code change is merged to `refacto` and tests (where applicable) pass.

### Security audit

- [x] **CRITIQUE** — `window.mainKey` fallback (Phase 6) — removed from `DeleteAccount.jsx`; only the in-memory store is accepted. If the key is absent the user must log back in rather than have a back door injected from any script.
- [x] **HAUTE** — Invite code filter injection (Phase 2) — Drizzle `eq()` parameterized
- [x] **HAUTE** — Invite code reuse (Phase 2) — atomic `SELECT ... FOR UPDATE` inside tx
- [x] **HAUTE** — `wipeMainKeyMaterial` ineffective (Phase 4) — removed, replaced with honest `wipeRawBytes(bytes)` that zeroes raw buffers only; CryptoKey limitation documented
- [x] **HAUTE** — Invite code enumeration (Phase 2) — no public check endpoint, codes hashed, rate limit on `/auth/register`
- [x] **HAUTE** — AES/HMAC key reuse — upgraded from MOYENNE (Phase 4) — HKDF-SHA-256 with distinct labels `nodea:aes` / `nodea:hmac`; sub-key separation proven by tests
- [x] **MOYENNE** — Guards cached in localStorage (Phase 4) — new cache is an in-memory Map cleared on logout
- [x] **MOYENNE** — No password policy (Phase 2 back; front in Phase 5) — zxcvbn ≥ 3 + min length 12, enforced on register and change-password (TSX forms show live strength)
- [ ] **FAIBLE** — `decryptWithRetry` — evaluate via tests (Phase 4)
- [x] **FAIBLE** — Legacy double-base64 fallback (Phase 4) — new modules expose only the standard base64/base64url helpers, no legacy branch
- [x] **INFO** — Verbose production logs (Phase 5) — TSX pages gate debug logs to `import.meta.env.DEV`

### Global audit

- [ ] **HAUTE** — No tests in the project (Phase 9, seeded in Phase 4)
- [x] **HAUTE** — Duplicate base64 implementations (2 sources) + `randomBytes` doublon (Phase 4) — new `base64.ts` is the single source for base64, base64url and `randomBytes`. Legacy `.js` modules stay until their JSX callers migrate in Phases 5–6.
- [x] **HAUTE** — Two parallel state systems (Phase 5) — new Zustand store unifies auth/crypto/modules-runtime in one source. Legacy `StoreProvider.jsx` + `modulesRuntime.js` will be deleted once JSX callers migrate (Phase 6+).
- [ ] **HAUTE** — Documented modules not implemented (Phase 7)
- [x] **HAUTE** — `guard.pb.js` doesn't cover all collections (Phase 3) — route factory mounts all 8 collections from one typed registry; adding a collection without guard is structurally impossible
- [ ] **MOYENNE** — JSX instantiated at import (Phase 8)
- [ ] **MOYENNE** — No URL-based routing for modules (Phase 8)
- [ ] **MOYENNE** — No React Error Boundary (Phase 8)
- [ ] **MOYENNE** — Inconsistent README install (Phase 10)
- [ ] **MOYENNE** — Dead imports in `modules-config.js` (Phase 5)
- [ ] **FAIBLE** — `_prevEntry` unused parameter (Phase 6)
- [ ] **FAIBLE** — Two date libs + two chart libs (Phase 8)
- [ ] **FAIBLE** — FR hardcoded in Homepage (Phase 6)
- [ ] **FAIBLE** — Dead `getPreferredName` fields (Phase 6)
- [ ] **FAIBLE** — `listDistinctThreads` loads 200 entries (Phase 6)
- [x] **FAIBLE** — Zombie deps in `package.json` (`crypto-js`, `argon2-browser`) (Phase 1)
- [ ] **INFO** — Silent plaintext module config (Phase 5)

**Total: 28 findings.**

## Working branch

- `refacto` — the migration happens here. Branched from `main` on 2026-04-17.
- Sub-branches OK for large phases; merge back to `refacto`, not `main`.
- `main` only receives `refacto` when an intermediate milestone is shippable (e.g. Phase 4 crypto fixes alone).

## When you close a phase

1. Check all findings the phase targets in the checklist above.
2. Update the **Phase progress** table (`done`).
3. Update `documentation/Migration-Roadmap.md` if the reality diverged from the plan (note the why).
4. Open a PR from `refacto` (or the phase sub-branch) when the phase's acceptance criteria are green.
