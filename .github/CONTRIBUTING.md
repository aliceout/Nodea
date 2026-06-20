# Contributing Guide

Welcome to the **Nodea** contributing guide.

Thank you for investing your time in this project — an end-to-end-encrypted, self-hostable personal-tracking app, built so it stays honest with its users even if maintainers change tomorrow.

This guide covers the **upstream** contribution flow: open an issue, create a pull request, get it reviewed, get it merged. If you're instead looking to **download Nodea and make it your own** (forking for yourself without submitting upstream), see [`nodea.app/docs/fork`](https://nodea.app/docs/fork) — different audience, different constraints.

## Contributions

Many ways to contribute exist, and writing code is not the only one.

Non-exhaustive list:

- Report a bug you ran into while using Nodea (the official instance or your fork).
- Improve the public docs at [`nodea.app/docs`](https://nodea.app/docs) (Security / Reprendre le projet / Self-host sections).
- Translate (FR / EN are already live; any other language goes through the files in `packages/web/src/i18n/locales/`).
- Improve accessibility — Nodea handles personal sensitive data, the app must be usable by everyone.
- Audit the crypto code and report findings — any external review is precious, especially on the OPAQUE / WebAuthn / AES-GCM layer.
- Test an open PR and comment on what works / what doesn't.
- Take part in issue discussions — an outside perspective on a trade-off is often what moves things forward.

More leads: <https://opensource.guide/how-to-contribute>

### Opening a new issue

Before opening an issue, check that a similar one doesn't already exist (search closed issues in particular). If none, open a new one with:

- A **descriptive title**: "The X button doesn't work on Firefox" rather than "bug".
- The **Nodea version** affected (commit SHA visible at `/version`).
- The **browser + OS**, especially for UI bugs.
- **Reproduction steps**, numbered.
- **Expected** vs **observed** behavior.
- Screenshots or a log excerpt if relevant — **never** session cookies, passwords, or tokens in shared logs.

### Solving an issue

Browse existing issues to find one you're interested in. You can filter by label (`good first issue`, `bug`, `feature`, `crypto`, etc.).

If you take an issue, **assign yourself** or leave a "I'm on it" comment — this avoids two people working on the same thing in parallel. If you end up running out of time, say so, and someone else can pick it up.

### Reproducing a reported bug

You can contribute by confirming an issue reproduces (or doesn't) on your machine, and adding the missing details. It's a huge service to maintainers.

### Testing a pull request

You can merge a PR locally into your copy of the project, run the test suite (`pnpm --filter @nodea/api test && pnpm --filter @nodea/web test`), navigate the app to validate behavior, then comment your feedback on the PR.

### Submitting code changes

#### 1. Fork the repo

This way you can modify without affecting the original project until you're ready to propose the merge.

#### 2. Local setup

Detailed at [`nodea.app/docs/fork`](https://nodea.app/docs/fork). Express version:

```bash
git clone https://github.com/<you>/Nodea.git
cd Nodea
pnpm install
cp .env.example .env
# edit .env (at least COOKIE_SECRET and OPAQUE_SERVER_SETUP)
docker compose up -d postgres mailpit
pnpm --filter @nodea/api db:migrate
```

#### 3. Create a working branch

From the current dev branch (see [Branch organisation](#branch-organisation) below). Naming convention: `<type>-<short_description>` in snake_case.

```bash
git checkout -b feature-add_review_export
```

#### 4. Make your changes

Keep the PR **focused**: one subject per PR. Add / update tests. Run the suites before committing to catch regressions:

```bash
pnpm --filter @nodea/api typecheck && pnpm --filter @nodea/api test
pnpm --filter @nodea/web typecheck && pnpm --filter @nodea/web test
```

#### 5. Commit your changes

Commit format: prefix + imperative message, in English or French (consistent across the whole PR).

```text
feat(library): support Goodreads import
fix(auth): prevent double-submit on register form
docs(security): clarify threat model on change-email
refactor(store): move selectors into selectors.ts
chore(deps): bump react-hook-form 7.54 → 7.55
```

Accepted prefixes: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`, `ci`. Avoid `wip` or `tmp` — squash-merge cleans them up on the reviewer side, but better not to introduce them.

#### 6. Open the pull request

- **Title**: short, descriptive (the `feat:` / `fix:` prefix lives in the commit message, not necessarily in the PR title).
- **Description**: explain the **why** (what user-visible behavior changes?) more than the **what** (the diff speaks for itself).
- **Link the issue** if you resolve one (`Closes #42`).
- **Tick "Allow edits from maintainers"** so we can update your branch in case of conflict before merging.
- **Don't mark as "Ready for review"** while your PR is in draft — a draft PR signals to the reviewer that you know there's still work to do.

If you're not familiar with the pull request workflow:

- <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests>
- <https://www.dataschool.io/how-to-contribute-on-github>

#### 7. Review process

Once your PR is open, a maintainer will examine it. **Timing: variable** — Nodea has no full-time maintainer, expect several days for a first reply. If nothing after 2 weeks, feel free to leave a polite ping comment on the PR.

During review:

- We may ask questions or request clarifications — the goal is to understand the context of your change, not to make you rewrite it.
- We may request modifications before merging (inline suggestions or review comments).
- As you update your PR, mark each conversation as **resolved** once the topic is addressed.
- If you hit a merge conflict, this git tutorial helps: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts>.

#### 8. Your PR is merged

Congrats 🎉 Thanks for your contribution ✨

## Branch organisation

### Principles

- The **production branch** is `main`. Published at <https://nodea.app>.
- The **development branch** is the current refactor branch (e.g. `refacto-design-v2` today). Most PRs target it. Once stabilized, it merges into `main` and a new refactor branch is created if needed.
- A **dedicated branch per feature / bugfix / chore**, branched off the current dev branch.

### Diagram

```text
main
└── refacto-design-v2  (current dev branch)
    ├── feature-add_review_export
    ├── bugfix-double_submit_register
    ├── docs-clarify_threat_model
    └── chore-bump_react_hook_form
```

### Naming branches

#### Branch types

The prefix makes the branch's purpose immediately readable:

- **feature**: adding a new feature.
- **bugfix**: fixing a bug.
- **hotfix**: fixing a critical bug in prod (rare).
- **refactor**: restructuring without behavior change.
- **chore**: maintenance task (deps, CI, build).
- **docs**: documentation only.
- **test**: adding / modifying tests.
- **experiment**: exploration, no guarantee of being merged.

#### Format

- Prefix + dash + snake_case description.
- Less than 50 chars total.
- Description short but explicit: `feature-add_review_export` rather than `feature-export`.

Examples:

```text
feature-add_review_export
bugfix-double_submit_register
hotfix-totp_window_drift
refactor-split_admin_routes
chore-bump_drizzle_kit
docs-clarify_threat_model
```

### Versioning

Version number in the format `a.b.c` ([SemVer](https://semver.org/)):

- **a — Major**: breaking change for clients (mobile, API consumers). E.g. removing an endpoint, changing the OPAQUE contract.
- **b — Minor**: new non-breaking feature. E.g. new module, new optional field.
- **c — Patch**: bug fix, imperceptible minimal change. E.g. fixing a botched selector, dependency bump.

### Merge direction

```text
feature-add_review_export
│ Tests green in your fork?
│ If yes → pull request
│
└── refacto-design-v2 (dev branch)
    │ Branch roadmap completed + reviewed?
    │ If yes → merge
    │
    └── main
        │ Production deploy on https://nodea.app
```

## Coding conventions

### General

Nodea is **open-source AGPL** software. The code is read by as many people as write it — make it pleasant to read.

It's like driving: you can pull stunts when you're alone, that's your business. With passengers, the goal is to make the ride as smooth as possible.

### Readability

- **Strict TypeScript** — no `any` in production code. If you must escape briefly, `// eslint-disable-next-line` with a one-line justification.
- **2 spaces** for indentation (never tabs).
- **Spaces after list items and method parameters**: `[1, 2, 3]` not `[1,2,3]`. Around operators: `x += 1` not `x+=1`.
- **No commented-out code.** Git remembers. If you hesitate, delete — `git log -p` recovers.
- **Comments in English**, but user-facing strings in French (i18n via `t()`).
- **Inclusive French** only for humans (« utilisateur·rice·s »), not for objects (« un critère actif », not « actif·ve »).

### Tailwind CSS

- Prefer `flex` and `grid` over manual margins.
- Avoid `margin` between elements of the same group — use `gap`.
- Reuse the `ui/atoms/` primitives before creating a new component.

### Accessibility

Nodea is used for sensitive personal data — it must be accessible by default, not as an afterthought.

- Every image carries an `alt` (empty if decorative: `alt=""`).
- Every icon-only button carries an `aria-label` or a `<span class="sr-only">`.
- Every form input has an associated `<label>` (via `htmlFor` or wrapping).
- Color contrast at WCAG AA minimum (the design token system respects it by default).
- Every clickable element is keyboard-focusable AND has a visible focus ring (`focus-visible:*` Tailwind).

### Crypto invariants to respect

Nodea is end-to-end encrypted. A few rules silently break security:

- **Never a `CryptoKey` or raw crypto material in a log, the DOM, or `localStorage`.** No `console.log(mainKey)`, no `window.mainKey`. The main key lives in WebCrypto memory as `extractable: false`.
- **HKDF with distinct labels** between AES-GCM and HMAC-SHA-256 (`"nodea:aes"` and `"nodea:hmac"`).
- **One single source for `randomBytes` and base64.** The shared module already exists.
- **HMAC guards are NEVER persisted to `localStorage`.** In-memory cache only.
- **Branded types** (`Base64`, `AesMainKey`, `HmacMainKey`, `CipherIV`) — confusing types must fail at compile time.

The full list of invariants and their rationale lives at [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech) (prescriptive — source in `packages/web/src/app/pages/docs/content/tech.md`).

### Tests

Before opening a PR, run the 3 suites:

```bash
pnpm --filter @nodea/api test  # ~3 min
pnpm --filter @nodea/web test  # ~5 s
pnpm --filter @nodea/e2e e2e   # ~3-5 min, requires Postgres + Mailpit + Chromium
```

A PR with red tests will be put on hold until fixed before review.

For the test structure detail, see [`nodea.app/docs/fork`](https://nodea.app/docs/fork) section "Running the tests".

## License

Nodea is under **AGPL-3.0-or-later**. It's a "network" copyleft license — any derivative version distributed (including served via a server) must itself be published under AGPL.

By contributing, you agree your code is published under that same license. That's what guarantees Nodea stays free, even if someone forks and commercializes it.

## Code of Conduct

This project adopts a [Code of Conduct](./CODE_OF_CONDUCT.md) (based on the *Citizen Code of Conduct*). By participating — issue, PR, comment, translation — you agree to follow it.

In short: technical disagreement OK, personal disagreement not OK. No harassment, no gatekeeping. Maintainers reserve the right to close an issue or PR without reply if the tone is unacceptable.

To report behavior, see section 9 of the Code of Conduct.

---

Thanks again for contributing. The project exists because people like you show up.
