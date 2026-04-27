/**
 * Test-database migration runner — see issue #41.
 *
 * Mirrors the auto-derivation done in `vitest.config.ts`: takes the dev
 * `DATABASE_URL` (loaded via `--env-file-if-exists=../../.env`) and
 * swaps the dbname to its `_test` sibling before delegating to the real
 * migrate script. Inheriting the dev credentials means Infisical can
 * rotate the password without anyone editing `.env.test`.
 *
 * Idempotent — if `DATABASE_URL` already targets a `_test` database the
 * swap is skipped.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    '[migrate-test] DATABASE_URL is missing — load it via `--env-file-if-exists=../../.env` first.',
  );
  process.exit(1);
}

if (!/\/[^/?]*_test(?:\?|$)/.test(url)) {
  process.env.DATABASE_URL = url.replace(
    /(\/)([^/?]+)(\?|$)/,
    (_match, slash: string, name: string, tail: string) =>
      `${slash}${name}_test${tail}`,
  );
}

console.log(
  `[migrate-test] target = ${process.env.DATABASE_URL!.replace(/:[^:@]+@/, ':***@')}`,
);

await import('./migrate.ts');

export {};
