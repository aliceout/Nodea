/**
 * Goals module — encrypted payload schema.
 *
 * Cleartext JSON inside the AES-GCM blob for one goal ; the server only
 * stores ciphertext. Shared so the client validates before encrypting
 * and tests assert round-trips. `z.looseObject` tolerates future fields.
 * `updatedAt` / `completedAt` live in the payload (not a server column)
 * by the minimum-readable-surface design — the server never sees per-row
 * write activity.
 */
import { z } from 'zod';

/**
 * Goal lifecycle — matches the legacy tri-state cycle that the history
 * view toggles through: open → wip → done → open.
 * `active` / `archived` are accepted as legacy archive aliases for
 * forwards-compat with older import files.
 */
export const GOAL_STATUS_VALUES = ['open', 'wip', 'done', 'active', 'archived'] as const;
export const GoalsPayloadSchema = z.looseObject({
  date: z.string().default(''),
  title: z.string().min(1),
  note: z.string().default(''),
  status: z.enum(GOAL_STATUS_VALUES).default('open'),
  thread: z.string().default(''),
  /** ISO timestamp captured when the status flips to `done`.
   *  Cleared (set to `null`) when the user later cycles the
   *  goal back to `open` / `wip`. Optional — pre-existing
   *  `done` goals don't have one and the front renders « date
   *  inconnue » in that case. Drives time-to-completion stats
   *  and the « cette année » archive view. */
  completedAt: z.string().nullable().default(null),
  /** ISO timestamp of the last write to this goal. Lives in the
   *  encrypted payload (not the entry-table wrapper) so the
   *  server never sees write activity per goal — the
   *  minimum-readable-surface design forbids per-row server-
   *  side timestamps. The Goals page bumps it on every save ;
   *  the « Récent » sort reads it. */
  updatedAt: z.string().default(''),
});
export type GoalsPayload = z.infer<typeof GoalsPayloadSchema>;
