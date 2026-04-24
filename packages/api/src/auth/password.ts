import { hash, verify } from '@node-rs/argon2';

/**
 * OWASP-recommended argon2id parameters (2023): 19 MiB memory, 2 iterations,
 * 1 parallelism. Conservative on throughput, strong on memory hardness.
 * See https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
 *
 * The default algorithm in `@node-rs/argon2` is argon2id, so we don't need to
 * set it explicitly (and avoiding the const enum import keeps us compatible
 * with `verbatimModuleSyntax`).
 */
const ARGON2_OPTS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(stored: string, candidate: string): Promise<boolean> {
  try {
    return await verify(stored, candidate);
  } catch {
    return false;
  }
}
