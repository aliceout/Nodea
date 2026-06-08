# HRT module (`hrt_admin_logs_entries` + `hrt_lab_results_entries` + `hrt_suppliers_entries` + `hrt_schedules_entries`)

Hormone replacement therapy tracking for trans people. Four encrypted
collections under a single `/flow` module with four sidebar sub-views (à
la Library). The product catalog lives inside **Synthèse** and recurring
schedules inside **Administration** — neither owns a tab — while a
read-only **Export** sub-view recomposes the data into a downloadable PDF
doctor recap:

- **Synthèse** — the landing dashboard (default): a dose chart for the
  selected molecule + the product catalog (which lives here), then the
  latest doses and latest lab results, read-only.
- **Administration** — a log of doses taken / injections done.
- **Analyses** — lab marker readings, plotted over time.
- **Export** — a downloadable **PDF** recap (current regimen + dose history
  + analyses + charts) plus CSV downloads. Read-only.

The standalone « Produits » sub-view was folded into **Synthèse**: the
catalog has no separate tab — it's the dashboard's top-right column, the
one surface where products are created / edited / deleted.

The module supports transfeminine, transmasculine and non-binary
regimens equally — it never assumes a single transition direction.

> **Not medical advice.** Nodea is a personal tracking tool. Any target
> ranges shown in the UI are informational (WPATH / Endocrine Society)
> and must be discussed with a clinician. This disclaimer ships in the
> Analyses view from day one.

## Functional description

