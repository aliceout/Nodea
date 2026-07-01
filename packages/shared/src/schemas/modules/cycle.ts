/**
 * Cycle module — encrypted payload schema.
 *
 * Cleartext JSON inside the AES-GCM blob for one *logged day* (sparse :
 * a day with nothing logged has no row). The menstrual *cycle* is never
 * stored — it's derived client-side from these daily entries (see
 * `docs/Modules/Cycle.md` §4). `z.looseObject` tolerates future fields
 * so old records keep decoding. One module per file, like the others.
 *
 * The fertility block (`bbt` / `mucus` / `lhTest`) is opt-in : only
 * written when the user enables « conscience de fertilité ». No mood
 * field — cycle × mood is served by cross-referencing the Mood module
 * by date (spec §3, P4).
 */
import { z } from 'zod';

/** Bleeding intensity. Absent = no bleeding logged that day. */
export const CYCLE_FLOW_VALUES = ['spotting', 'light', 'medium', 'heavy'] as const;
export type CycleFlow = (typeof CYCLE_FLOW_VALUES)[number];

/** Cervical-mucus observation (opt-in fertility awareness). */
export const CYCLE_MUCUS_VALUES = ['dry', 'sticky', 'creamy', 'eggwhite'] as const;
export type CycleMucus = (typeof CYCLE_MUCUS_VALUES)[number];

export const CyclePayloadSchema = z.looseObject({
  date: z.string().min(1),
  flow: z.enum(CYCLE_FLOW_VALUES).optional(),
  symptoms: z.array(z.string()).default([]),
  notes: z.string().default(''),

  // Opt-in fertility-awareness block — all optional.
  bbt: z.number().optional(),
  mucus: z.enum(CYCLE_MUCUS_VALUES).optional(),
  lhTest: z.enum(['positive', 'negative']).optional(),

  /** ISO ; drives « récent » sort + last-write-wins on re-import. */
  updatedAt: z.string().optional(),
});
export type CyclePayload = z.infer<typeof CyclePayloadSchema>;
