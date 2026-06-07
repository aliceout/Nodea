/**
 * Journal module — encrypted payload schema.
 *
 * Cleartext JSON inside the AES-GCM blob for one journal entry ; the
 * server only stores ciphertext. Shared so the client validates before
 * encrypting and tests assert round-trips. Image attachments are inlined
 * (base64) inside the same blob in v1 — see the rationale on
 * `JournalAttachmentSchema`. `z.looseObject` tolerates future fields.
 */
import { z } from 'zod';

/**
 * Per-entry image attachment — inline base64 inside the encrypted
 * entry payload. v1 keeps it inline (no separate collection) since
 * the Journal use-case is « 0-3 small photos per entry » and that
 * cost stays under the per-record encryption ceiling. If the volume
 * grows we'll split into a `journal_attachments` collection mirroring
 * `library_covers` — see the follow-up issue.
 *
 * `data` is **base64 of the raw bytes** (no `data:…;base64,` prefix);
 * the renderer reconstructs the data URL with `mime`. Keeps the
 * encrypted blob a hair smaller and avoids leaking the prefix
 * twice on the wire.
 */
export const JournalAttachmentSchema = z.object({
  id: z.string().min(1),
  mime: z.string().regex(/^image\/(?:png|jpeg|jpg|webp|gif)$/),
  data: z.string().min(1),
});
export type JournalAttachment = z.infer<typeof JournalAttachmentSchema>;

export const JournalPayloadSchema = z.looseObject({
  type: z.literal('journal.entry').default('journal.entry'),
  date: z.string().min(1),
  thread: z.string().default(''),
  title: z.string().nullable().default(null),
  content: z.string().min(1),
  attachments: z.array(JournalAttachmentSchema).default([]),
});
export type JournalPayload = z.infer<typeof JournalPayloadSchema>;