- **Synthèse** is the read-only landing dashboard — *except* its product
  column, which keeps full CRUD (the catalog's only home now). Section 1:
  a `LabChart` of the selected molecule's doses in mg-equivalent (3/4) +
  the **full** product list (1/4) ; a Select in the chart header picks the
  charted molecule, and the chart fills the product list's height. Section
  2: the latest ~12 doses and lab results, read-only — their « Voir les
  prises / résultats » links open the Administration / Analyses views.
- **Administration** is **catalog-only**: a log row is just a `product`
  (referenced by name) + a `dose` + a date/time. The molecule, category,
  route, dose unit and concentration all come from the product. The form
  only offers registered products (with a « + Nouveau produit »
  quick-add). When the product's unit is mL and it has a
  `concentration`, the list shows the mg-equivalent
  (`dose × product.concentration`) by **joining live** — editing the
  product later re-derives every past dose. The log filter + dose chart
  group **by molecule** (the product's `medication`), not by product:
  switching product/supplier while staying on the same molecule keeps one
  continuous series. The chart (reusing `LabChart`) plots each intake in
  **mg-equivalent** (mL × concentration, or mg as-is; non-convertible
  doses are dropped), so different products/forms of a molecule compare.
  A **date filter** (period presets — 30 j / 3 / 6 / 12 months — plus a
  custom Du→Au range, shared `DateRangeFilter`) narrows both the list and
  the chart. Two ways to log : **« + Prise manuelle »** (a one-off
  `AdminLogForm`) and **« + Prise récurrente »**.
- **Prises récurrentes** (`hrt_schedules`) are **materialised**, not
  virtual : a schedule (`product` + `dose` + cadence `daily | every_n_days`
  + `startDate` + `endDate?`) generates a real, individually editable
  `HrtAdminLog` per occurrence, each carrying the schedule's server `id` as
  `scheduleId` (the « récurrente » badge ; à la Habits `itemRid → item.id`).
  The generator (`hooks/use-schedule-materialization`, run once at module
  mount, idempotent via `materializedThrough`) back-fills the missing days
  up to today, so a date is never created twice. Stopping a series
  (« Arrêter » in the *Prises récurrentes en cours* panel) sets `endDate`
  to today — future generation stops, the history stays. Skipping or
  adjusting a single day = edit / delete that real entry.
- **Analyses** records single lab measurements: a marker, a value, a
  unit, and the draw context (trough / peak / random) which matters for
  injectables. The chart reads these. The same **date filter** applies
  here, alongside the marker / unit / target-band controls.
- **Produits** (the catalog, managed from **Synthèse** — no standalone
  tab) is a CRUD over the product set. Each product holds `name`,
  `medication`, `category`, `route`, dose `unit` and an optional
  `concentration` (mg/mL). It is the single source those values join
  from. A « + Nouveau produit » quick-add also lives in the
  Administration dose form. Products are **archived, never deleted**
  (`archived` flag) : an archived product stays in the catalog so past
  doses keep their molecule / unit display, but drops out of the dose-form
  picker. A « Actifs / Archivés » select in the product column switches
  the view ; archived products carry a « Réactiver » action.
- **Export** is a read-only **doctor recap**, downloaded as a **PDF**,
  scoped by a date menu plus two **checkbox columns** — **Administration**
  (molecules, which scope the regimen, the dose history and the dose charts)
  and **Analyses** (markers, which scope the analyses tables and the marker
  charts). Options list every molecule / marker ever logged ; both default
  to « all shown », tracked as an *excluded* Set so no async init is needed.
  A « Grouper par » toggle organises the dose + analyses tables either by
  **type** (default — one sub-table per molecule / per marker, easier to
  read than every substance mixed) or flat by **date** (chronological).
  « Télécharger le PDF » generates the file **client-side** via
  [`lib/export-pdf.ts`](../../packages/web/src/app/flow/HRT/lib/export-pdf.ts)
  (jsPDF + jspdf-autotable, **lazy-imported** so they stay out of the main
  bundle) : a **portrait** data section — the **current regimen** (ongoing
  series, `endDate == null`), the **dose history** (admin logs in range,
  with the mL→mg join + an « auto » tag on schedule-generated days) and the
  **analyses tables** — then **one chart per landscape page** (the `LabChart`
  trends redrawn with jsPDF primitives : an mg-equivalent **dose** chart per
  molecule and a **marker** chart per analysis, ≥ 2 points). Tables are
  crisp + selectable (autotable, auto-paginated, **no cap**) ; the recap is
  **never rendered on screen** (the page shows only the controls). *Why
  client-side* : the recap is **decrypted health data** — it must never
  reach the server (no headless-Chrome render), and a browser can't silently
  save-as-PDF from `window.print()` (the dialog is unavoidable). Two CSV
  downloads (prises, analyses) serialise the same *filtered* rows via
  [`lib/csv.ts`](../../packages/web/src/app/flow/HRT/lib/csv.ts) ; an
  optional intitulé goes in the PDF header but is **ephemeral** (typed in
  the controls, never stored). All shaping is pure
  ([`lib/export-model.ts`](../../packages/web/src/app/flow/HRT/lib/export-model.ts)).

Curated vocabulary (molecules, markers, default units/routes, molar
unit conversions) lives in [`packages/shared/src/hrt-presets.ts`](../../packages/shared/src/hrt-presets.ts).
**Presets only suggest — they never constrain.** `medication`, `marker`
and `unit` are free strings so an uncommon protocol or an exotic lab
unit is never blocked.

**A product with a mg/mL `concentration` is dosed by volume (mL).** The
concentration only makes sense for a volume dose, so it — not the stored
`unit` — drives the dose entry : `doseUnitOf` (in `lib/export-model`)
returns `mL` whenever a concentration is set, the AdminLogForm asks the
dose in mL (and previews the derived mg live), and the list / charts /
export derive `dose × concentration` **per prise**. The conversion lives at
the dose entry, **never baked into the product** : the product just carries
its mg/mL concentration once, and every prise converts. A product without a
concentration keeps its own unit (e.g. an oral `mg`).

## Collections

| Collection name (`X-Collection`) | Table | Payload schema |
|---|---|---|
| `hrt-admin-logs` | `hrt_admin_logs_entries` | `HrtAdminLogPayloadSchema` |
| `hrt-lab-results` | `hrt_lab_results_entries` | `HrtLabResultPayloadSchema` |
| `hrt-suppliers` | `hrt_suppliers_entries` | `HrtProductPayloadSchema` |
| `hrt-schedules` | `hrt_schedules_entries` | `HrtSchedulePayloadSchema` |

> The product catalog keeps the legacy wire name `hrt-suppliers` /
> `hrt_suppliers_entries` (created in migration 0018). It's an
> internal, log-hidden identifier — renaming the table would be a
> destructive migration for no user benefit, so only the domain type +
> UI say « Produit ».

All three share **one module sid** (`moduleUserId`), like Library's
collections. Registered in [`packages/api/src/collections.ts`](../../packages/api/src/collections.ts)
and [`COLLECTION_NAMES`](../../packages/shared/src/schemas/entries.ts);
that enrolls them in the guard middleware automatically.

## Expected cleartext payloads

Defined in [`packages/shared/src/schemas/modules/hrt.ts`](../../packages/shared/src/schemas/modules/hrt.ts).

**Admin log** (`HrtAdminLogPayload`):

```jsonc
{
  "date": "2026-06-04",          // event date, YYYY-MM-DD
  "time": "08:30",               // optional HH:mm
  "product": "Estradiol valérate (préparation)", // required; joins to HrtProduct by name
  "dose": 0.4,                   // number ≥ 0, in the product's unit
  "notes": "",
  "scheduleId": "abc123",        // optional; set on occurrences generated from a schedule
  "updatedAt": "2026-06-04T06:30:00.000Z" // ISO; drives « Récent » sort
}
```

**Product** (`HrtProductPayload`):

```jsonc
{
  "name": "Estradiol valérate (préparation)", // required; the join key
  "medication": "Estradiol valérate", // molecule (preset-suggested)
  "category": "estrogen",        // estrogen|antiandrogen|progestogen|testosterone|gnrh|other
  "route": "injection_im",       // oral|sublingual|injection_im|...
  "unit": "mL",                  // dose unit for this product
  "concentration": 10,           // mg/mL, optional — mL dose → mg
  "archived": false,             // archived products stay joinable but leave the picker
  "notes": "",
  "updatedAt": "2026-06-04T..."
}
```

**Lab result** (`HrtLabResultPayload`):

```jsonc
{
  "date": "2026-06-04",          // draw date
  "marker": "estradiol",         // free string (preset-suggested key)
  "value": 165,                  // number
  "unit": "pg/mL",               // free string, required
  "context": "trough",           // trough|peak|random|unknown
  "lab": "",                     // optional source name
  "notes": "",
  "updatedAt": "2026-06-04T..."
}
```

**Schedule** (`HrtSchedulePayload`) — a recurring series, materialised into
admin-log occurrences:

```jsonc
{
  "product": "Utrogestan",       // required; joins to HrtProduct by name
  "dose": 100,                   // number ≥ 0
  "frequency": "daily",          // daily | every_n_days
  "everyNDays": 5,               // ≥ 1, only when frequency === every_n_days
  "time": "",                    // optional HH:mm stamped on occurrences
  "startDate": "2026-06-01",     // first occurrence, YYYY-MM-DD
  "endDate": null,               // null = ongoing; set to today when stopped
  "materializedThrough": "2026-06-07", // generator resume point (idempotency)
  "notes": "",
  "updatedAt": "2026-06-07T..."
}
```

## Security

Standard Nodea entry model — see `docs/Architecture.md` §7. Server stores
only ciphertext + an HMAC guard; no `user_id`, no server-side
timestamps (write activity must not leak). Timestamps live in the
encrypted payload; ordering is client-side after decryption.

This is among the most sensitive data the app holds (trans health
status). It relies on the existing privacy invariants: the active module
and sub-view never appear in the URL, and `document.title` on `/flow`
stays generic. Do not add `useDocumentTitle` inside the module.

## Status / roadmap

- **Phase 0** ✅ — module registered, sidebar entry + two sub-views,
  placeholder views.
- **Phase 1** ✅ — data layer: tables, collections, Zod schemas,
  presets, typed web clients, seeder fixtures.
- **Phase 2** ✅ — Administration view: RHF entry composer + log list
  (create / edit / delete), `<datalist>` preset autocomplete.
- **Phase 3** ✅ — Analyses view: lab entry form + hand-rolled SVG
  time-series chart (`components/LabChart.tsx` — no chart lib in the
  stack, see `ScoreDonut` / `Heatmap` for the precedent), per-marker
  selection and unit conversion via the shared presets
  (`lib/chart-data.ts`).
- **Phase 4** ✅ — Produits sub-view: product catalog (molecule /
  category / route / unit / concentration). Administration becomes
  catalog-only (product `<Select>` + dose, with inline quick-add) and
  joins the product live for display + mL→mg.
- **Phase 5** ✅ — informational target bands on the lab chart, off by
  default, opt-in via a Cibles : aucune / féminisant / masculinisant
  Select. Ranges live in `hrt-presets.ts` (`targets` per goal + `safe`
  for safety markers), drawn behind the line + folded into the scale.
- **Phase 6** ✅ — Export sub-view: a **downloadable PDF** doctor recap
  (jsPDF + jspdf-autotable, lazy-imported, client-side — the data is
  decrypted, so no server render) with Administration / Analyses checkbox
  columns, a date range and a « Grouper par » (type / date) toggle. Portrait
  data tables (autotable, selectable, auto-paginated) + one chart per
  landscape page (redrawn with jsPDF). CSV downloads for the filtered doses
  and analyses. Pure builders in `lib/export-model.ts`, CSV in `lib/csv.ts`,
  PDF in `lib/export-pdf.ts`.
- **Next** — goal/unit selection persistence ; adding HRT to the
  account-level JSON export/import (today the generic backup in Compte →
  Données skips HRT — see `core/api/modules/import-export/registry.data.ts`).

## Seed

`pnpm --filter @nodea/api seed:test hrt` inserts a believable
transfeminine fixture set (≈3 weeks of admin logs + a 6-month lab
trend). Fixtures: [`packages/api/src/seed/hrt.fixtures.ts`](../../packages/api/src/seed/hrt.fixtures.ts).
