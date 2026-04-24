import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.ts';

async function main() {
  console.log('[migrate] applying migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] done');
  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
