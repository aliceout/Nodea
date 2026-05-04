import { JournalPayloadSchema, type JournalPayload } from '@nodea/shared';
import { journalEntries } from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import { buildJournalFixtures } from './journal.fixtures.ts';

/**
 * Journal seed — encrypts each fixture under the user's AES key
 * and inserts a fresh row in `journal_entries`. Re-running wipes
 * the user's existing journal entries first.
 */
export async function seedJournal(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'journal', ctx.aesKey);
  const fixtures: JournalPayload[] = buildJournalFixtures().map((f) =>
    JournalPayloadSchema.parse(f),
  );
  return replaceEntries(journalEntries, sid, fixtures, ctx.aesKey, ctx.hmacKey);
}
