/**
 * Review module — encrypted payload schema.
 *
 * Cleartext JSON inside the AES-GCM blob for one yearly review ; the
 * server only stores ciphertext. Shared so the client validates before
 * encrypting and tests assert round-trips. The nested content is a deep
 * free structure left as `unknown`-ish records on purpose (see below) ;
 * only the top-level envelope is constrained. `z.looseObject` tolerates
 * future fields.
 */
import { z } from 'zod';

/**
 * The Review payload is a deep structure (`lastYear` / `nextYear` /
 * `closing`, each with nested objects and arrays). Constraining every
 * field here would bloat the schema without adding safety — the UI
 * builds the object step by step and the server only stores the
 * ciphertext. We keep the top-level envelope tight and let the nested
 * content through as `unknown`-ish records.
 *
 * See `documentation/Modules/Review.md` for the full expected shape.
 */
export const ReviewPayloadSchema = z.looseObject({
  year: z.number().int(),
  lastYear: z.record(z.string(), z.unknown()).optional(),
  nextYear: z.record(z.string(), z.unknown()).optional(),
  closing: z.record(z.string(), z.unknown()).optional(),
  /** ISO timestamp of the last write — lives in the encrypted
   *  payload (server-side timestamps were dropped in the
   *  minimum-readable-surface refactor). The List view uses it
   *  to surface the « modifié le … » label. */
  updatedAt: z.string().default(''),
});
export type ReviewPayload = z.infer<typeof ReviewPayloadSchema>;
