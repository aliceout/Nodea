import { z } from 'zod';

/**
 * Decrypted shape of the `modules_config` blob — the per-user
 * « which modules are enabled + their runtime sub-config » map that
 * scopes every encrypted-records request (`moduleUserId` becomes the
 * `X-Sid` header).
 *
 * Single source of truth shared by the web client (validation after
 * AES-GCM decryption — audit 2026-06 : the most security-sensitive
 * runtime blob was previously `JSON.parse(...) as ModulesRuntime`
 * with no structural check, unlike `user_preferences` which had a
 * schema from day one) and any future consumer.
 *
 * `looseObject` on both levels : the blob is written by older and
 * newer app versions of the same account — unknown future fields
 * must survive a round-trip, not be stripped or rejected.
 */
export const ModuleRuntimeEntrySchema = z.looseObject({
  enabled: z.boolean(),
  moduleUserId: z.string().optional(),
  deleteSecret: z.string().optional(),
  algo: z.string().optional(),
});
export type ModuleRuntimeEntryPayload = z.infer<typeof ModuleRuntimeEntrySchema>;

export const ModulesRuntimeSchema = z.record(
  z.string(),
  ModuleRuntimeEntrySchema,
);
export type ModulesRuntimePayload = z.infer<typeof ModulesRuntimeSchema>;
