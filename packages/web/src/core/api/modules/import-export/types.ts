/**
 * Shared shape contract for the Import/Export plugin system.
 *
 * Each module (Mood, Goals, Habits, Library, Review) ships a
 * plugin under this shape ; the registry (`registry.data.ts`)
 * dispatches by module key.
 *
 * The contract is deliberately untyped on the `payload` side
 * (`unknown`) — every plugin owns its own normalisation and
 * decides what shape to export. The downstream pipe (the
 * `ExportPanel` / `ImportPanel` UI) treats payloads as opaque
 * blobs.
 */

import type { MainKeyMaterial } from '@/core/crypto/key-material';

/**
 * Runtime context passed to import / export operations. Captures
 * the current module's encrypted-collection sid and the user's
 * unwrapped main key — both required to talk to the API.
 */
export interface ImportExportPluginCtx {
  /** sid of the encrypted collection (= `module_user_id`). */
  moduleUserId: string;
  mainKey: MainKeyMaterial;
}

export interface ImportExportPluginMeta {
  /** Stable module identifier used in the JSON envelope. */
  id: string;
  /** Schema version. Bump when the payload shape changes in a
   *  non-back-compat way ; a future migration step would key on
   *  this. */
  version: number;
  /** Optional alias for the Zustand modules slice key (when it
   *  differs from `id`, e.g. `id: 'habits_items'` vs runtime key
   *  `'habits-items'`). */
  runtimeKey?: string;
  /** Underlying DB collection name — kept for reference only,
   *  the runtime no longer reads it. */
  collection?: string;
}

/**
 * Plugin shape every Import/Export module conforms to. The
 * generic stays open (`unknown`) on the payload — each plugin's
 * `normalizePayload` is the only place that knows the actual
 * shape.
 */
export interface ImportExportPlugin {
  meta: ImportExportPluginMeta;
  /** Derive a stable de-duplication key from a payload. Returns
   *  `null` when the payload doesn't carry enough info to dedup
   *  (e.g. a Mood entry with no date). */
  getNaturalKey(payload: unknown): string | null;
  /** Build the set of natural keys already present for the
   *  current user — used by the import flow to skip duplicates. */
  listExistingKeys(args: {
    sid: string;
    mainKey: MainKeyMaterial;
  }): Promise<Set<string>>;
  /** Insert a single record. Returns the action taken (always
   *  `created` today — `updated` / `skipped` reserved). */
  importHandler(args: {
    payload: unknown;
    ctx: ImportExportPluginCtx;
  }): Promise<{ action: 'created'; id: string }>;
  /** Optional batched insert (issue #127). When present, the restore
   *  pipeline collapses N records into one bulk POST per chunk of
   *  `BULK_MAX_ENTRIES`, instead of one round-trip per row. Plugins
   *  that don't expose this fall back to the per-row `importHandler`
   *  loop. Each chunk is atomic server-side. */
  bulkImportHandler?(args: {
    payloads: ReadonlyArray<unknown>;
    ctx: ImportExportPluginCtx;
  }): Promise<{ ids: string[] }>;
  /** Stream every record for export. Yields normalised payloads ;
   *  the caller handles JSON-Lines wrapping via
   *  `exportSerialize`. `pageSize` is currently a no-op signal
   *  from the consumer (no plugin paginates yet) — accepted so
   *  it stays type-safe to pass. */
  exportQuery(args: {
    ctx: ImportExportPluginCtx;
    pageSize?: number;
  }): AsyncIterable<unknown>;
  /** Wrap a single normalised payload in the versioned envelope
   *  every export line uses : `{ module, version, payload }`. */
  exportSerialize(plainPayload: unknown): {
    module: string;
    version: number;
    payload: unknown;
  };
}
