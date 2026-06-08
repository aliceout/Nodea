# Changelog

Historique des versions de Nodea, généré automatiquement depuis
l'historique git à chaque release. Les commits sont groupés par
type (Conventional Commits) ; les chores de maintenance sont
pliés pour ne pas noyer l'essentiel.

## v2.8.0 — 2026-06-08

### Nouveautés

- **account** : portable encrypted .age backup _(e68a0bc)_
- **import-export** : cover Journal + all HRT collections; harden dedup keys _(779f3c0)_

### Corrections

- **gitignore** : anchor data/ ignore to the repo root _(61ccfc2)_

### Documentation

- **changelog** : regenerate for v2.7.0 _(f671f3f)_

<details>
<summary>Maintenance — 2 commits</summary>

- **release** : bump version to 2.8.0 _(c7c020d)_
- **deps** : bump the minor-and-patch group across 1 directory with 7 updates _(11202ae)_

</details>

## v2.7.0 — 2026-06-08

### Nouveautés

- **hrt** : analyses .xlsx import + data export to Excel/LibreOffice _(3e89196)_
- **hrt** : doctor Export sub-view (PDF/CSV), mL dosing, FR date fields _(a5176db)_

### Corrections

- **deps** : bump jspdf to 4.2.1 + jspdf-autotable to 5.0.8 _(5c67235)_

<details>
<summary>Maintenance — 1 commit</summary>

- **release** : bump version to 2.7.0 _(111f857)_

</details>

## v2.6.0 — 2026-06-07

### Nouveautés

- **ui** : borderless Select dropdown caret _(b3ab3fc)_
- **hrt** : archive products instead of deleting them _(f7b0ca7)_
- **hrt** : date-filter shapes the chart axis + foldable/sticky chart on Analyses _(3c4f995)_
- **hrt** : recurring dose schedules (materialised series) _(2ae1dec)_

### Documentation

- **changelog** : regenerate for v2.6.0 _(2e40de5)_

<details>
<summary>Maintenance — 2 commits</summary>

- **release** : bump version to 2.6.0 _(cd032a9)_
- **api** : set archived on the HRT product seed fixtures _(310df5e)_

</details>

## v2.5.0 — 2026-06-07

### Nouveautés

- **hrt** : date-range filter on Administration and Analyses _(472bd3d)_
- **hrt** : Synthèse landing dashboard _(b45c022)_
- **ui** : borderless variant for the Select atom _(00279a6)_

### Documentation

- **changelog** : regenerate for v2.5.0 _(b87d102)_

<details>
<summary>Maintenance — 1 commit</summary>

- **release** : bump version to 2.5.0 _(b257a6b)_

</details>

## v2.4.0 — 2026-06-07

### Nouveautés

- **hrt** : enrich molecule catalog with brand hints and more molecules _(e661d3c)_

### Refactor

- **hrt** : extract list/filter components and group dose log by molecule _(ef460d1)_
- **shared** : split module payload schemas into one file per module _(3f4c18c)_

### Documentation

- **changelog** : regenerate for v2.4.0 _(2d7b38a)_
- **changelog** : include CI fix in v2.3.0 _(e09c025)_

<details>
<summary>Maintenance — 1 commit</summary>

- **release** : bump version to 2.4.0 _(46fc953)_

</details>

## v2.3.0 — 2026-06-06

### Nouveautés

- **web,hrt** : HRT module — sidebar, Administration, Analyses, Produits _(06d12c0)_
- **api** : HRT collections, tables, migration + test seeder _(f878ad4)_
- **shared** : HRT schemas, product catalog, marker presets + target ranges _(fc2b18d)_

### Corrections

- **hrt** : un-ignore data hooks — rename data/ -> hooks/ _(e71e690)_

### Documentation

- **changelog** : regenerate for v2.3.0 _(94d28fb)_
- **claude** : drop refacto-design-v2 refs, note HRT module _(2940a78)_
- **changelog** : regenerate for v2.2.0 _(f87d437)_

<details>
<summary>Maintenance — 1 commit</summary>

- **release** : bump version to 2.3.0 _(8449dbb)_

</details>

## v2.2.0 — 2026-06-05

### Nouveautés

- **mood,journal,heatmap** : filter on cell click + hover scale + dismissible day chip _(f269b61)_
- **goals** : celebrate wins — pill+icons left, no strike-through, thread chips à la Journal _(cbe4924)_
- **settings,theme** : pick a background shade among five sage-friendly tones _(3bf2f52)_
- **mood,donut** : click a segment to filter entries by that score _(3985540)_
- **mood,frise** : auto-collapse on scroll-down with a smooth grid-rows transition _(4bbcdea)_

### Refactor

- **sidebar,prefs** : turn language + theme toggles into text cyclers under the sync line _(8d85beb)_

### Documentation

- **changelog** : regenerate for v2.1.0 _(41ab362)_

<details>
<summary>Maintenance — 1 commit</summary>

- **release** : bump version to 2.2.0 _(6ed6a3b)_

</details>

## v2.1.0 — 2026-06-04

### Nouveautés

- **auth,login** : normalise passkey 2FA recovery affordance to match TOTP _(1d8b988)_
- **goals,mobile** : filters collapse _(97535df)_
- **library,mobile** : hide view-mode toggles + filters collapse _(cde9c46)_
- **journal,mobile** : compact frise + single-col entries + filters collapse _(ea0aefd)_
- **mood,mobile** : compact frise + single-col entries + hide stats sidebar + chart toggle label _(d7dab04)_
- **topbar,mobile** : right-anchor hamburger + bordered + hide label _(724aafc)_
- **mood,composer** : editable date + wider modal + auto-grow textareas _(7fa3ae9)_
- **ui** : add Modal size + Textarea autoGrow opt-in props _(a560f50)_
- **api,config** : accept ADDRESS as bare host (e.g. nodea.app) _(5ec7edc)_

### Corrections

- **trivy** : skip-dirs app/node_modules to stop the Go-stdlib drip + clean .trivyignore _(8250b5b)_
- **trivy** : mute CVE-2026-39826 (Go html/template via Chrome) _(8975729)_
- **trivy** : mute CVE-2026-39825 (Go stdlib ReverseProxy query forwarding) _(81ec14e)_
- **trivy** : use CVE-2026-47429 (not GHSA) + add Go and libxml2 follow-ups _(64c0712)_
- **api,test** : merge helpers.ts into setup.ts so OPAQUE client/server share modules _(e3158d1)_
- **api** : stash in-memory state on globalThis for Vitest 4 isolation _(cbab6c9)_
- **api,test** : add setup.ts import to auth-login-v2 + log-opacity too _(80c4167)_
- **api,test** : replace setupFiles config with explicit per-file import _(6a36c77)_
- **api,test** : try pool:vmThreads — sandboxed VM context for true module sharing _(05acdd7)_
- **api,test** : pool:threads + maxWorkers:1 + isolate:false (Vitest 4 singleThread) _(cd4f818)_
- **api,test** : apply Vitest 4 official singleFork replacement (maxWorkers:1 + isolate:false) _(f0c34a8)_
- **api,test** : switch pool from forks to threads for Vitest 4 OPAQUE stability _(f074b84)_
- **api,opaque** : drop dynamic import of opaque.ts in seedOpaqueUser _(170a1f8)_
- **api,test** : add isolate:false to share module graph across api test files _(18de0d6)_
- **api,test** : use fileParallelism:false for sequential api tests on Vitest 4 _(e2ff3a9)_
- **sidebar,mobile** : drawer width + close drawer on Account/Admin/Logout _(aa638ae)_
- **deploy** : pull smtp/ and hsts/ Infisical sub-folders too _(4e96526)_
- **ci** : rename WEB_BASE_URL → ADDRESS to match the new config schema _(3b7f9bc)_
- **compose** : wire OPAQUE_SERVER_SETUP + 3 other api env vars compose was dropping _(fcf4e69)_
- **api** : pin tsx 4.22 → 4.19.2 to dodge Node 24 JSON-loader regression _(7538f40)_
- **api** : lazy-load @sentry/node so a broken transitive doesn't crash boot _(8e76435)_
- **compose** : wire DOMAIN, WEB_BASE_URL, WEBAUTHN_RP_NAME into the api service _(f01ca97)_
- **api,deploy** : fetch Infisical root + tolerate empty optional URLs _(71079bc)_

### Refactor

- **shared,api,web** : switch ZodTypeAny -> z.ZodType in the 3 generic-constraint helpers _(a0f673c)_
- **shared,api** : migrate .passthrough() to z.looseObject() idiom _(2e5472a)_
- **shared** : migrate UsernameField regex error to Zod 4 canonical { error: ... } form + canary test _(6d9b441)_
- **shared,api** : migrate string-format validators to Zod 4 top-level forms _(526c9f4)_
- **api** : factor every defaultHook into a single defaultInvalidBodyHook _(44b5ed8)_
- **api,compose** : drop WEB_BASE_URL — ADDRESS becomes the canonical source _(acbfd88)_

### Documentation

- ADR-0014 Zod 3 -> 4 migration + sync passthrough mentions _(98f5870)_

### Autres

- revert: roll back the entire Vitest 4 migration saga + add audit-ignore for the unused-UI advisory _(3ea5d9c)_
- debug(api,rate-limit): log module instance id + reset/429 events _(799e254)_
- debug(api,test): count setup.ts beforeEach fires to localise Vitest 4 hook issue _(eec0032)_
- debug(api,opaque): instrument storeLoginState + consumeLoginState _(f167ec3)_
- revert(api,test): drop isolate:false — same 17/30 file failures as default _(d6885d6)_

<details>
<summary>Maintenance — 14 commits</summary>

