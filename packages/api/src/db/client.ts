import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config.ts';
import * as schema from './schema.ts';

const { DATABASE_URL } = getConfig();

/** Raw postgres.js client — use only for migrations or test teardown. */
export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(sql, { schema });
export type DB = typeof db;
