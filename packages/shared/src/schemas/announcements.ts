import { z } from 'zod';

/**
 * Admin-authored public notice. Unlike every other user-owned
 * collection, announcements are plaintext on purpose — the whole
 * feature is to broadcast news to every logged-in user without
 * touching their main key.
 */
export const AnnouncementCreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  active: z.boolean().default(true),
  /** ISO 8601 datetime — announcement goes live. Optional. */
  startAt: z.string().datetime().nullable().optional(),
  /** ISO 8601 datetime — announcement auto-archives. Optional. */
  endAt: z.string().datetime().nullable().optional(),
});
export type AnnouncementCreateBody = z.infer<typeof AnnouncementCreateBodySchema>;

export const AnnouncementUpdateBodySchema = AnnouncementCreateBodySchema.partial();
export type AnnouncementUpdateBody = z.infer<typeof AnnouncementUpdateBodySchema>;

/** Row shape returned by every response. Dates are ISO strings. */
export const AnnouncementResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  active: z.boolean(),
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AnnouncementResponse = z.infer<typeof AnnouncementResponseSchema>;
