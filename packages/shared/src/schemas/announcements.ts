import { z } from 'zod';

/**
 * Admin-authored public notice. Unlike every other user-owned
 * collection, announcements are plaintext on purpose — the whole
 * feature is to broadcast news to every logged-in user without
 * touching their main key.
 */
/** Fields shared by Create and Update, WITHOUT the `active` default.
 *  Kept separate so the Update schema can stay free of that default :
 *  `z.boolean().default(true)` survives `.partial()` (the default
 *  fires on an absent key before `.optional()` can yield `undefined`),
 *  so deriving Update via `Create.partial()` made every PATCH that
 *  omitted `active` silently re-activate an archived announcement
 *  (audit 2026-06 passe 2, 3.1). The Update schema below declares
 *  `active` as a plain optional boolean — absent means « leave as-is ». */
const announcementFields = {
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  /** ISO 8601 datetime — announcement goes live. Optional. */
  startAt: z.iso.datetime().nullable().optional(),
  /** ISO 8601 datetime — announcement auto-archives. Optional. */
  endAt: z.iso.datetime().nullable().optional(),
} as const;

/** Reject a window where the start is strictly after the end — such a
 *  range silently produces an announcement that can never be live
 *  (audit 2026-06 passe 2, Priorité 4). Only fires when BOTH bounds are
 *  present and non-null ; an open-ended window (one side null/absent)
 *  is always valid. Equal timestamps are allowed (zero-length window). */
const startBeforeEnd = (v: {
  startAt?: string | null | undefined;
  endAt?: string | null | undefined;
}): boolean =>
  v.startAt == null ||
  v.endAt == null ||
  // Parse to epoch so a mixed-offset pair (e.g. `…+02:00` vs `…Z`)
  // compares by real instant, not lexically. Both are already
  // format-validated by `z.iso.datetime()`.
  new Date(v.startAt).getTime() <= new Date(v.endAt).getTime();
const startBeforeEndIssue = {
  message: 'startAt must be before or equal to endAt',
  path: ['startAt'],
};

export const AnnouncementCreateBodySchema = z
  .object({
    ...announcementFields,
    active: z.boolean().default(true),
  })
  .refine(startBeforeEnd, startBeforeEndIssue);
export type AnnouncementCreateBody = z.infer<typeof AnnouncementCreateBodySchema>;

export const AnnouncementUpdateBodySchema = z
  .object({
    ...announcementFields,
    // No `.default` here — an omitted `active` must parse to
    // `undefined` so the PATCH leaves the stored value untouched.
    active: z.boolean(),
  })
  .partial()
  .refine(startBeforeEnd, startBeforeEndIssue);
export type AnnouncementUpdateBody = z.infer<typeof AnnouncementUpdateBodySchema>;

/** Row shape returned by every response. Dates are ISO strings. */
export const AnnouncementResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  active: z.boolean(),
  startAt: z.iso.datetime().nullable(),
  endAt: z.iso.datetime().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AnnouncementResponse = z.infer<typeof AnnouncementResponseSchema>;

/** Envelope returned by `GET /admin/announcements` and the public
 *  `GET /announcements`. Both share the same shape — the difference
 *  is filtering (admin sees every row, users see live ones only).
 *
 *  Uniform `{ data, meta }` shape (audit API-06) — `meta` is empty
 *  today, kept as a passthrough so future fields (pagination cursor,
 *  total count) land without breaking the wire contract. */
export const AnnouncementListResponseSchema = z.object({
  data: z.array(AnnouncementResponseSchema),
  meta: z.looseObject({}),
});
export type AnnouncementListResponse = z.infer<typeof AnnouncementListResponseSchema>;
