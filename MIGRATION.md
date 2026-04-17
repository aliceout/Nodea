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
| 2 | Back : DB, auth, sessions, invitations | pending | |
| 3 | Back : modules CRUD + guards | pending | |
| 4 | Front : refonte du noyau crypto | pending | HKDF AES/HMAC separation is the highest-priority fix |
| 5 | Front : store unifié + flows auth | pending | |
| 6 | Front : câblage Mood, Goals, Passage | pending | |
| 7 | Modules manquants (Habits, Library, Review) | pending | |
| 8 | Routing, lazy, Error Boundaries, nettoyage libs | pending | |
| 9 | Tests & CI | pending | |
| 10 | Déploiement Docker + extinction PocketBase | pending | |

## Findings checklist

Mark each finding `[x]` when the code change is merged to `refacto` and tests (where applicable) pass.

### Security audit

- [ ] **CRITIQUE** — `window.mainKey` fallback (Phase 6)
- [ ] **HAUTE** — Invite code filter injection (Phase 2)
- [ ] **HAUTE** — Invite code reuse (Phase 2)
- [ ] **HAUTE** — `wipeMainKeyMaterial` ineffective (Phase 4)
- [ ] **HAUTE** — Invite code enumeration (Phase 2)
- [ ] **HAUTE** — AES/HMAC key reuse — upgraded from MOYENNE (Phase 4)
- [ ] **MOYENNE** — Guards cached in localStorage (Phase 4)
- [ ] **MOYENNE** — No password policy (Phase 2 back + Phase 5 front)
- [ ] **FAIBLE** — `decryptWithRetry` — evaluate via tests (Phase 4)
- [ ] **FAIBLE** — Legacy double-base64 fallback (Phase 4)
- [ ] **INFO** — Verbose production logs (Phase 5)

### Global audit

- [ ] **HAUTE** — No tests in the project (Phase 9, seeded in Phase 4)
- [ ] **HAUTE** — Duplicate base64 implementations (2 sources) + `randomBytes` doublon (Phase 4)
- [ ] **HAUTE** — Two parallel state systems (Phase 5)
- [ ] **HAUTE** — Documented modules not implemented (Phase 7)
- [ ] **HAUTE** — `guard.pb.js` doesn't cover all collections (Phase 3)
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
