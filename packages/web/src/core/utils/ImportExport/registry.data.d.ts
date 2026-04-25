/**
 * Ambient declarations for the plain-JS import/export registry. The
 * registry itself and its per-module plugins are still .jsx — this
 * file gives TypeScript enough shape info for the K Account
 * Import/Export sections to type-check without touching the legacy
 * pipeline.
 */

export interface ImportExportPluginMeta {
  id: string;
  version?: number;
  runtimeKey?: string;
  collection?: string;
}

export interface ImportExportPluginCtx {
  moduleUserId: string;
  mainKey: unknown;
}

export interface ImportExportPlugin {
  meta?: ImportExportPluginMeta;
  exportQuery(args: {
    ctx: ImportExportPluginCtx;
    pageSize?: number;
  }): AsyncIterable<unknown>;
  importHandler(args: { payload: unknown; ctx: ImportExportPluginCtx }): Promise<void>;
  listExistingKeys(args: { sid: string; mainKey: unknown }): Promise<Set<string>>;
  getNaturalKey?(payload: unknown): string | null;
}

export function getDataPlugin(moduleKey: string): Promise<ImportExportPlugin>;
export function knownModules(): string[];