- **release** : bump version to 2.1.0 _(a69c05b)_
- **shared** : lock module-payload .default() round-trip behaviour under Zod 4 _(9612f07)_
- **deps** : bump zod 4.4.3 + @hookform/resolvers 5.4.0 + @hono/zod-openapi 1.4.0 (atomic) _(3e136dc)_
- **deps,test** : bump vitest 4.1.8 + @vitest/coverage-v8 4.1.8, anchor in-memory state on globalThis _(292bc02)_
- **deps** : bump typescript-eslint 8.59.3 -> 8.60.1 (lift collateral revert) _(43fbfdc)_
- **deps** : bump tsx 4.19.2 -> 4.22.4 (Node 24 JSON regression resolved upstream) _(564ae84)_
- **deps** : bump otplib 13.4.1 (api + e2e lockstep) _(b345cc4)_
- **deps** : bump @simplewebauthn/server 13.3.1 (server-only Packed/SafetyNet fix) _(6e83121)_
- **deps** : bump @types/react 19.2.16 patch _(1cc4edf)_
- **deps** : bump web runtime patches/minors _(5e8769f)_
- **deps** : bump api runtime patches (hono, nodemailer security, sentry-node) _(983af68)_
- add Trivy ignore for GHSA-5xrq-8626-4rwp (vitest UI server, unused) _(bba179c)_
- **deps** : bump patch/minor + vitest 4 (security) _(5ba86f7)_
- **api,ci** : silence '.env not found' noise in containerised/CI runs _(4f2dfb2)_

</details>

## v2.0.1 — 2026-05-15

### Corrections

- **deploy** : correct repo-root resolution after `infra/scripts` → `scripts` move _(e3f187d)_

### Refactor

- **api** : derive WebAuthn rpId/origin from DOMAIN/WEB_BASE_URL _(469b044)_

### Documentation

- **changelog** : regenerate for v2.0.1 _(24dd825)_

### Autres

- revert(ci): restore .trivyignore — node 24 bump didn't clear the vendored CVEs _(f6816a7)_

<details>
<summary>Maintenance — 13 commits</summary>

