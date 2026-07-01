# Cycle module (`cycle_entries`)

> Status: **spec ratified, code not started.** This document is the
> source of truth to build against; sections marked *(Pn)* map to the
> roadmap in §9.

Menstrual-cycle tracking. One encrypted collection, a single `/flow`
module. The cycle itself is **derived client-side** from daily logs —
the server only ever holds one ciphertext per logged day.

## 1. Purpose, scope & framing

Track periods, symptoms and (opt-in) fertility signals, so the user
can answer « when are my next periods », see how their body varies,
and — if they choose — reason about ovulation.

**Privacy is the whole point.** Menstrual data became a legal-risk
surface post-*Dobbs*; mainstream apps (Flo, Clue) have been caught
sharing it. A server-blind, self-hosted, E2E tracker is the honest
answer — not a convenience feature, a safety one. This module is the
first candidate for a future **per-module lock / plausible-deniability**
surface (its existence should be hideable under duress).

**Inclusive, non-gendered — same discipline as HRT.** No pink, no
« féminin », no assumption about *why* someone tracks. The module
serves logistics, health monitoring (SOPK, endometriosis,
perimenopause, irregular cycles), conception/contraception awareness,
and gender-affirming contexts equally (a trans man on T whose cycle
stopped or turned erratic must be first-class). `flow`, symptoms and
markers never assume a body or a goal.

> **Not medical advice.** Nodea is a personal tracking tool. Every
> estimate shown (next-period, fertile window) is informational and
> **must not** be relied on as contraception or diagnosis. This
> disclaimer ships in the UI from day one, prominently on any
> fertility-related view (same stance as HRT).

## 2. Data model

**One entry = one logged day** (sparse — a day with nothing logged has
no row). The *cycle* is never stored: it's recomputed client-side by
detecting period-start boundaries across the daily entries (§4). Same
philosophy as HRT schedules → the server stays dumb, ordering and
derivation happen after decryption.

| Collection (`X-Collection`) | Table | Payload schema |
|---|---|---|
| `cycle` | `cycle_entries` | `CyclePayloadSchema` |

Standard Nodea entry model (see `docs/Architecture.md` §7): 5 columns
(`id`, `module_user_id`, `payload`, `cipher_iv`, `guard`), no
`user_id`, no server timestamps, AES-GCM payload, deterministic HMAC
guard, two-phase creation, `requireGuard` on mutations. Registered in
[`packages/api/src/collections.ts`](../../packages/api/src/collections.ts)
and `COLLECTION_NAMES` — that auto-enrolls the guard.

## 3. Expected cleartext payload

Defined in `packages/shared/src/schemas/modules/cycle.ts`.
`z.looseObject(...)` so a future field doesn't break old blobs.

```jsonc
{
  "date": "2026-07-01",          // required, YYYY-MM-DD — natural dedup key
  "flow": "medium",              // spotting|light|medium|heavy ; absent = no bleeding logged
  "symptoms": ["cramps", "fatigue"], // free strings, preset-SUGGESTED (never constrained)
  "notes": "",

  // Opt-in « fertility awareness » block — only written when the user
  // has enabled that mode in the module. All optional.
  "bbt": 36.62,                  // basal body temperature (°C)
  "mucus": "eggwhite",           // dry|sticky|creamy|eggwhite
  "lhTest": "positive",          // positive|negative (ovulation test)

  "updatedAt": "2026-07-01T06:30:00.000Z" // ISO ; drives « récent » sort + last-write-wins on re-import
}
```

- **No mood field.** Mood × cycle is served by **cross-referencing the
  existing Mood module by date**, client-side *(P4)* — no duplicate
  entry, no duplicated data. This is the module's headline
  cross-module value.
- Symptom vocabulary lives in
  `packages/shared/src/cycle-presets.ts` (suggestions only, à la
  `hrt-presets.ts`). `symptoms` stays a free string array so an
  uncommon symptom is never blocked.
- **Sensitive fields out of MVP** (sexual activity, pregnancy tests,
  contraception log): deferred to a later phase, opt-in, ideally
  gated behind the per-module lock.

## 4. Derived client-side (never stored)

