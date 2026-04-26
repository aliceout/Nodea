import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't auto-load `.env` like `tsx --env-file-if-exists`
// does for the rest of the API scripts. We mirror that behaviour with
// Node's built-in env-file loader (≥ 20.6) so `pnpm db:generate` and
// `pnpm db:studio` see `DATABASE_URL` from the repo-root `.env`.
try {
  process.loadEnvFile('../../.env');
} catch {
  // `.env` may not exist (e.g. CI passes env vars directly); the
  // explicit DATABASE_URL check below surfaces a clearer error if
  // it's still missing afterwards.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required for drizzle-kit');
  process.exit(1);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
