/**
 * HRT module — encrypted payload schemas (hormone replacement therapy).
 *
 * Cleartext JSON inside the AES-GCM blob ; the server only stores
 * ciphertext. Three payloads across two journals + a catalog : an
 * **admin log** (a dose taken), a **product** (the catalog entry an
 * admin log references by name), and a **lab result** (one marker
 * reading). Shared so the client validates before encrypting and tests
 * assert round-trips. The presets in `hrt-presets.ts` only *suggest* the
 * molecule / category / route / unit — the free-string fields here keep
 * uncommon protocols valid. `z.looseObject` tolerates future fields.
 */
import { z } from 'zod';

/**
 * Therapy direction / class of a medication. Drives grouping and the
 * default unit/route hints in `hrt-presets.ts`. `other` is the escape
 * hatch — the module never assumes a single transition direction and
 * supports transfeminine, transmasculine and non-binary regimens.
 */
export const HRT_CATEGORY_VALUES = [
  'estrogen',
  'antiandrogen',
  'progestogen',
  'testosterone',
  'gnrh',
  'other',
] as const;
export type HrtCategory = (typeof HRT_CATEGORY_VALUES)[number];

/** Route of administration. `injection_im` / `injection_sc` are split
 *  because the distinction matters clinically (and for site rotation). */
export const HRT_ROUTE_VALUES = [
  'oral',
  'sublingual',
  'injection_im',
  'injection_sc',
  'gel',
  'patch',
  'spray',
  'implant',
  'other',
] as const;
export type HrtRoute = (typeof HRT_ROUTE_VALUES)[number];

/**
 * Timing of a blood draw relative to the last dose. Decisive for
 * injectables (a trough and a peak read very differently) — the chart
 * uses it so points aren't compared apples-to-oranges. `unknown` keeps
 * legacy / quick entries valid.
 */
export const HRT_DRAW_CONTEXT_VALUES = ['trough', 'peak', 'random', 'unknown'] as const;
export type HrtDrawContext = (typeof HRT_DRAW_CONTEXT_VALUES)[number];

/**
 * One administration event — a dose taken or an injection done.
 *
 * Normalised against the product catalog : an administration is just
 * « product X, dose D, at date/time » — the molecule, category, route,
 * dose unit and concentration all live on the referenced `HrtProduct`.
 * `product` is the product **name** (the join key) ; `dose` is the
 * numeric amount in that product's unit. `date` is the event date
 * (`YYYY-MM-DD`), `time` an optional `HH:mm`. `updatedAt` is the ISO
 * write timestamp used for the « Récent » sort (server-side timestamps
 * don't exist by design — minimum-readable-surface).
 */
export const HrtAdminLogPayloadSchema = z.looseObject({
  date: z.string().min(1),
  time: z.string().default(''),
  /** References an `HrtProduct` by name. Required — administrations
   *  are catalog-only (the form only offers registered products). */
  product: z.string().min(1),
  dose: z.number().nonnegative(),
  notes: z.string().default(''),
  /** When set, this dose was materialised from a recurring `HrtSchedule`
   *  (the schedule's server entry `id`, à la Habits `itemRid → item.id`).
   *  Absent on manual doses ; drives the « récurrente » badge and lets
   *  the generator skip already-materialised dates. */
  scheduleId: z.string().optional(),
  updatedAt: z.string().default(''),
});
export type HrtAdminLogPayload = z.infer<typeof HrtAdminLogPayloadSchema>;

/**
 * A product in the user's catalog — the single source of truth for a
 * given preparation. Holds everything an administration needs : the
 * molecule, its therapy `category`, the `route`, the dose `unit`, and
 * (for injectables) the `concentration` in mg/mL so a mL dose reads
 * back in mg. `name` is the display label and the join key used by
 * admin logs. The presets in `hrt-presets.ts` only *suggest* the
 * molecule / category / route / unit — nothing is constrained.
 *
 * NB : the wire collection + table keep the legacy name `hrt-suppliers`
 * / `hrt_suppliers_entries` (created in migration 0018). Renaming an
 * internal, log-hidden identifier would be a destructive migration for
 * zero user benefit, so only the domain type + UI say « product ».
 */
