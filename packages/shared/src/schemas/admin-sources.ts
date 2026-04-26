import { z } from 'zod';

/**
 * Health status of a single external data source (e.g. an API
 * provider used by Library lookup). Surfaced in the admin "Sources"
 * tab so the operator can verify each provider is reachable, that
 * required API keys are configured and accepted, and which sources
 * actually return data on a known query.
 */
export const SourceHealthSchema = z.object({
  /** Stable identifier (e.g. `openlibrary`, `googlebooks`). */
  name: z.string(),
  /** Human label for the table (e.g. `Open Library`). */
  label: z.string(),
  /** Module the source belongs to (`library` for Phase 2; future
   *  modules with their own providers will reuse this shape). */
  module: z.string(),
  /** Whether this provider requires an API key at all. */
  needsKey: z.boolean(),
  /** Whether the operator-side configuration is complete (e.g. for
   *  keyed providers, the env var is set). `true` for keyless
   *  providers always. When `false`, the provider is silently
   *  skipped at runtime — surfaced here so the admin can spot it. */
  configured: z.boolean(),
  /** Did the test request reach the provider and return ok? */
  online: z.boolean(),
  /** Round-trip latency in milliseconds, or null when the call
   *  never made it out (configured = false). */
  responseMs: z.number().nullable(),
  /** Did the test query return at least one result? Used to
   *  distinguish "endpoint healthy but query unsupported" from
   *  "endpoint healthy and indexed correctly". */
  testFoundResults: z.boolean(),
  /** Free-form error string when the call failed (timeout, 5xx,
   *  TLS issue…). `null` on success. */
  error: z.string().nullable(),
});
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

export const AdminSourcesResponseSchema = z.object({
  /** ISO timestamp of when the checks were run. */
  generatedAt: z.string(),
  /** Per-module list of provider health entries. */
  modules: z.record(z.string(), z.array(SourceHealthSchema)),
});
export type AdminSourcesResponse = z.infer<typeof AdminSourcesResponseSchema>;
