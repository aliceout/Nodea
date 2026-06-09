import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config.ts';
import * as schema from './schema.ts';

const { DATABASE_URL, NODE_ENV, NODEA_DRIZZLE_LOG } = getConfig();

/** Raw postgres.js client — use only for migrations or test teardown. */
export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

// Drizzle query logger : off by default, opt-in via NODEA_DRIZZLE_LOG=1
// in any non-prod env (dev / test). Refused in production because the
// logged SQL would include parameter values, which on Nodea cover
// encrypted ciphertext + module-user-ids that the privacy model treats
// as side-channel-sensitive.
const queryLogger =
  NODE_ENV !== 'production' && NODEA_DRIZZLE_LOG === '1';

export const db = drizzle(sql, { schema, logger: queryLogger });
export type DB = typeof db;
