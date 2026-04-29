/**
 * Seed orchestrator — runs every per-module seeder in order with a
 * single OPAQUE login round-trip. Idempotent : each module wipes
 * the user's existing rows before inserting fixtures, so re-running
 * gives a clean dataset rather than piling duplicates.
 *
 * Usage :
 *   ADMIN_EMAIL / ADMIN_PASSWORD set as env vars.
 *   pnpm --filter @nodea/api seed:test               # all modules
 *   pnpm --filter @nodea/api seed:test mood goals    # subset
 *
 * Module names accepted on the CLI : `mood`, `goals`, `journal`,
 * `library`, `review`. Unknown names are skipped with a warning.
 */

import { sql } from '../db/client.ts';
import { loadSeedContext, type SeedContext, type SeedResult } from './shared.ts';
import { seedMood } from './mood.ts';
import { seedGoals } from './goals.ts';
import { seedJournal } from './journal.ts';
import { seedLibrary } from './library.ts';
import { seedReview } from './review.ts';

const MODULES: ReadonlyArray<{
  name: string;
  fn: (ctx: SeedContext) => Promise<SeedResult>;
}> = [
  { name: 'mood', fn: seedMood },
  { name: 'goals', fn: seedGoals },
  { name: 'journal', fn: seedJournal },
  { name: 'library', fn: seedLibrary },
  { name: 'review', fn: seedReview },
];

async function main(): Promise<void> {
  const requested = new Set(process.argv.slice(2));
  const known = new Set(MODULES.map((m) => m.name));
  for (const name of requested) {
    if (!known.has(name)) {
      console.warn(`[seed:test] unknown module « ${name} » — skipping`);
    }
  }
  const filter = requested.size > 0 ? requested : null;

  const ctx = await loadSeedContext('seed:test');
  console.log(`[seed:test] seeding for ${ctx.user.email}`);

  for (const m of MODULES) {
    if (filter && !filter.has(m.name)) continue;
    try {
      const result = await m.fn(ctx);
      console.log(
        `[seed:test] ${m.name.padEnd(8)}— cleared ${result.cleared
          .toString()
          .padStart(2)}, inserted ${result.inserted.toString().padStart(2)}`,
      );
    } catch (err) {
      console.error(`[seed:test] ${m.name} failed`, err);
      process.exitCode = 1;
    }
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed:test] fatal', err);
  await sql.end();
  process.exit(1);
});