export const HrtProductPayloadSchema = z.looseObject({
  name: z.string().min(1),
  medication: z.string().default(''),
  category: z.enum(HRT_CATEGORY_VALUES).default('other'),
  route: z.enum(HRT_ROUTE_VALUES).default('other'),
  unit: z.string().default('mg'),
  /** Injectable concentration in mg/mL — optional (oral products omit it). */
  concentration: z.number().positive().optional(),
  /** Archived products stay in the catalog (so past doses keep their join)
   *  but drop out of the dose-form picker. Reactivatable — never deleted. */
  archived: z.boolean().default(false),
  notes: z.string().default(''),
  updatedAt: z.string().default(''),
});
export type HrtProductPayload = z.infer<typeof HrtProductPayloadSchema>;

/**
 * One lab measurement — a single marker value on a given date.
 *
 * `marker` and `unit` are free strings (presets suggest, never
 * constrain). `value` may be 0 or negative-adjacent in edge assays, so
 * it's a plain number with no positivity bound. `context` records the
 * draw timing so the chart can separate trough vs peak series.
 */
export const HrtLabResultPayloadSchema = z.looseObject({
  date: z.string().min(1),
  marker: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  context: z.enum(HRT_DRAW_CONTEXT_VALUES).default('unknown'),
  /** Optional lab / source name. */
  lab: z.string().default(''),
  notes: z.string().default(''),
  updatedAt: z.string().default(''),
});
export type HrtLabResultPayload = z.infer<typeof HrtLabResultPayloadSchema>;

/** Recurrence cadence of a schedule. `every_n_days` reads `everyNDays`. */
export const HRT_FREQUENCY_VALUES = ['daily', 'every_n_days'] as const;
export type HrtFrequency = (typeof HRT_FREQUENCY_VALUES)[number];

/**
 * A recurring dose schedule (« prise récurrente »).
 *
 * **Materialised**, not virtual : the client generates a real
 * `HrtAdminLog` for each occurrence (carrying this schedule's server
 * `id` as `scheduleId`), so the journal, chart, molecule grouping and
 * date filter treat them like any dose — and each day stays individually
 * editable / deletable. This record is the generator's source of truth :
 * it back-fills the missing occurrences from `materializedThrough` up to
 * today (or `endDate`), advancing `materializedThrough` so a date is
 * never created twice. Catalog-only like admin logs (`product` is a
 * product name). Stopping a series = set `endDate` to today. See
 * `docs/Modules/HRT.md`.
 */
export const HrtSchedulePayloadSchema = z.looseObject({
  /** References an `HrtProduct` by name (catalog-only, like admin logs). */
  product: z.string().min(1),
  dose: z.number().nonnegative(),
  frequency: z.enum(HRT_FREQUENCY_VALUES).default('daily'),
  /** Interval in days when `frequency === 'every_n_days'` (≥ 1). */
  everyNDays: z.number().int().positive().optional(),
  /** Optional `HH:mm` stamped on every generated occurrence. */
  time: z.string().default(''),
  /** First occurrence date (`YYYY-MM-DD`). */
  startDate: z.string().min(1),
  /** Last date to generate, inclusive ; null = ongoing (up to today).
   *  Stopping the series sets it to today. */
  endDate: z.string().nullable().default(null),
  /** Last date the generator has materialised through — its resume
   *  point. Empty until the first occurrence is created. */
  materializedThrough: z.string().default(''),
  notes: z.string().default(''),
  updatedAt: z.string().default(''),
});
export type HrtSchedulePayload = z.infer<typeof HrtSchedulePayloadSchema>;
