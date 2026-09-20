# 0011 — Drizzle forward-only migrations, no rollback

- **Status**: Accepted
- **Date**: 2026-05 (audit cycle, Tier 4)

## Context

Drizzle is the ORM we use to talk to Postgres and to manage schema
migrations. Migrations are auto-generated from the TypeScript
schema files (`packages/api/src/db/schema/*.ts`) via
`drizzle-kit generate`, which produces SQL files in
`packages/api/drizzle/` (`0001_init.sql`, `0002_add_passkeys.sql`,
etc.).

These migrations are **forward-only**: Drizzle generates the SQL
to go from version N to N+1, but doesn't generate the inverse SQL
to go from N+1 back to N. If a migration crashes mid-flight in
production (e.g. a network drop in the middle of an
`ALTER TABLE` on a big table), the database stays in an
inconsistent state and the API refuses to boot.

Many other migration tools (Rails ActiveRecord, Django migrations,
Flyway, Alembic) support inverse migrations as a rollback
mechanism: if N+1 crashes, you replay the inverse SQL to roll
back to N and the API can boot again while we diagnose.

## Decision

**Accept Drizzle's forward-only mode. Do not hand-write inverse
SQL for each migration.**

The safety net for a broken migration is the **Postgres backup**:
restoring a dump taken just before the migration brings the
database back to its pre-migration state, which is equivalent to
a rollback. This dependency on backups makes the backup procedure
**non-optional** — without an up-to-date backup, a broken
migration = a more or less long outage depending on the complexity
of the manual cleanup needed.

## Consequences

**Positive:**
- **Trivial migrations to write.** `drizzle-kit generate` after
  each `schema/*.ts` change produces the SQL automatically. Zero
  manual work for 95 % of cases.
- **No risk of incorrect inverses.** When a dev hand-writes
  inverse SQL, it often has bugs (data lost by an
  `ALTER ... DROP COLUMN` can't really be rolled back — a fake
  inverse re-adds the column but without the data, which gives a
  false sense of safety). The backup, instead, restores the
  data.
- **No temptation to use rollback as a routine.** When a rollback
  mechanism exists, it gets used to undo a "missed" dev migration
  — but in prod, rollback is an emergency event that's prepared
  differently. Having a single path (backup-restore) forces
  operational discipline.

**Negative:**
- **Strong backup dependency.** If the operator hasn't configured
  the backup procedure (OPS-05), a broken migration = a
  potentially long outage. This dependency must be visible in the
  runbook (the self-host operations notes cover this).
- **No "quick undo" for a controversial migration.** If a
  migration lands and we realise the next day that it caused
  trouble (e.g. it subtly changed an index's semantics), there's
  no "undo" button — we either move forward (write migration N+2
  that fixes it) or restore a backup (losing all data entered
  between the two). Mitigated by PR review before merge.

## Alternatives considered

- **Hand-write an inverse migration for each change.** Discarded
  for the reasons listed: inverses are error-prone, the safety
  feeling is false (DROP-lost data isn't restored), and
  systematic writing discipline is rarely sustained over time
  (first migrations have their inverses, the latest ones forget).
- **Adopt a different tool with native rollback** (Atlas,
  Bytebase, etc.). Discarded because Drizzle is already
  well-integrated with the rest of the TypeScript code (schemas
  also feed the types) and switching tools would cost a lot to
  solve a problem that's well-handled by backups.
- **Schema snapshot before each migration via
  `pg_dump --schema-only`.** A variant of "backup but not
  everything". Discarded because schema without data is useless
  — the "fast rollback" scenario also needs data in its old
  shape, which only a full dump provides.

## When to revisit

If the instance grows to the point where backups become too
voluminous to take at every deploy (e.g. multi-hour dumps), the
cost of rollback-via-backup becomes prohibitive and hand-written
inverses become justified. As long as backups stay fast (minutes)
and the instance small enough that restore stays viable, keep
forward-only.
