# Internationalisation

The client uses an in-house React provider
([`packages/web/src/i18n/I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx))
that loads every translation resource from static JSON files. The active
language is persisted in `localStorage` (`nodea:language`) **and** in
the encrypted `user_preferences` blob (cross-device sync once the user
is logged in). It can be changed from the **Settings → Application
language** page.

Languages currently supported: **French** (`fr`, default), **English**
(`en`).

## Resource layout

```
packages/web/src/i18n/
├── I18nProvider.jsx        ← React provider + t / tn helpers
├── translate.ts            ← pure logic (resolution, plurals)
├── translate.test.ts
├── parity.ts               ← compareNamespaces (factored)
├── parity.test.ts          ← CI test: FR ↔ EN keys match
└── locales/
    ├── fr/
    │   ├── account.json
    │   ├── admin.json
    │   ├── auth.json
    │   ├── common.json
    │   ├── errors.json
    │   ├── goals.json
    │   ├── home.json
    │   ├── layout.json
    │   ├── modals.json
    │   ├── modules.json
    │   ├── mood.json
    │   ├── journal.json
    │   ├── review.json
    │   └── settings.json
    └── en/
        └── ... (same files, same keys — verified in CI)
```

Each JSON file is one namespace. Keys are stable; values change per
language.

## Provider API

```ts
const { t, tn, language, setLanguage, availableLanguages } = useI18n();

t('account.tabs.identity');                        // → 'Identity'
t('errors.api.invalid_credentials');               // → 'Wrong email or password.'
t('goals.carryOver.summary.one', { values: { count: 1, fromYear: 2025, toYear: 2026 } });

// Plural-aware — picks .one / .other / .few / .many / .other via
// Intl.PluralRules(language). `count` is auto-injected into values.
tn('mood.topbar.label', total);                    // "Mood · 3 entries"
tn('account.security.passkey.count', passkeysCount); // FR/EN one/other
```

### Key conventions

- **Plurals**: subkeys `<key>.{one,other}` (and `few/many/zero` if a
  third language requires them). Always via `tn(...)`, never a ternary
  `count === 1 ? t('xxxOne') : t('xxxOther')`.
- **Interpolation**: `{token}` in the value, `values: { token: ... }`
  at the call site. Missing tokens → replaced with the empty string
  (only when `values` is passed).
- **API error codes**: a single `errors.api.<code>` namespace; the
  `apiErrorMessage(err, t)` helper (from `@/core/api/client`) handles
  routing with `errors.api.unknown` / `errors.api.network` fallbacks.
  Auth pages no longer switch on `err.error` locally.

## Locale-aware helpers

### Dates

[`packages/web/src/core/i18n/date-format.ts`](../packages/web/src/core/i18n/date-format.ts)
exposes the shared formatters. Every function takes the active
language:

```ts
formatEntryLabel(iso, today, { language, todayLabel, yesterdayLabel });
formatMonthLabel('2026-03', language);    // FR: "Mars 2026", EN: "March 2026"
formatLongDate(iso, language);            // FR: "8 janvier 2025", EN: "January 8, 2025"
formatNumber(12345, language);            // FR: "12 345", EN: "12,345"
intlLocale('fr');                         // → 'fr-FR' (BCP-47 mapping)
getMonthNames('fr', 'short');             // → ['janv.', 'févr.', ...]
getDayNames('fr', 'long');                // → ['lundi', 'mardi', ...] (Mon → Sun)
```

The "Today" / "Yesterday" labels come from
`common.time.{today,yesterday}`; call sites pass them to
`formatEntryLabel`.

### Editorial content outside namespaces

Two prompt arrays (~100 entries per language each) live outside `t()`,
under `data/` next to the module that consumes them:

- [`packages/web/src/app/flow/Mood/data/questions-{fr,en}.json`](../packages/web/src/app/flow/Mood/data/) +
  `questions.ts` (`pickQuestion(language)`).
- [`packages/web/src/app/flow/Journal/data/prompts-{fr,en}.json`](../packages/web/src/app/flow/Journal/data/) +
  `prompts.ts` (`pickJournalPrompt(language)`).

**Why**: `t()` returns a `string`, not an array; the
`pickXxx(language)` helpers do the random pick and the FR fallback
when a language doesn't have its own list. Adopt the same rule for
any editorial dataset > ~50 entries.

### FR-only subtree (by design)

The pedagogical diagrams under
[`packages/web/src/app/pages/docs/`](../packages/web/src/app/pages/docs/)
stay **FR-only** until a real EN audience justifies the work. Same
goes for the YearCompass content in Review (`config/steps.ts` +
`config/step-fields.ts`) — ~174 lines of editorial copy adapted
from a French pedagogical booklet. Buttons, nav, and errors of the
Review module are in `review.json` and go through `t()`.

## CI: FR ↔ EN parity

Two tools keep the locales aligned:

1. **Vitest test** (`parity.test.ts`) — iterates over the 14
   namespaces and `expect(... onlyFr / onlyEn)` to be `[]`. Runs
   automatically in CI via `pnpm test`.
2. **CLI script**: `pnpm --filter @nodea/web i18n:diff` prints a
   namespace-by-namespace summary (`✓` /
   `✗ FR-only: ... / EN-only: ...`). Useful in local review or
   before pushing. Exit code 1 when a drift is detected.

Both compare **leaf keys** (full dotted paths at final resolution,
not just top-level): one side that has `x.count.one / .other` and
the other only `x.count` is caught.

## Adding a new language

1. **Create the resource files**
   - Duplicate `packages/web/src/i18n/locales/fr/` to
     `packages/web/src/i18n/locales/<ISO code>/`.
   - Fill in each JSON file with the translations; keep the same
     keys. Run `pnpm i18n:diff` to check parity as you go.

2. **Register the language in the provider**
   - In [`I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx),
     import each JSON of the new language and add it to the
     `RESOURCES` and `SUPPORTED_LANGUAGES` constants (ISO code +
     human label).

3. **Extend the BCP-47 mapping**
   - If the ISO code doesn't trivially map to an Intl locale
     (e.g. `pt` → `pt-PT` or `pt-BR`?), extend
     `intlLocale(language)` in `core/i18n/date-format.ts`.

4. **Verify the plurals**
   - For languages with rich plural forms (Russian, Polish, Arabic…),
     verify that the `zero / one / two / few / many / other`
     subkeys are filled in on every `tn(...)` that needs them (the
     parity test does NOT flag a missing `.few` in RU if FR doesn't
     have one — that's a residual gap).

5. **Editorial datasets**
   - Add `questions-<lang>.json` to `flow/Mood/data/` and
     `prompts-<lang>.json` to `flow/Journal/data/`. The selectors
     fall back to FR if the language has no list, so a new language
     works on day 1 without re-translating the prompts.

6. **Test the switch**
   - `pnpm dev`, **Settings → Language**, pick the new language.
     Verify no `defaultValue` fallback shows up, and that
     `pnpm test` stays green.

## Emails (API side)

The 7 transactional email templates (`invite`, `password-reset`,
`register-activate`, `mfa-bypass` request + applied, `recovery-applied`,
`security-mode-downgraded`) are bilingual via a mechanism distinct from
the web provider — no React in Node, just a pure function.

```ts
import { emailT, extractEmailLanguage } from '@/services/email/i18n';

emailT('fr', 'invite.subject');                          // → 'Tu es invité·e à créer ton espace Nodea'
emailT('en', 'invite.validity', { values: { ttl: 7 } }); // → 'The link is valid for 7 days.'

extractEmailLanguage(c);                                 // 'fr' | 'en' (parses `Accept-Language`)
```

- **Sources**:
  [`packages/api/src/services/email/locales/{fr,en}.ts`](../packages/api/src/services/email/locales/) —
  deep trees (subject / preheader / heading / text / HTML per
  template). The `EmailLocaleShape` shape is exported from `fr.ts`;
  a missing EN key is a TS error at build.
- **Language detection**: no `users.email_language` column in
  cleartext (deliberately removed to keep the encryption boundary
  clean). We read `Accept-Language` from the request that triggers
  the email — that matches the user's browser for self-service flows
  (register, reset, MFA bypass) and the admin's for invites. Emails
  with no context (future cron jobs) fall back to `DEFAULT_LANGUAGE`
  (FR).
- **FR ↔ EN parity**:
  [`packages/api/src/services/email/parity.test.ts`](../packages/api/src/services/email/parity.test.ts) —
  same invariant as the web side, leaf paths compared.
- **Shared layout**: the footer ("— L'équipe Nodea" / "— The Nodea
  team" + the "sent automatically" line) and the `<html lang>`
  attribute come from `emailT('layout.*')`. No template needs to
  re-translate these blocks.

To add a third language on the email side: create `locales/<code>.ts`
mirroring `fr.ts`, extend `SupportedEmailLanguage` in
[`packages/api/src/services/email/i18n.ts`](../packages/api/src/services/email/i18n.ts),
add the bag to `RESOURCES`, and adjust `parseAcceptLanguage` to
recognise the primary tag.

## Notes

- Locales are loaded **statically**: any new resource must be
  imported by hand in `I18nProvider`. Deliberate — the bundle stays
  predictable and `tsc` validates missing imports at build.
- The language is persisted in **two** stores: `localStorage`
  (before login) and the encrypted `user_preferences` (after login).
  The server never reads the blob; cross-device sync goes through a
  re-login.
- Keep JSON files in **UTF-8 without BOM**, with accents preserved
  (FR files contain `é`, `à`, `ç`, etc. directly, no Unicode
  escapes).
- **Inclusive French**: `utilisateur·ice·s` for people, never for
  objects (« un critère actif », not « actif·ve »).