- **docker** : drop dangling `trivyignores: ./.trivyignore` reference _(13b7e0c)_
- **release** : bump version to 2.0.1 _(3bb8821)_
- untrack dev-setup.yaml, drop .trivyignore (CVEs cleared by base-image bump) _(beb5e1d)_
- **deps-dev** : Bump vite in the minor-and-patch group _(a614d32)_
- **dependabot** : ignore semver-major bumps in the regular schedule _(ee03804)_
- **docker** : bump base image node 22-alpine → 24-alpine (LTS-track) _(e75902f)_
- **deps** : Bump actions/upload-artifact from 4 to 7 _(2203642)_
- **deps** : Bump actions/setup-node from 4 to 6 _(d05c3b6)_
- **deps** : Bump actions/checkout from 4 to 6 _(e02299e)_
- **dev-setup** : migrate Infisical batches to /services/nodea/* on Cloud _(fe27769)_
- **deploy** : migrate Infisical paths to /services/nodea/* on Cloud _(42f7435)_
- **deps** : Bump the minor-and-patch group with 5 updates _(857ed42)_
- **deps** : Bump docker/login-action from 3 to 4 _(7212def)_

</details>

## v2.0.0 — 2026-05-15

### Nouveautés

- **home** : typographic redesign — hairline sections, year heatmaps, moments flashback _(4776288)_
- **home,journal** : redesign WIP — journal-density strip, year filter, threshold rebalance _(3c766d8)_
- **auth** : align always_2fa activation/downgrade/bypass with #72 _(ac9fe76)_
- **home,journal** : hide Habits sidebar block, switch Journal heatmap to circles _(f603ac1)_
- **changelog** : auto-generated release notes at /changelog (closes #91) _(c68883b)_
- **journal** : writing heatmap / calendar view (closes #56) _(dcee1d7)_
- **journal** : thread manager (rename / merge / delete + stats) (closes #57) _(caba608)_
- **journal** : « Il y a un an » panel above the entry list (closes #58) _(51c3f14)_
- **goals** : reader mode + extract shared EntryReader shell (closes #64) _(eb15065)_
- **auth** : split /recover into 2 steps (verify → set password) (closes #48) _(8442d0e)_
- **goals** : inline title rename via double-click (closes #65) _(ce61279)_
- **records** : unify per-module endpoints under /records (closes #67) _(34c182b)_
- **login-mfa** : picker UI when always_2fa offers TOTP or passkey (closes #72) _(187c8df)_
- **auth** : dual-mail anti-enum on open register (closes #45) _(a7a2ba9)_
- **auth** : accept TOTP OR passkey as 2nd factor in always_2fa password-first (closes #72) _(f1d371f)_
- **opacity** : wholesale-prefix log redaction + Sentry scrubber stubs (closes #71) _(e268995)_
- **sessions** : privacy-first active sessions list (closes #47, #34) _(c414712)_
- **library** : per-module search bar (closes #94) _(fc05ee8)_
- **journal** : move search from sidebar to topbar + use shared helper (closes #93) _(3a22bad)_
- **mood** : per-module search bar (closes #92, partial #33) _(b4bc629)_
- **web/i18n** : add language toggle ariaLabel translation key _(32af07d)_
- **terms** : wirer la route /terms + lien depuis Login _(c050982)_
- **docs** : restructurer /docs en 3 sections (Sécurité / Contribuer / Auto-héberger) _(cde9c1b)_
- **api** : générer OpenAPI à partir des routes (API-11 moyen terme, livré) _(303bdf6)_
- **api** : conventions HTTP non-breaking — 201 Location, X-Order, audit (API-05/13/16 + SEC-10) _(5f66c51)_
- **web** : a11y + SEO — page titles, scroll restoration, canonical (FRONT-04/06/07/12) _(da7fc47)_
- **api** : câbler les ResponseSchema sur les call sites existants (API-11) _(87fba4c)_
- **api** : wrapper request() avec responseSchema optionnel + dev-only validation (ARCH-12) _(9d2d502)_
- **ops** : Sentry SDK api + web avec beforeSend agressif (Tier 1 étape C pas 2, OPS-02) _(75c6b94)_
- **ops** : webhook 5xx fire-and-forget (Tier 1 étape C pas 1, OPS-02 partiel) _(4b0b7f7)_
- **ops** : healthcheck honnête /healthz + healthcheck Docker compose (OPS-01 + OPS-04) _(c4abfac)_
- **api** : GET /version (commit + build_date + branch) (API-15) _(c263260)_
- **docs** : URLs par onglet + anchors sur titres + OG/Twitter meta (FRONT-11 élargi) _(f405a81)_
- **email** : bilingue FR/EN via Accept-Language (Tier 5) _(3868a05)_
- **i18n** : parity test + i18n:diff CLI + doc rewrite (Tier 6) _(820ca71)_
- **i18n** : drop FR-only month/day arrays via Intl helpers (Tier 3 part 2) _(9173529)_
- **i18n** : make date-format locale-aware (Tier 3 part 1) _(1c1e5a7)_
- **i18n** : add tn() plural helper + sweep call-sites _(1c11e51)_
- **i18n** : add review namespace + wire Review UI through t() _(5ebd06a)_
- **i18n** : fill passage namespace + wire Journal/* through t() _(38d91cc)_
- **i18n** : fill mood namespace + close Tier 0 §2 questions bug _(170d54a)_
- **errors** : unify API error code translation (Tier B.4 health) _(8127cab)_
- **brand** : migrate to Direction A spiral logo _(f09d73c)_
- **i18n** : fill common namespace + wire shared atoms through t() _(1c2fc99)_
- **i18n** : fill account namespace + wire Account/* through t() _(e36b561)_
- **library** : polish the book composer _(483e934)_
- **mood** : introduce 3 contexts + MoodProvider _(9d4e6a6)_
- **routing** : freeze /flow URL — popstate sync + catch-all redirect _(78c9fcb)_
- **store** : add `flow` slice (currentModule + librarySubview) _(1f17e45)_
- **docs** : add stepped-MFA + MFA-bypass SVG diagrams _(4cbeee6)_
- **docs** : add ThemeSwitch component used by DocsTopbar _(f39fe1d)_
- **docs** : hand-coded SVG diagrams for key hierarchy + OPAQUE flow _(ce71eaf)_
- **web** : /docs migrated to markdown + tabs in topbar + sticky TOC rail _(3a86975)_
- **home** : real Goals on the « Aujourd'hui » side column _(4a0520e)_
- **goals** : year-end carry-over of unfinished goals _(61bbe36)_
- **goals** : completed_at timestamp + « Masquer les terminés » toggle _(50cab10)_
- **goals** : composer drafts, markdown note, thread chip suggestions _(ff188c2)_
- **goals** : full-text search + Date/Récent/A→Z sort options _(f997f9c)_
- **auth** : notify by email on recovery-code reset + security-mode auto-downgrade _(1b5cd93)_
- **journal** : inline image attachments per entry (3 max, client-resized) _(15a2c86)_
- **journal** : add focus reader mode with prev/next navigation _(72e28d8)_
- **journal** : rotating daily prompts in the Composer placeholder _(fc36d88)_
- **journal** : auto-save composer drafts in encrypted localStorage _(88c2018)_
- **journal** : search, group-by-month toggle, writing stats _(f6fa102)_
- **e2e** : Phase 7D — Playwright framework + smoke + TOTP scenarios _(56087b9)_
- **review** : align module exactly with the YearCompass booklet _(0c3caec)_
- **web** : SRI on entry chunk + INTEGRITY.txt manifest for bundle audit _(e4a87a0)_
- **web** : Phase 7B — front-end migration to /auth/reauth/password _(8e24120)_
- **auth** : Phase 7B — wire requireFreshPassword on every mutating route _(82631e7)_
- **auth** : Phase 7A — re-auth foundation (timestamps, middleware, endpoints) _(a30e73d)_
- **web** : MFA bypass UX polish — countdown days, amber escalation, cancel page drop _(4973389)_
- **auth** : MFA bypass delay 48h → 7 days, drop email cancel link _(7b135f9)_
- **web** : SPA pages for MFA bypass confirm/cancel + TOTP input split _(3dd5ad6)_
- **auth** : auto-cancel pending MFA bypass on successful login _(6889b44)_
- **auth** : Phase 6C — web client for MFA bypass + lost-factor flow _(8cd651f)_
- **auth** : Phase 6A-6B — MFA bypass by email (TOTP / passkey, 48h) _(cecb824)_
- **auth** : Phase 5D — security_mode UI + passkey-as-2nd-factor + auto-promote _(464a028)_
- **auth** : Phase 5A-5C — TOTP enrollment + stepped MFA at login _(6f85936)_
- **auth** : Phase 4 — passkey WebAuthn + PRF (sub-phases A-D) _(6f1bd7f)_
- **auth** : Phase 3 — recovery code KEK (BIP39 12 mots) _(a3820e8)_
- **auth** : change-password UX — rules + zxcvbn + confirmation + force-logout _(a75b688)_
- **auth** : Phase 2D — change-password / reset OPAQUE + drop legacy _(e9555c5)_
- **auth** : Phase 2C — login OPAQUE 2-step replaces Argon2id _(db9f077)_
- **auth** : Phase 2B — register OPAQUE 2-step replaces Argon2id _(3b1ddca)_
- **auth** : Phase 2A — OPAQUE scaffolding (lib + wrappers + helpers) _(3220427)_
- **auth** : require a public username at register _(cfe490d)_
- **auth, ui** : inline onboarding + finish K · Sauge port _(98c4024)_
- **auth** : switch invites to email-bound links + open-registration toggle _(4c0035f)_
- **auth** : rework Phase 1 to single-form + magic-link activation _(fd05a1e)_
- **auth** : Phase 1C — multi-step register wizard + set-password bridge _(3f94c8c)_
- **auth** : Phase 1B — multi-step register routes (start, verify, state) _(40e80a3)_
- **auth** : Phase 1A — pluggable EmailService abstraction _(a7da022)_
- **library, ui** : page views, sub-routes, dirk atoms, sidebar refresh _(46fcab7)_
- **library** : streaming lookup pipeline + cover persist + filter overhaul _(e86fed1)_
- **auth** : Phase 0 — Auth-Spec + schema draft for OPAQUE/passkey/TOTP _(5d60884)_
- **library** : multi-provider badges + Amazon cover preference _(445a40d)_
- **library** : Amazon adapter via Puppeteer headless to pass AWS WAF _(2b6be9d)_
- **library** : module Phase 1 + Phase 2 — schema, K page, lookup proxy, Admin Sources _(3d14427)_
- **web** : replace Passage module with Journal _(7f7b1c2)_
- **web** : K · Sauge polish across pages + Goals TS port _(2cbf4b4)_
- **auth** : port Login/Register/RequestReset to K + tighten password policy _(c79184f)_
- **web** : K-styled theme toggle in the sidebar + port Settings to Direction K _(d2dfced)_
- **web** : per-segment donut labels + readable mood scale _(fb67717)_
- **web,api** : wire Mood to real entries + dev-only mood seed + donut _(d74ce51)_
- **web** : terracotta tone for negative mood + sticky shell _(1e6c376)_
- **web** : Direction K — Empty Home + global ⌘K Composer _(58505b7)_
- **web** : port Mood + Passages to Direction K · Sauge _(a40d8d3)_
- **web** : Direction K — Login + Account (4 onglets) _(4175ca7)_
- **web** : Direction K shell + Homepage — pixel port of K_Home _(dea51f4)_
- **web** : Direction K design tokens — Sauge palette + Instrument typography _(5adeb44)_
- **ci** : build + push api/web images to GHCR on every green CI _(b03b033)_
- **infra** : add deploy.sh for the VPS webhook hand-off _(642e060)_
- **web,api** : greet by username + ADMIN_USERNAME in seed _(6aa8dbe)_
- **dev** : add dev-only Mailpit SMTP sink _(64ff5e5)_
- **api,web** : SMTP + password-reset by email (#22 / R13) _(1a61f55)_
- **api,web** : encrypted user preferences, synced cross-device (#21 / R12) _(f1b2ecc)_
- **api,web** : onboarding flow — modal + /auth/onboarding/complete (#20 / R11) _(476c7d7)_
- **api,web** : announcements table + admin CRUD + AnnouncementsManager (#19 / R10) _(1bc9287)_
- **web** : restore Homepage AnnouncementSpotlight + MoodOverview (#18 / R9) _(b85f4b8)_
- **web** : YearCompass guided Review wizard (#17 / R8) _(ee795bd)_
- **web** : flesh out Library with grid, covers, reviews, providers (R7) _(dd04d01)_
- **web** : flesh out Habits with heatmap + archive + full fields (R6) _(a1cbfa3)_
- **web** : restore Passage full feature set (R5) _(b556444)_
- **web** : restore Goals full feature set (R4) _(ae15988)_
- **web** : restore Mood full feature set (R3) _(e4dc450)_
- **api,web** : restore users.username + ChangeUsername (R2) _(de2eec7)_
- **web** : restore Export/Import data archive (R1) _(d0d1970)_
- **ops** : full Docker stack + updated README (Phase 10 / Step 7) _(4efc53a)_
- **web** : Habits / Library / Review UIs (Step 5) _(235bf6e)_
- **web** : port Mood / Goals / Passage to TSX on the new back (Step 4b-d) _(1cf0987)_
- **web** : port Homepage to TSX on the new store (Step 4a) _(fb68d85)_
- **web,api** : Account TSX + self-delete + change-email (Step 3d) _(30d0e9f)_
- **web** : port Settings to TSX on the new back (Step 3c) _(22c975d)_
- **web** : port Admin page to TSX on the new back (Step 3b) _(251f7f1)_
- **api** : admin endpoints for users and invites (Step 3a) _(72337e5)_
- **web** : wire the new TSX auth pages + ProtectedRoute (Step 2) _(32e9cc3)_
- **web** : useSession derives + stores main key end-to-end (Step 1) _(a0e9648)_
- **shared,web,api** : Habits / Library / Review back (Phase 7) _(1347783)_
- **web** : URL-driven module routing /flow/:moduleId (Phase 8b) _(68699b9)_
- **web** : ErrorBoundary + lazy-loaded modules (Phase 8a) _(a85a3ee)_
- **web/api** : typed module clients + E2E crypto tests (Phase 6, partial) _(a9764f2)_
- **web** : unified Zustand store + typed API client + auth TSX (Phase 5) _(96eb930)_
- **web/crypto** : TS rewrite with HKDF separation (Phase 4) _(2ea2810)_
- **api** : encrypted collections + guard factory (Phase 3) _(29b6e25)_
- **api** : auth + sessions + invites on Postgres (Phase 2) _(0269e69)_
- unify account settings ui _(3873e95)_
- update mood overview and history filters _(56e5af8)_
- **homepage** : split hero, spotlight, and quick actions into components _(0bc05aa)_
- add theme preferences and dark mode styling _(7a641c1)_
- **settings** : encrypt and persist user language preference _(2565a0b)_
- **settings** : add language selector and i18n documentation _(109ff24)_
- **homepage** : ajouter annonces admin et compacter les modules _(50ac141)_
- **homepage** : ajouter annonces admin et refondre bloc mood _(16de71f)_
- **homepage** : ajouter gestion des annonces admin _(76cd5a6)_
- **homepage** : transformer la home en hub interactif pour les modules _(11cdad4)_

### Corrections

- **journal/reader** : scope prev/next to same-thread neighbours + tighten bg vs bg-2 _(653bac9)_
- **e2e** : refuse reused dev api, seed open_registration (closes #95) _(97d801c)_
- **sessions** : replace double-confirm UX with a single Modal step _(addad94)_
- **e2e/test10** : route backdate-bypass through the api (DB alignment) _(d9e782b)_
- **library-lookup** : language-aware Amazon TLD + skip BNE for non-ES (closes #38) _(01fecf7)_
- **e2e/test11** : noWaitAfter sur le click qui pushState à /flow _(2dfbf3c)_
- **e2e** : align tests 06-13 with current UI roles, labels and dataflow _(b6db32e)_
- **web/mood** : parse entry dateIso as local midnight (filter timezone bug) _(f3c294f)_
- **e2e** : cinq fixes ciblés sur tests 02 / 06-13 _(1a0216c)_
- **e2e** : reset rate-limit avant chaque test, pas seulement au globalSetup _(c40005e)_
- **e2e** : aligner login post-activation sur getByLabel + data-testid pour totp-secret _(3c9d853)_
- **e2e** : cause racine — rate-limit en mémoire qui survit aux runs _(f02e9c3)_
- **e2e** : ancrer les regex restantes du flow register pour fermer le cycle _(1532608)_
- **e2e** : ancrer la regex du bouton « Se connecter » pour exclure « Se connecter avec une passkey » _(e2e5cdc)_
- **e2e** : aligner registerAndActivate sur le form Register actuel _(3d10c18)_
- **e2e** : suivre le rename du bouton register (S'inscrire → Créer mon compte) _(acdf973)_
- **state** : protéger les rollbacks optimistes contre les races (FRONT-13) _(92ed7cd)_
- **auth-login** : preserve anti-enum on /login/start when envelope is stale _(0e8660a)_
- **i18n** : sync <html lang> with active language + freeze docs decision _(d87c821)_
- **seed** : flip onboarding_status to complete after seed:test _(5da5e22)_
- **sidebar** : keep language + theme toggles at stable equal width _(7ff3bd4)_
- **seed** : library uses one shared `library` sid, not items/reviews split _(c9fef49)_
- **security** : restore minimum-readable-surface on entry tables _(29b8ceb)_
- **docs** : render GFM tables + style fenced code blocks _(3d04ee8)_
- **composer** : scope the editor scroll to the markdown surface only _(dd72df7)_
- **composer** : scroll long bodies inside the modal so the footer stays reachable _(3b224d3)_
- **library** : shrink 4ᵉ de couv textarea so the bottom row fits _(334bf39)_
- **auth** : drop email from recovery hash-mismatch log _(c32792e)_
- **auth** : rotate sessions on security-mode change (Auth-Spec §5.4) _(7c96d00)_
- **ui** : add missing AuthPanelHeader imports in Login + ChangePassword _(f599391)_
- **totp** : redirect to /flow after disabling TOTP _(c816814)_
- **auth** : WEBAUTHN_* env vars required + PRF input encoding + calibration _(6223ad8)_
- **crypto** : factor-wrap accepts base64url IKM (OPAQUE export_key shape) _(43e2aa6)_
- **test** : make migrate-test.ts a module so top-level await typechecks _(aa9cfbc)_
- **test** : isolate vitest on dedicated nodea_test DB (#41) _(a78439d)_
- **library** : FR-first lookup + Amazon author parser robustness _(dae372c)_
- **library** : handle page_count=0 from providers _(1b17eb8)_
- **library** : disable BNF byQuery — neither SPARQL path works _(4d28da9)_
- **library** : detect AWS WAF JS challenge on Amazon scraper _(15ad80d)_
- **library** : BNE via undici.request + diagnostic logging _(902dec9)_
- **library** : Amazon scraper — homepage-seeded session cookies + Referer _(6625361)_
- **api** : make seed:admin idempotent on username too _(ea6acdd)_
- **web** : restore Mood entry shape + readable -2..+2 sparkline _(6ebe853)_
- **infra** : pass ADMIN_* through to the api container + surface seed errors _(23967d0)_
- **infra** : fetch Infisical secrets from /api /postgres /web _(86b0def)_
- **web** : align Actions rapides cards + restructure ModuleCard _(c83b31a)_
- **web** : hydrate modules-config at layout mount _(8a19c19)_
- **web** : missing i18n keys for Habits/Library/Review + Modal overflow _(80791ec)_
- **web** : post-login nav stays client-side to preserve the derived main key _(9b994d3)_
- **web** : deduplicate session hydration across useSession() subscribers _(176e54a)_
- **web** : point index.html at main.tsx instead of the missing main.jsx _(2a3c7ba)_
- **web** : stop OnboardingModal's selector from returning a fresh array _(8805504)_
- **web** : start auth status as 'loading' to avoid a cold-reload redirect flash _(24d05d4)_
- **web** : default the API base to the same-origin /api prefix _(0ec291b)_
- **web** : read env files from repo root so VITE_API_URL reaches the client _(bd4a3cf)_
- **web** : point Vite dev proxy at the API instead of at itself _(6bb8d35)_
- **api** : seed:admin now generates a valid encryption envelope _(73ab851)_
- **api** : reorder tsx watch subcommand so the env-file flag is forwarded _(43eed16)_
- **settings** : persist language preference securely _(ca45adc)_
- force logout when key missing without looping _(eede447)_
- align login/logout key handling with e2e design _(a31eb3c)_
- restore main key bootstrap on login _(f13135d)_
- **atom** : rétablit export défaut Input.jsx (manquant) _(d32e41c)_
- **imports** : corrige EditDeleteActions dans Mood Entry _(d6083b5)_
- **imports** : corrige chemins dynamiques ImportExport registry _(229dae4)_
- **imports** : harmonise SettingsCard & EditDeleteActions chemins atoms/* _(3c2cb39)_
- **imports** : corrige chemin SettingsCard dans UserTable _(a198c7e)_
- **imports** : corrige chemin SideLinks dans Sidebar _(21f87fa)_
- **imports** : corrige chemin questions.json dans Mood Form _(c0a0bea)_
- **imports** : corrige chemins SubNavDesktop/SubNavMobile dans Subheader _(750c0eb)_
- **imports** : corrige chemin useAuth dans Account/index.jsx _(6938b08)_
- **imports** : corrige Layout.jsx (useAuth + modales specifics) _(fee9733)_
- **mood** : correct questions.json import path to i18n/locales/fr/mood _(7132eb7)_
- **layout** : correct Subheader parts imports and remove obsolete duplicates _(f976bd4)_
- normalize imports (ui atoms/molecules/organisms, modules API, import/export plugins) and add questions seed _(2b53931)_
- **import** : replace remaining services/ dataModules paths with core/api/modules _(15174f4)_

### Performance

- **web** : poser une baseline bundle-size + budget gardé en CI _(42fd109)_
- **web** : bundle analyzer + manualChunks + web-vitals dev hook + drop recharts (FRONT-03/08/09/10) _(be7ee9e)_

### Refactor

- **ui** : rebrancher les inputs inline sur DirkInput (closes #35) _(335e1f2)_
- **lib** : rename journal-markdown → lite-markdown (closes #5) _(36e045c)_
- **journal** : simplify thread manager — drop checkboxes + stats (refs #57) _(0c9528a)_
- **reader** : K · Sauge styling + actions out of the topbar _(0bd68b2)_
- **auth** : rename security_mode 'always_totp' → 'always_2fa' (refs #72) _(22ed574)_
- **docs** : dropdown Sécurité s'ouvre au survol (était click-only) _(68d441c)_
- **rename** : passage → journal — derniers callsites (e2e + tech.md) _(1fd75ed)_
- **rename** : **BREAKING** — passage → journal côté web _(7f1f0ff)_
- **rename** : **BREAKING** — passage → journal côté DB + back + shared _(0d786de)_
- **store** : adopter le slice pattern Zustand pour nodea-store _(d6277ec)_
- **composer** : décomposer Goal.tsx en sous-fichiers _(6eb5536)_
- **composer** : décomposer LibraryItem.tsx en sous-fichiers _(20e6fcf)_
- **routes** : splitter admin.ts en 5 sous-fichiers par sujet _(0bde9c3)_
- **api** : wrapper toutes les listes en { data, meta } (API-06) _(8f3a689)_
- **payloads** : décrypted snake_case → camelCase (API-01 part 2/2) _(a8e6f54)_
- **api** : wire-level snake_case → camelCase (API-01 part 1/2) _(892f96a)_
- **auth** : split /auth/me en /me + /me/crypto (API-14) _(d2c28ae)_
- **api** : /auth/passkey/* → /auth/passkeys/* (API-02) _(c794781)_
- **structure** : rangements Phase 3 — library-lookup → services/, ui/dirk/ en sous-dossiers, divers (Tier 4) _(4025c6c)_
- **auth** : harmoniser pages auth flat → folder + standardiser RHF (REFACTO-12 + REFACTO-06) _(41dc99f)_
- **modules** : splitter Library/Goals context.tsx en data/filters/actions hooks (REFACTO-08) _(2fd5daa)_
- **auth** : extract runCalibrationAssertion → calibration.ts (REFACTO-07 follow-up) _(ce1808d)_
- **library** : split LibraryItem.tsx — extract save + lookup (REFACTO-04) _(51bf6c4)_
- **auth** : splitter passkey-flow.ts (530 LOC) en passkey/{enroll,login,shared,index} (REFACTO-07) _(8c1c96e)_
- **modules** : hook useModuleClient centralise la garde « module hydraté » (REFACTO-02) _(68b480b)_
- **layout** : rename ImportExport to api/modules/import-export + finish import sweep (REFACTO-11) _(96cfe94)_
- **i18n** : promote formatPartialDate to core/i18n/date-format (REFACTO-05) _(616cebd)_
- **types** : centralize LoadState in core/types/load-state (REFACTO-01) _(1265d49)_
- **account** : move ModulesManager from Settings to Account/components (REFACTO-10) _(cf51114)_
- **ui/atoms** : purge 20 fichiers morts (REFACTO-09) _(5c6c3d3)_
- **import-export** : rewire plugins to current Zod schemas (Tier B.7) _(55157ac)_
- **shared** : promote MODULE_IDS to keystone (Tier B.5 health) _(a7aca2b)_
- **web** : migrate legacy JSX/JS islands to TS strict (Tier A.2) _(86a6192)_
- **ui** : reorder Security tab + fix sidebar footer pickers ratio _(48a28a3)_
- **flow** : close Tier 3 — dedup Sets + factory createModuleContexts _(eb94c90)_
- **web/review** : split steps.ts into types + fields + barrel _(dfdd1ea)_
- **web/api** : split client.ts into 9 domain modules + barrel _(6fb7f5b)_
- **web/auth** : split use-session.ts into 9 session modules _(7621ef9)_
- **api/lookup** : split dispatcher.ts into 4 modules + providers _(963ad01)_
- **api/schema** : split db/schema.ts into 6 domain modules + barrel re-export _(baa7db0)_
- **api/passkey** : split routes/auth-passkey.ts into 3 sub-routers + helpers _(667a6a5)_
- **api/auth** : split routes/auth.ts into 5 sub-routers _(dbec8d3)_
- **composer** : extract LibraryItem + finalise orchestrator (106 LOC) _(d45e9f8)_
- **composer** : extract bodies/LibraryReview _(20c00d0)_
- **composer** : extract bodies/Journal _(a40b3e4)_
- **composer** : extract bodies/Goal _(57cdbff)_
- **composer** : extract bodies/Simple + bodies/Mood _(a7ae408)_
- **composer** : extract lookup/ — LookupBar + 4 sub-components _(19c08e3)_
- **composer** : extract shared components — Toggle / Editor / Suggest / Footer _(0847c0d)_
- **composer** : extract lib/ — constants + guards + helpers + tests _(875849f)_
- **totp** : split 909 LOC page into 7 files + dedup BackupCodesPanel _(51def06)_
- **passkeys** : split 581 LOC page into 4 stage views + helpers _(2fead8a)_
- **auth** : split Reset + Register pages into orchestrator + sub-views _(0f9a264)_
- **auth** : split RecoveryCode + Recover, share RecoveryCodeDisplay _(5c0a28e)_
- **ui** : dedup PasswordRulesList + StrengthBar across auth pages _(615d81d)_
- **login-mfa** : split 461 LOC page into orchestrator + 3 surfaces + lib _(a2fe8ed)_
- **homepage** : derive MoodEntryLite via Pick<MoodEntry> _(aaed054)_
- **web** : centralise FR date formatters in core/i18n/date-fr.ts _(aa951b9)_
- **shared** : promote splitThreads + firstThread to @nodea/shared _(0c9c527)_
- **account** : split into lib + components + per-tab views — index.tsx 68 LOC _(101b85c)_
- **homepage** : single Data context + components/views split — index.tsx 77 LOC _(a5544f2)_
- **homepage** : extract pure helpers to lib/ + Vitest coverage _(d2e051a)_
- **mood** : extract components + views + finish split — index.tsx 71 LOC _(9197e19)_
- **mood** : extract pure helpers to lib/ + Vitest coverage _(c36a61f)_
- **journal** : extract views + finish split — index.tsx 83 LOC _(b250852)_
- **journal** : extract SideColumn to components/ _(d250e85)_
- **journal** : introduce 3 contexts + JournalProvider _(2ac76fb)_
- **journal** : extract pure helpers to lib/ + Vitest coverage _(b61180f)_
- **goals** : extract views + finish split — index.tsx 70 LOC _(8a6f41c)_
- **goals** : extract SideColumn + CarryOverDialog to components/ _(0cca6da)_
- **goals** : introduce 3 contexts + GoalsProvider _(18d2ccd)_
- **goals** : extract pure helpers to lib/ + Vitest coverage _(4b6176a)_
- **library** : extract all catalogue views to views/, finish split _(b845403)_
- **library** : extract ViewModeToggle, SideColumn, BookPickerModal _(c012ceb)_
- **library** : introduce 3 contexts + LibraryProvider _(44f9ad5)_
- **library** : extract CellFilter to lib/ + Vitest coverage _(d8ec82a)_
- **library** : extract pure helpers to lib/ + Vitest coverage _(fc45b07)_
- kill /flow/<id> links and ?xxx= query params _(937db4a)_
- **seed** : split seed:mood into per-module files orchestrated by seed:test _(86dcc28)_
- **review** : drop closing_final, surface drafts, sticky header pane _(747cfcc)_
- **mood** : pull entries-section header into the sticky pane _(56967b4)_
- **habits** : port shell to Direction K · Sauge + construction notice _(6ed3409)_
- **auth** : Phase 8 — drop stale 'cohabiting auth models' comments _(cf7e480)_
- **ui** : port Review module to Direction K · Sauge _(10c2dc9)_
- **ui** : Phase 8 — collapse SecuritySection + PreferenceRow into DescribedSection _(80f1086)_
- **ui** : Phase 7 — extract Tabs atom, drop 2 inline tab switchers _(193a2cd)_
- **ui** : Phase 6 — extract RowCard, drop 5 inline boxed-row containers _(a5ebdc9)_
- **ui** : Phase 5 — extract AuthPanelHeader, drop 22 inline triplets _(05a12d0)_
- **ui** : Phase 4 — AuthLayout + ModuleShell, drop the last shells _(6f29d84)_
- **ui** : Phase 3 — HoverActions, FilterChip, GroupBlock + unified red _(2794196)_
- **ui** : Phase 2 — extract auth Field atom, drop 10 local copies _(a39d837)_
- **ui** : Phase 1 — extract InlineAlert, SectionLabel, PageHeading, EmptyHint _(a5b9a07)_
- **ui** : factor Topbar into shared atom, drop 8 duplicates _(ba60869)_
- **auth** : MFA bypass confirm/cancel routes return JSON _(336bd4e)_
- **auth** : drop dead MFA bypass status + cancel routes _(851bfb2)_
- **auth** : bring the red Warning callout back on the destroy stage _(c5d73a8)_
- **auth** : /request-reset entry-fork — "j'ai un code" vs "j'ai pas" _(f0b16ce)_
- **auth** : /request-reset — text + buttons, drop the colored callouts _(b398a20)_
- **auth** : trim the /request-reset callout to title + escape CTA _(0f56f16)_
- **auth** : fuse warning + recovery prompt into one red callout below the submit button _(2bf3bad)_
- **auth** : swap warning + recovery-code box order on /request-reset _(006e0f8)_
- **auth** : turn the /request-reset recovery link into an outline button so it reads as a CTA, not as prose _(704555a)_
- **auth** : /request-reset polish — green border on recovery box, warning under the button, line break on the recovery prompt _(7e0175f)_
- **auth** : swap warning + recovery-code link order on /request-reset _(1f7ba7f)_
- **auth** : drop username uniqueness + port seed to OPAQUE _(fb90c3b)_
- **ui** : auto-seed first-run + factorize sidebar into pieces _(3a76b26)_
- **email** : shared layout for transactional emails _(aea6b50)_
- **web** : clean up OnboardingModal language + theme row _(3660c7f)_
- **web** : compact OnboardingModal layout (wide modal, dense modules table) _(80d2163)_
- **web** : port ui/atoms/** JSX → TSX (#23 / R14) _(3f27126)_
- **web** : purge legacy — PB, old crypto, old store (Step 6) _(aad487c)_
- modularize ui theme styles _(7b6bd6e)_
- **settings** : align language selector with SurfaceCard layout _(416876f)_
- **ui** : replace SettingsCard with SurfaceCard layout _(c456c6a)_
- **imports** : corrige imports obsolètes (features/, shared/ProtectedRoute) et routing flow _(6f4a293)_
- **layout** : move Subheader under headers/subheader and update all imports _(1599568)_
- **layout** : remove duplicate root Navigation/Sidebar/HeaderNav and use navigation/ versions _(67923ae)_
- **ui** : move Modal atom into base/ and update imports _(b17741b)_
- **ui** : split atoms into form/ and base/ subsets _(148dc40)_
- **ui** : move shared UI to src/ui and update imports (no logic changes) _(e06e6e3)_
- **frontend** : remove obsolete feature root files (Form/History/Graph + Root.jsx) in favor of views/ + index.jsx _(33972cb)_
- **frontend** : move feature pages into views/ and adjust imports (no logic changes) _(3c60c46)_
- **frontend** : use Root.jsx as feature entry and add views/ shims for pages (no logic changes) _(ad75ced)_
- **frontend** : update imports after component file renames in Goals and Mood (no logic changes) _(d6e8c0e)_
- **frontend** : rename src/modules to src/features and update imports referencing modules; no logic changes _(b0665b2)_

### Documentation

- **changelog** : regenerate for v2.0.0 _(03d9470)_
- **readme** : document the three Postgres databases + test guard rationale _(16fa040)_
- **i18n** : translate batch 7 — Architecture.md §7 + cross-ref anchors _(9d58dc8)_
- **i18n** : translate batch 6 — docs/adr/* (14 files) _(d1cbe92)_
- **i18n** : translate batch 5 — Auth-Spec.md (1479 lines) _(3953127)_
- **i18n** : translate batch 4 — docs/auth/* (7 files) _(7595c53)_
- **i18n** : translate batch 3 — docs/Modules/* (6 files) _(2d647d6)_
- **i18n** : translate batch 2 — Internationalisation.md _(45ee012)_
- **i18n** : translate batch 1 — README + Release-Checklist (pilot) _(8854eeb)_
- alléger Auth-Spec.md (de-dup tech.md + split §7 par flow) _(edaf70a)_
- fusionner Modules.md dans Architecture.md §7 + réécrire docs/README.md _(c057fbb)_
- déplacer Terms.md vers packages/web/src/app/pages/Terms/content.md _(d55dea2)_
- fusionner docs/brand/Logo.md dans nodea.app/docs/fork _(0dca392)_
- supprimer docs/recommendations/ — converti en GitHub issues _(1f5ca73)_
- fusionner docs/Security.md dans nodea.app/docs/security/tech _(b006878)_
- ajouter .github/SECURITY.md (politique de divulgation) _(9b0c587)_
- traduire CODE_OF_CONDUCT et CONTRIBUTING en anglais _(eb84f5a)_
- ajouter CODE_OF_CONDUCT.md à la racine _(8679df5)_
- créer CONTRIBUTING.md (guide contribution upstream) _(dc2923a)_
- renommer la section /docs/contribute en /docs/fork (« Reprendre le projet ») _(603901d)_
- supprimer Development.md + Operations.md (migrés sur nodea.app/docs) _(0c63090)_
- **e2e** : réduire le README au scope Playwright (le reste vit dans Development.md) _(934824f)_
- **dev** : créer Development.md, page d'entrée pour les contributeurs _(8aef6ca)_
- **e2e** : ajouter sections « Lancement rapide » et « Index des tests du repo » _(71b3bd7)_
- déduplication « surface lisible minimum » _(f42011d)_
- sweep historique sur le reste de la doc _(0965c50)_
- **e2e** : annoter SANITY-CHECKLIST.md avec les sections automatisées _(40e5dbe)_
- **auth-spec** : trim massif des sections archivées et historiques _(dea1294)_
- **security** : supprimer la section 2 LEGACY de Security.md _(207720a)_
- **modules** : renommer Passage en Journal et créer la fiche _(46cc442)_
- nettoyer les refs cassées vers docs/roadmap/ _(0ddba1d)_
- **e2e** : ajouter checklist sanity-check Mood + Goals manuelle _(27e0653)_
- **roadmap/api** : marquer API-11 moyen terme livré (OpenAPI complet) _(580634a)_
- **roadmap/api** : marquer API-06 livré (envelope { data, meta } sur les listes) _(ae434af)_
- **roadmap/api** : marquer API-01 livré (camelCase migration complète) _(28b33ee)_
- **api-04** : expliciter PUT vs PATCH dans les JSDocs de modules-config / user-preferences _(b8ea227)_
- **adr** : 6 ADR supplémentaires (Tier 4 §1) _(e0ad360)_
- **process** : ADR + CHANGELOG + Operations runbook (ARCH-02/10 + OPS-12/14) _(66d0322)_
- **security** : matrice de rétention RGPD §9 + brouillon CGU Terms.md (SEC-09) _(e8482fd)_
- **roadmap** : suivi audit Tier 2 — marquer REFACTO-04 / API-11 / ARCH-12 livrés + documenter exceptions useModuleClient _(b21e283)_
- **roadmap/ops** : marquer OPS-02 livré dans son heading (Tier 1 audit follow-up) _(728706c)_
- **roadmap** : tracer OPS-02 étape 2 (Sentry SDK) en issue #73 _(f61f7d3)_
- **roadmap/frontend** : purger les 3 mentions résiduelles de TanStack Query (ARCH-01 follow-up) _(e93b065)_
- **claude** : codifier la convention « commentaire-en-tête de fichier » (ARCH-13) _(c63b581)_
- retirer purement TanStack Query et Pino (ARCH-01) _(26832cc)_
- **roadmap** : ajuster Tier 0 (API-15 forme retour, FRONT-11 élargi, ARCH-01 simplifié, REFACTO-05 i18n-aware) _(2525746)_
- **roadmap** : master roadmap — cross-roadmap sequencing _(4dec264)_
- **roadmap** : cross-roadmap cleanup post-meta-audit _(3ed6842)_
- **roadmap** : ops audit + remediation plan _(a4aa1ea)_
- **roadmap** : retire i18n.md (livré) + nettoyer les refs orphelines _(2be6ae3)_
- **roadmap** : architecture audit + remediation plan _(ae12f2a)_
- reconcile docs/ references + retire stale legacy adapter blurb (Tier 11 health) _(d408a7e)_
- **roadmap/health** : mark Tier 10 (perf baseline) as livré _(1801685)_
- **roadmap** : frontend audit + remediation plan _(55ab567)_
- **roadmap/i18n** : mark Tier 6 (parity test + CLI + doc) as livré _(4587095)_
- **roadmap/i18n** : mark Tier 3 (dates/numbers) as livré _(919bdcf)_
- **roadmap** : API contracts audit + remediation plan _(1c389ae)_
- **roadmap/i18n** : mark Tier 2 as livré (commit 1c11e51) _(3f62e5b)_
- **roadmap/health** : mark Tier B.6 (createModuleContexts) as livré _(46427c0)_
- **roadmap/health** : mark Tier B.7 (ImportExport rewire) as livré _(ab5fe6a)_
- **roadmap** : security audit + remediation plan _(e17fd5c)_
- **roadmap/health** : mark Tier B.4 auth pages migration done _(80ce269)_
- **roadmap** : refacto roadmap (factorisation + organisation) _(b9b250c)_
- **roadmap/health** : mark Tier A.1 (ESLint + pre-commit) as livré _(a5de2f0)_
- **roadmap/i18n** : re-audit + corrections post factoring-audit _(6197feb)_
- **roadmap** : add health roadmap — clean / refacto / arch _(1f5b7d0)_
- **roadmap** : mark Tier 2 (ComposerModal) as livré _(963bf7c)_
- **roadmap** : mark Tier 4 (auth pages) as livré _(b4832d0)_
- **public** : expand newbie + advanced tiers, add 2 pedagogical diagrams _(5548ff5)_
- **roadmap** : post-module-refacto factoring audit _(60bcb2f)_
- **roadmap** : add module-refacto roadmap (Goals → Journal → Mood) _(cf11d09)_
- be honest about the API endpoint metadata leak _(e41a2f3)_
- update routing invariant — /flow stays frozen + Library status _(26bba52)_
- **/docs** : expand inventory tables to 4 columns (Champ + Description + Pourquoi) _(7a5dab1)_
- **/docs** : focus the inventory tables on plaintext-only _(1135c06)_
- **/docs** : rename "Préférences chiffrées" sub-header _(e98a0c6)_
- **/docs** : convert plaintext-fields inventory to 2-col tables _(b560ebd)_
- **readme** : refresh root README — fix stale facts + tighter structure _(a1b6b44)_
- **/docs** : mirror access matrix into newbie + advanced tiers _(3cc38c4)_
- **/docs** : exhaustive plaintext-fields inventory + access matrix _(22d7aa4)_
- propagate minimum-readable-surface design to all surfaces _(0b98014)_
- **/docs** : expand "Sous le capot" tier into a full security whitepaper _(4100673)_
- drop security-audit.md and deps-audit.md _(129d0fc)_
- finish documentation/ → docs/ rename (no content changes) _(3b54550)_
- rename documentation/ to docs/, freshness pass on the kept files _(b2a4e5e)_
- drop completed roadmaps and pre-migration audit _(e384860)_
- **security** : catalogue all 22 auth rate-limiters in §5.1 _(85bde58)_
- **security-audit** : record post-Phase 8 self-audit findings _(d516f1c)_
- **auth** : Phase 8 sweep — flip stale 🚧 markers to ✅ _(1a1489b)_
- **auth** : Phase 8 livrée — chantier auth complet _(d051e5c)_
- add Release-Checklist.md so the INTEGRITY.txt step doesn't slip _(a8272b8)_
- **readme** : point to Security.md §7 for the web supply-chain limit _(a4b9856)_
- **auth** : Phase 7C closed — sidebar tips replace the wizard design _(16a44d6)_
- **auth** : Phase 7B landed — matrix wired to all mutating routes _(9143578)_
- **auth** : Phase 7A landed — flag re-auth foundation as shipped _(f94dccc)_
- **auth** : MFA bypass — 7-day delay + drop email cancel link _(87ec3ea)_
- **auth** : MFA bypass JSON contract + SPA pages + TOTP/backup split _(abad3a9)_
- **auth** : reflect MFA bypass auto-cancel + dropped status routes _(0b24d3a)_
- **auth** : Phase 6D — mark MFA bypass shipped _(8e2daa5)_
- **auth** : align change-password §7.5 + Architecture with the 2-step OPAQUE flow + UX requirements _(3de74c6)_
- **db, architecture** : align with Phase 1 v2 + Phase 2+ scaffolding _(aa59c2d)_
- **auth** : align Auth-Spec + Auth-Roadmap with V1 reality _(c6e41ce)_
- refresh Architecture / Database / Security + close roadmaps (#24 / R15) _(43aa6a3)_
- **roadmap** : link R8-R15 to GitHub issues, mark R1-R7 livrées _(fa650fd)_
- add Feature-Parity-Roadmap for post-migration restoration _(46cccfa)_
- **migration** : mark Phase 0 + Phase 1 as done _(eb6180b)_
- **migration** : add MIGRATION.md (Phase 0) _(0b7f799)_
- add CLAUDE.md with project rules and conventions _(dc78fe5)_
- **roadmap** : adjust after code verification _(e37f0eb)_
- add migration roadmap from PocketBase to self-hosted stack _(bd1cfa7)_
- add global code audit report _(7cda7da)_
- **security** : add full security audit report _(b0fd3e8)_
- annotate core services _(b00d7a2)_
- update security architecture and module specs _(272fab9)_
- **architecture** : mise à jour Architecture.md pour refléter l’état réel (gel structurel) _(a5494e0)_

### Autres

- revert(journal): heatmap reste en carrés; chore(home): drop ⌘K search button _(a289c93)_
- i18n(web): moulinette sweep sur surfaces auth + admin + composer-shared _(a82e01a)_
- security: 5 hardenings post-audit (logout reload, no-store, CORS prod, change-email rate-limit, recovery code invalidé) _(463b987)_
- security(privacy): privacy fine — SameSite=Strict, log scrubbed, logo inlined (SEC-06/07/08) _(76f9561)_
- security(hardening): cookies + USER non-root + IP rate-limit + Postgres ports (Tier 1 étape D) _(2548a6a)_
- security(logs): déplacer sid+guard du query string vers les headers X-Sid/X-Guard (SEC-01 + OPS-09) _(fdca1ce)_
- a11y(app): skip-link « passer au contenu principal » (FRONT-14) _(aa4157f)_
- a11y(library): fix alt text on book covers (FRONT-01) _(3f08f07)_
- ops(postgres): bind mount under $HOME/data/nodea/postgres (no more named volume) _(34cb5c0)_
- security: post baseline audit + fix 2 critical findings (Tier 8 health) _(e732723)_
- chrome(docs): polish — h3 nesting in TOC, local tab state, "· Documentation" topbar label _(9908f9e)_
- chrome(docs): align article eyebrow with TOC header on lg+ _(a47eca2)_
- chrome(login): two docs entries — body CTA + short footer link _(bbf302c)_
- chrome(login): try docs link in the marketing panel footer _(be86ae0)_
- chrome(login): move docs link to the marketing panel _(4ee79c5)_
- chrome(docs): align topbar tabs with the article column on lg+ _(3096cea)_
- copy(docs): rename tabs to L'essentiel / La mécanique / Sous le capot _(d0bbe30)_
- chrome(docs): swap order — primary CTA before "Code source" _(3ca8abf)_
- chrome(docs): underline tabs + justified body text _(d5ee4d8)_
- chrome(docs): drop the page subtitle _(46dcfeb)_
- chrome(docs): drop body text from 15.5px to 14.5px (one notch down) _(ab8c7dc)_
- chrome(docs): add hairline border to "Code source" button _(b426124)_
- chrome(docs): make Code source a ghost-style button, rename CTA to "Accéder à Nodea" _(41db3a9)_
- chrome(docs): drop footer, promote "Code source" link into the topbar _(e4131ba)_
- polish(journal): justified prose, blank-line gaps, clamped previews, reader header _(01a6aa2)_
- copy(auth): Un espace à soi + chiffré dans ton navigateur _(820cdcb)_
- refactor ui atoms to tailwind variants _(8db7ca1)_
- Codex Agent _(3db08eb)_
- project _(ed31986)_
- ui: normalize design tokens and shared atoms _(65cc67d)_
- ui: unify input styling across account/admin/mood _(efebac8)_
- ui: icon-only admin actions _(f1cebf5)_
- correction _(6afc9a9)_
- Refactor crypto main-key + migration AES/HMAC non extractible, modules Goal/Passage, import/export, ESLint fixes _(09a5505)_
- Utilisation composants pour Announce / Admin _(627c9c1)_
- Liste hashtag ok dans Goals Form _(48622b6)_
- Correction sur History de Goals dans Edition des entries _(feb761a)_
- Changement sur bouton EdtiDelete dans les history _(91c6e75)_
- Supprime la double instanciation de StoreProvider _(83bc197)_
- Sécurise la déconnexion (clé manquante + header) _(4370872)_
- Corrige l’inscription et fiabilise le changement de mot de passe _(a924dc4)_
- Corrige la génération de encrypted_key lors de l’inscription (clé maître en base64 + sérialisation {iv,data} sans double encodage). _(6ee91ae)_
- Corrections routes + text-justifiy sur history modules _(4ab7d58)_
- Correction import fichier (suite) _(01e713d)_
- Correction improt fichier (suite) _(febc70e)_
- Correction import fichier _(ffa983b)_
- Merge commit '30c8a3ee3ea4a2a78641e895ab5e18b714368a50' _(1bf480b)_
- Fin de réorga _(30c8a3e)_
- Réorganisation dossiers en cours _(9cd0614)_
- Repair de module id changeant _(07af834)_
- Commenatires _(4b0ff4c)_
- Nettoyage servcies crypto _(bc67119)_
- ## Dérivation du guard — centraliser partout _(37fcaf7)_
- é naturelle et normalisation _(4fd2e80)_
- Import/Export — harmoniser via les plugins _(ac7e012)_
- I/E passage ok _(d9609f7)_
- Goals ok _(1ed2998)_
- card goals ok _(67b50c5)_
- Goals ok sans import/export _(43a72bc)_
- Sucis avec goals sur thread _(3626d6c)_
- Edition des history en cours _(0782b8c)_
- Retrait des consoles log _(0dcb9e9)_
- CRUD Goals ok _(19ffb2b)_
- Changement nom pb hooks _(f357c28)_
- Goals CRUD en cours _(c4b299f)_
- Goals form ok _(4770c48)_
- Passage et Mood CRUD ok _(5490540)_
- Reffacto CRUD en cours _(c3af67a)_
- DatePicker _(725fea2)_
- Ajustement formulaire _(53581e7)_
- Refacto login et registrer _(d75ea91)_
- Form passage corrigé _(a64aac4)_
- Soucis sur inputsuggest _(bed279e)_
- Goals form ok, reste history, _(146f0f9)_
- Goals frontend mvp _(5ae2161)_
- I/E passage ok _(46fd12a)_
- Goals ok _(d9ed98b)_
- card goals ok _(35b694a)_
- Goals ok sans import/export _(a7272c8)_
- Sucis avec goals sur thread _(7df9881)_
- Edition des history en cours _(cb5145a)_
- Retrait des consoles log _(0186c2f)_
- CRUD Goals ok _(dc09955)_
- Changement nom pb hooks _(4350f1b)_
- Ph kooks refacto _(4b9b643)_
- Goals entries pour pocket base _(0f031b3)_
- Goals CRUD en cours _(3f8d688)_
- Goals form ok _(831a1ef)_
- Passage et Mood CRUD ok _(e6198ad)_
- Reffacto CRUD en cours _(ef6d81b)_
- DatePicker _(8586cf2)_
- Ajustement formulaire _(456953b)_
- Refacto login et registrer _(51cbfe5)_
- Form passage corrigé _(e837d67)_
- Soucis sur inputsuggest _(d5e2218)_
- Goals form ok, reste history, _(7188228)_
- Goals frontend mvp _(c93b8f1)_
- IE passage OK _(104ee3e)_
- Mini correction place fichiers _(a6ee635)_
- Réorga fichier import _(d05363e)_
- Subheader place correction _(bb911ca)_
- Réorga des dossiers interne _(6b09c04)_
- Passage documentation _(bdda8d5)_
- Passage resize zone edition ok _(e60b4b3)_
- Corrections UX sur zone e textes _(faddb25)_
- Passage ok correction _(0c8d491)_
- Passage mvp ok _(a8da581)_
- Passage form ok _(2c39522)_
- Sticky header _(b80e000)_
- Header stocky top corrected _(dbada9a)_
- Passage mvp 3 (avec history) _(de6205c)_
- Passage mvp 2 _(81b99b4)_
- Module passage mvp _(a83e196)_
- Changement des toogles pour choix des modules _(cda666b)_
- Mini correctios UI _(17a4866)_
- OnBoarding modal ok _(65648a8)_
- Modulation variable api .env _(60eb14f)_
- Script install ok _(1faf253)_
- Script install _(ece995b)_
- script install _(a57affc)_
- script _(d0dd367)_
- script install _(883fd06)_
- script install _(086ad6e)_
- Script install _(99bfbf8)_
- script install _(5da7141)_
- script user _(db18a4e)_
- script install _(23888d5)_
- scrip update _(7289659)_
- pocketbase version pudate _(94e8b83)_
- Correction script install _(301b851)_
- Script correction _(f951d29)_
- Script ok _(9041d53)_
- Script config refacto ok _(5664478)_
- Script install _(21a0029)_
- script correction _(1261b2e)_
- Script install corrrection _(a051d10)_
- script correctionb _(6c563de)_
- Correction script install _(b9aef0c)_
- Correction instal et description modules _(5288bfe)_
- Correction descript des modules _(04c2326)_
- Ajustement prépa V2 _(c9e9234)_
- Régorga component ok _(c3a76e6)_
- Reorga dossier en cours _(6ee3340)_
- invite user - delete code et refacto design _(be3d373)_
- modal onboardgin corrigée _(833080f)_
- refacto du delet en cours _(4162314)_
- Erreur delete user en cours _(b897dbb)_
- Module onboarding ok _(47ecc7b)_
- admin ok _(795a4bf)_
- Admin presque _(22fb735)_
- Page admin en cours _(0bc0e41)_
- Réogra rapide des dossiers _(298ad11)_
- Export correction _(f979593)_
- Redeisng account _(4073245)_
- Modal logout ok _(f324bc5)_
- Ajout modale déconnection si clé absente _(8ed2d53)_
- package.json update _(1776670)_
- Script install modif prod vs dev _(a332a6a)_
- Nettoyage folder next _(642084d)_
- Correction package.json et vidage fichiers inutiles _(e982b02)_
- Script ok _(8d886eb)_
- script d'install en cours _(9b84352)_
- Correction bis _(4192c96)_
- Correction _(54ed964)_
- Restructuration dossiers en corus avec script instalation _(aec1933)_
- Script instalartion _(631d579)_
- Readme again _(228e4e6)_
- Readme update _(0c6c353)_
- docs update _(6e29247)_
- Docs update _(e730765)_
- Réorga code & folders _(6ee21aa)_
- Réorga code pour futur back_api _(5c243a3)_
- Changement du tri dans history pour avoir tri par date _(237ed1e)_
- Import ok, avec ok sur gros fichiers _(ed50795)_
- Import ok _(d1e475e)_
- Import et export ok, bug de doublon non filtrés _(5dab4e0)_
- Mini correctiosn d'import _(d1531b9)_
- Refacto Import / export en cours _(cac990e)_
- Import ok _(7992b51)_
- Graph ok _(1a5cbee)_
- History correction _(fcbc173)_
- History ok _(a9ef4ea)_
- From ok, enregistrement ok (avec hooks PB côté serveur) _(60396f9)_
- form ok _(563be7e)_
- refacto form _(869b3ba)_
- retrait des console log inutile _(463fbab)_
- Systeme de choix des modules ok _(0d59742)_
- en cours _(d94268b)_
- Début de correction _(a24382d)_
- Légere correctopns _(d9ee574)_
- account settings _(b0ee841)_
- Graphique mobile et taille en desktop corrigé _(2b66934)_
- Menu subheader ok _(11cf7c4)_
- subheader menu en cours _(e61d59a)_
- Icon header ok _(b476419)_
- Suite _(384baa4)_
- Arrangement marge et subheader _(b1785a7)_
- Update README.md _(1bb72c6)_
- icone header ok _(898702b)_
- LOgo dans header ok _(4dbdcac)_
- Supression sidebar ok _(c584bba)_
- Menu setting retravaillé + message erreur de clé _(72095e9)_
- Correction sub-header design _(9edd854)_
- Module's sub-header _(0342e8d)_
- Mise en place d'un store Reste à le propager partout _(e1bfe84)_
- Header ok Generation avatar et récupération nom _(fbe47a9)_
- Sidebar ok _(adbf00d)_
- v. 1.2.1 Ajout d'un .env exemple et changement de l'info du back dans readme _(5a416f1)_
- V.1.2.1 Light new folder organization (to group page & components together) _(7d2b1d4)_
- v. 1.2.0 Logo changed, tailwind and graphic theme, common elements factoring, new folder organization _(85a7769)_
- Create LICENSE _(332bd16)_
- Revert "close #2" _(80640d8)_
- close #2 _(71f9f4f)_
- v1.1.2 Correction mineurs _(caf6ace)_
- v1.1.1 Nettoyage des console.log et maj du readme _(85409e4)_
- v.1.1.0 Nouveau système de chiffrement et dérivation Argon2 & webcrypto _(d085514)_
- V.1.0.0 Ajout d'une fonction d'import et d'un readme _(d353456)_
- MVP 5.1 Toujours test webhook _(433f7fc)_
- MVP 5.1 Aucune modif (test webhook) _(310ab57)_
- MVP 5.1 Prod correction + .env _(0d26fcd)_
- MVP 5.1 Correction prod _(754d4dc)_
- MVP 5.2 Correction prod _(ec8c9b7)_
- MVP 5.1 Dechiffrement export, et retrait bouton export de la page admin _(71e13ea)_
- MVP 5 Chiffrement des données _(e567106)_
- MVP 4.1 Changement interface mineurs _(c77e72d)_
- MVP Correction front, icon, favison, et correction affichage mobile _(1ad4968)_
- MVP v4 Export des datas _(27c918f)_
- MVP v3 Découpage des pages en composants séparés _(97bd7ad)_
- MVP v2 _(46ae999)_
- MVP 1 _(3629faf)_

<details>
<summary>Maintenance — 87 commits</summary>

- **trivy** : allowlist picomatch CVE inside pnpm's corepack tarball _(b94e3db)_
- **api/docker** : strip bundled npm from the image (we run on pnpm) _(6e91857)_
- **docker** : pin picomatch ≥ 4.0.4 + .trivyignore for vendored Go CVEs _(1aaaa64)_
- **docker** : bump trivy-action 0.28.0 → v0.36.0 (the 0.28.0 ref doesn't resolve) _(9cd09a3)_
- **release** : bump version to 2.0.0 _(423e094)_
- **e2e** : rename `test` script to `e2e` so `pnpm -r test` skips Playwright _(e5cecb7)_
- generate OPAQUE_SERVER_SETUP per run so /auth tests can talk OPAQUE _(1efc256)_
- create + migrate `nodea_test` DB before tests (issue #41) _(fadc709)_
- add WebAuthn + WEB_BASE_URL env vars so config validation passes _(6dfd271)_
- **deps** : bump deps + patch CVEs (basic-ftp, hono, ip-address) ahead of v2.0.0 _(f2d46bd)_
- **docker** : build + push semver-tagged images on `v*.*.*` tag pushes _(45e1a5b)_
- **ui** : unify radius via tokens on atoms (closes #26 residuals) _(83c73b3)_
- **ui** : hide the Habits module from the UI until it's product-ready (#98) _(461aa5c)_
- **web** : add og-card.png for social preview (closes #68) _(4d89ee4)_
- **auth** : assert already-exists notice on inactive-email re-register (#45 follow-up) _(a0e2544)_
- **auth** : cover change-password via fresh passkey re-auth (closes #49) _(3e1267b)_
- run workspace tests sequentially (--workspace-concurrency=1) _(33eaefe)_
- **e2e** : skip test 10 (bypass row missing) + harden test 11 assertion _(c58103d)_
- supprimer CHANGELOG.md (pas pertinent en pré-v1) _(6a3fb7c)_
- déplacer infra/scripts/deploy.sh vers scripts/deploy.sh _(eed7029)_
- déplacer CONTRIBUTING.md et CODE_OF_CONDUCT.md dans .github/ _(c4e51d6)_
- **claude** : nettoyer CLAUDE.md des refs obsolètes _(b5b3a57)_
- **e2e** : automatiser sections 5/6/8 de la checklist sanity manuelle _(57ecbea)_
- **e2e** : ajouter spec MFA bypass TOTP (récupération via email) _(1f18a85)_
- **e2e** : ajouter spec Account changes (username + email via UI) _(1b99fd5)_
- **docs** : supprimer le dossier roadmap _(62065b4)_
- **e2e** : ajouter spec Goals CRUD (jumelle de la spec Mood) _(3e65a66)_
- **docs** : supprimer le schéma PocketBase legacy _(8682bb6)_
- **auth-recovery** : aligner le test happy-path sur le design « consume not rotate » _(3572058)_
- **deps** : bump vite 7.0.4 → 7.3.2 + react-router-dom 7.7.1 → 7.13.1 + pin _(d99c760)_
- **crypto** : defake bip39 « bad checksum » via boucle de retry _(aa3f840)_
- **e2e** : 5 specs Playwright supplémentaires (OPS-06) _(1caf2c4)_
- **security** : Dependabot + pnpm audit en CI + Trivy sur images Docker (OPS-07/08) _(e6eb908)_
- **roadmap** : retire health.md — 11/11 livré, applies the convention _(2bf17d5)_
- **auth** : full lifecycle integration test + crypto coverage gate _(bd05a7a)_
- **catches** : document silent catch rationales (Tier B.4 audit) _(d1d6715)_
- **coverage** : add vitest coverage setup + baseline (Tier A.3 health) _(be65ed8)_
- **lint** : apply auto-fix sweep across api + web + e2e _(b4bea9d)_
- **lint** : add husky pre-commit running lint-staged _(935e55d)_
- **roadmap** : swap module-refacto for i18n audit _(4e45616)_
- **roadmap** : remove factoring-audit.md — fully delivered _(6e86135)_
- **sidebar** : drop the passkey suggestion tip _(4dd9e64)_
- **library** : drop page_count and current_page from data model _(ecdfe81)_
- ignore .claude/ harness state _(0fcb1d9)_
- drop legacy Design/design_handoff_nodea folder _(f2e0fc5)_
- **modules** : drop legacy fallbacks for in-payload timestamps _(f57a3ae)_
- **auth** : Phase 7B — convert forgery tests to stale-timestamp tests _(c283db6)_
- **auth** : Phase 7A — integration coverage for re-auth foundation _(cf3e7b2)_
- **ui** : sticky filters + module header cleanup _(be53569)_
- **auth** : drop coverage for removed bypass routes + schemas _(d151460)_
- **ui** : adopt Button atom across modules, modals, and sidebar _(0943c9f)_
- **ui** : adopt Button atom across auth pages + admin _(808ddda)_
- **theme** : split accent-hover from accent-deep _(074c9bc)_
- **auth** : red submit button on /request-reset destroy stage _(56a6749)_
- **auth** : red border on the "j'ai pas de code" fork button _(8ae5308)_
- **ci** : tighten workflow defaults (permissions + persist-credentials) _(ec8a305)_
- **ui** : polish open-source link + sidebar tip _(6e09b2e)_
- **auth** : post-2D audit — drop stale legacy refs in code + docs _(9b2268f)_
- **auth** : Phase 1D-A — Vitest integration suite for multi-step register _(7d197ec)_
- **library** : better Amazon diagnostics on parse failure _(fe2cd30)_
- **api** : add `seed:all` to chain admin + mood seeds _(a4c2548)_
- **deps** : patch 3 Dependabot advisories (drizzle-orm, vite, esbuild) _(9c79854)_
- **dev** : finish env consolidation cleanup _(a4cbab4)_
- switch to AGPL-3.0-or-later + archive migration docs _(21740ad)_
- **web** : dark-mode bg on Modal + tighten onboarding section layout _(092493f)_
- **web** : widen OnboardingModal to 2.5× (max-w-640) _(ebe6833)_
- **dev** : collapse all .env files into one canonical root file _(2d30ded)_
- **dev** : add Dev Setup / Infisical config for local secrets _(62104e3)_
- **web** : restyle auth pages with cards + shared atoms _(9b65059)_
- let packageManager drive pnpm version _(49b6ce9)_
- add GitHub Actions workflow (Phase 9) _(c843cd8)_
- **web** : close 5 legacy findings (zombie deps, i18n, _prevEntry) _(96b47cb)_
- **workspace** : bootstrap pnpm monorepo (Phase 1) _(d7d7cf3)_
- remove unused theme css _(6a1246a)_
- **settings** : remove language change feedback _(51181dc)_
- **settings** : streamline language selector layout _(d17d849)_
- **onboarding** : widen modal and align settings sections _(659f9b1)_
- **settings** : align section titles with admin layout _(4e2d14a)_
- init i18n infrastructure and migrate auth/layout _(3ab77ae)_
- remove autogenerated // src/... header comments across frontend _(592261a)_
- **ui** : finalize atoms cleanup and manual edits (button, card, inputs) _(9a9b760)_
- **ui** : remove deprecated root atom component files (now only in base/ and form/) _(8f4cf74)_
- **ui** : deprecate root atom duplicates with re-export stubs to base/ & form/ structure _(548ef79)_
- **build** : add additional path aliases (app, ui, core) after reorganization _(bb2ff4f)_
- **architecture** : scaffold src/app and src/core per Architecture.md (re-export shims only, no logic changes) _(2699595)_
- clean up empty/obsolete folders after UI migration _(80be92f)_
- **frontend** : convert legacy feature page files to re-exports pointing to views/ and set index.jsx -> Root _(c4f4bb3)_

</details>