Pure functions over the decrypted daily entries (`lib/cycle-model.ts`,
Vitest-covered):

- **Period** = a contiguous run of days with `flow ∈ {light, medium,
  heavy}`. `spotting` is recorded but does **not** open/close a cycle
  by default.
  <!-- ponytail: flow≥light = menstruation; if users need a manual
       "period start" override, add a `periodStart: true` flag then. -->
- **Cycle** = period-start day → day before the next period-start.
  Yields per-cycle length + period length.
- **Next-period estimate** = last period start + median of the last
  *N* (≤6) cycle lengths. Shown as an **estimate**, always labelled.

## 5. Predictions & the irregular-cycle rule

Mainstream trackers fail by showing a **confident, wrong** prediction
on irregular cycles (SOPK, perimenopause, teens, on T). Nodea must
degrade gracefully:

- **< 2 completed cycles**, or cycle-length spread too high → show the
  logged facts, **no numeric estimate** (« pas assez de régularité pour
  estimer », not a fake date).
- **Fertile window** *(P3, opt-in)* — only when « conscience de
  fertilité » is enabled. Baseline: ovulation ≈ next period − 14 (luteal
  phase), fertile window ≈ ovulation −5..+1 ; refined by BBT
  shift / egg-white mucus / positive LH when logged. **Always** behind
  the strong disclaimer (§1) ; never presented as reliable
  contraception.

## 6. Views

- **Calendar (MVP, P1)** — the home surface. Multi-month, period days
  marked, predicted days lighter, (opt-in) fertile window shaded.
  Familiar and degrades cleanly on irregular data.
- **Ring (P2)** — glanceable « où j'en suis » widget for the regular
  case. Never the primary view.
- **Stacked cycles (P2)** — each past cycle as a horizontal bar aligned
  at day 1, so length variability reads at a glance. The honest view
  for irregular cycles. Hand-rolled SVG like `LabChart` / `Heatmap` —
  no chart lib.

Privacy invariant holds: the active module + sub-view never appear in
the URL, `document.title` on `/flow` stays generic. No `useDocumentTitle`
inside the module.

## 7. Export / Import

- Cleartext export: `modules.cycle[]` in `export.json` (never
  `payload` / `cipher_iv` / `guard` / `id`).
- Import: local re-encryption, `POST init` → `PATCH promote` flow.
- Natural dedup key: **`date`** (last-write-wins via `updatedAt`).
- Add the plugin to
  `core/api/modules/import-export/registry.data.ts` so the account-level
  `.age` backup covers Cycle (don't repeat the HRT omission).

## 8. Security

Standard entry model — `docs/Architecture.md` §7. Server stores only
ciphertext + HMAC guard; ordering/derivation are client-side after
decrypt. Among the most sensitive data the app holds — see the
per-module-lock note in §1.

## 9. Roadmap

- **P1** ✅ — schema + Drizzle table + collection registration + web
  client ; daily composer (date, flow, free symptoms, notes) ; calendar
  view ; next-period estimate (labelled, with the irregular-cycle rule) ;
  account backup plugin.
- **P2** — ring widget ✅ + stacked-cycles chart ✅ + view switcher ✅ ;
  symptom presets ⏳.
- **P3** — opt-in « conscience de fertilité » : BBT / mucus / LH fields
  + fertile-window estimate behind the disclaimer.
- **P4** — Mood × cycle cross-reference (client-side, by date).
- **Later / opt-in** — sensitive fields (intimacy, pregnancy tests,
  contraception log), gated behind the per-module lock.

## Seed

`pnpm --filter @nodea/api seed:test cycle` inserts 6 period starts over
~6 months at a ~28-day cadence (mild 27-29 d variation), 30 rows total —
enough for a « next period ~ok » estimate, a mid-cycle ring, and 5
completed bars in the stacked view. Fixtures:
[`packages/api/src/seed/cycle.fixtures.ts`](../../packages/api/src/seed/cycle.fixtures.ts).

## 10. Open decisions

- Per-module lock surface — cross-cutting, not built yet ; this module
  is its first consumer.
- Spotting as a possible cycle boundary (currently no — see §4 ceiling).
