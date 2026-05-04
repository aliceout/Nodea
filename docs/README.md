# Nodea documentation (repo-side)

This folder is **for contributors** who modify the code. End-user,
self-hoster, and forker docs live in-app at:

- [`nodea.app/docs/security`](https://nodea.app/docs/security/newbie) — how end-to-end encryption works, in 3 reading tiers (basics / mechanics / under the hood).
- [`nodea.app/docs/fork`](https://nodea.app/docs/fork) — taking Nodea for yourself (local setup, structure, tests, invariants to respect, rebrand).
- [`nodea.app/docs/self-host`](https://nodea.app/docs/self-host) — installing your own instance.

For the **upstream contribution workflow** (opening an issue, filing
a PR, commit conventions), see
[`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md).

---

## Repo-side technical reference

Prescriptive documents read before working on the relevant area.
Single source of truth: code and doc must stay aligned, a divergence
is a doc bug to fix in the same PR that introduces it.

| Read | Before touching |
|---|---|
| [Architecture.md](./Architecture.md) | Code structure, runtime flow, middleware stack, modules' shared schema (§7) |
| [Auth-Spec.md](./Auth-Spec.md) | OPAQUE, MFA, recovery, bypass, stepped MFA, session re-auth — exhaustive reference, not a quick read |
| [auth/`<Flow>`.md](./auth/) | Per-flow detail (Register, Login, ChangePassword, ChangeEmail, Recovery, BypassMfa, Lifecycle) |
| [Database.md](./Database.md) | Postgres schema, integrity constraints, FK cascades, AAD for each encrypted blob |
| [Modules/`<Module>`.md](./Modules/) | Cleartext payload + module-specific business rules (Goals, Habits, Journal, Library, Mood, Review) |
| [Internationalisation.md](./Internationalisation.md) | i18n system, adding a key, adding a language, FR/EN parity |
| [Release-Checklist.md](./Release-Checklist.md) | Steps to validate before tagging a release |
| [adr/](./adr/) | Architectural Decision Records — read the relevant ADR before challenging a pattern |

**Before touching crypto code**, the "under the hood" doc at
[`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
is prescriptive (HKDF, AAD, branded types, rate-limit catalog, GDPR,
forbidden patterns). Source in
[`packages/web/src/app/pages/docs/content/tech.md`](../packages/web/src/app/pages/docs/content/tech.md).

---

## Conventions

- **Single source of truth.** Code and doc kept aligned; a divergence
  is a doc bug, fixed in the same PR that introduces it.
- **Code wins over spec** when an actual divergence is observed
  (`Auth-Spec.md` repeats this point in its preamble).
- **Inclusive French** applies to people only (`utilisateur·ice·s`),
  never to objects (« un critère actif », not « actif·ve »).
- **Code comments and JSDoc in English**, user-facing strings in
  French (per i18n).

---

## Related files

- [`/CLAUDE.md`](../CLAUDE.md) — internal instructions for the AI
  assistant that contributes to the code. Not a user document, but
  exposes the hard rules (crypto, monorepo, conventions).
- [`/README.md`](../README.md) — repo README, developer entry point
  (install, dev, tests).
- [`/.env.example`](../.env.example) — documented environment
  variables.
- [`/.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md) — upstream
  contribution workflow (issues, PRs, commit conventions).
- [`/.github/CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) —
  Code of Conduct (Citizen Code of Conduct, CC BY-SA).
- [`/.github/SECURITY.md`](../.github/SECURITY.md) — vulnerability
  disclosure policy.
