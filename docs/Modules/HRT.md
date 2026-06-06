# HRT module (`hrt_admin_logs_entries` + `hrt_lab_results_entries` + `hrt_suppliers_entries`)

Hormone replacement therapy tracking for trans people. Three encrypted
collections, surfaced as three sidebar sub-views (à la Library) under a
single `/flow` module:

- **Administration** — a log of doses taken / injections done.
- **Analyses** — lab marker readings, plotted over time.
- **Produits** — the product catalog (molecule, route, dose unit,
  concentration) that the dose log references.

The module supports transfeminine, transmasculine and non-binary
regimens equally — it never assumes a single transition direction.

> **Not medical advice.** Nodea is a personal tracking tool. Any target
> ranges shown in the UI are informational (WPATH / Endocrine Society)
> and must be discussed with a clinician. This disclaimer ships in the
> Analyses view from day one.

## Functional description

- **Administration** is **catalog-only**: a log row is just a `product`
  (referenced by name) + a `dose` + a date/time. The molecule, category,
  route, dose unit and concentration all come from the product. The form
  only offers registered products (with a « + Nouveau produit »
  quick-add). When the product's unit is mL and it has a
  `concentration`, the list shows the mg-equivalent
  (`dose × product.concentration`) by **joining live** — editing the
  product later re-derives every past dose. A per-product dose-over-time
  chart (reusing `LabChart`) sits above the log, plotting each intake in
  mg when the product is mL + concentration.
- **Analyses** records single lab measurements: a marker, a value, a
  unit, and the draw context (trough / peak / random) which matters for
  injectables. The chart reads these.
- **Produits** is a CRUD over the catalog. Each product holds `name`,
  `medication`, `category`, `route`, dose `unit` and an optional
  `concentration` (mg/mL). It is the single source those values join
  from.

Curated vocabulary (molecules, markers, default units/routes, molar
unit conversions) lives in [`packages/shared/src/hrt-presets.ts`](../../packages/shared/src/hrt-presets.ts).
**Presets only suggest — they never constrain.** `medication`, `marker`
and `unit` are free strings so an uncommon protocol or an exotic lab
unit is never blocked.

## Collections

| Collection name (`X-Collection`) | Table | Payload schema |
|---|---|---|
| `hrt-admin-logs` | `hrt_admin_logs_entries` | `HrtAdminLogPayloadSchema` |
| `hrt-lab-results` | `hrt_lab_results_entries` | `HrtLabResultPayloadSchema` |
| `hrt-suppliers` | `hrt_suppliers_entries` | `HrtProductPayloadSchema` |

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

Defined in [`packages/shared/src/schemas/modules.ts`](../../packages/shared/src/schemas/modules.ts).

**Admin log** (`HrtAdminLogPayload`):

```jsonc
{
  "date": "2026-06-04",          // event date, YYYY-MM-DD
  "time": "08:30",               // optional HH:mm
  "product": "Estradiol valérate (préparation)", // required; joins to HrtProduct by name
  "dose": 0.4,                   // number ≥ 0, in the product's unit
  "notes": "",
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
- **Next** — goal/unit selection persistence, doctor export.

## Seed

`pnpm --filter @nodea/api seed:test hrt` inserts a believable
transfeminine fixture set (≈3 weeks of admin logs + a 6-month lab
trend). Fixtures: [`packages/api/src/seed/hrt.fixtures.ts`](../../packages/api/src/seed/hrt.fixtures.ts).
