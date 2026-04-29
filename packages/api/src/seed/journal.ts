import { PassagePayloadSchema, type PassagePayload } from '@nodea/shared';
import { passageEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildJournalFixtures } from './journal.fixtures.ts';

/**
 * Journal seed — encrypts each fixture under the user's AES key
 * and inserts a fresh row in `passage_entries` (the journal-shaped
 * table — the K Passages module has its own future schema).
 * Re-running wipes the user's existing journal entries first.
 *
 * Module id is `journal` even though the table is named
 * `passage_entries` — same convention the page uses.
 */
export async function seedJournal(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'journal', ctx.aesKey);
  const fixtures: PassagePayload[] = buildJournalFixtures().map((f) =>
    PassagePayloadSchema.parse(f),
  );
  return replaceEntries(passageEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
