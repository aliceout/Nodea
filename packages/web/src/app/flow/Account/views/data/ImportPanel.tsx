import { useRef, useState, type ChangeEvent } from 'react';

import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { getDataPlugin } from '@/core/utils/ImportExport/registry.data.js';
import Button from '@/ui/atoms/dirk/Button';

import Feedback from '../../components/Feedback';

/** « Importer » panel on the Data tab.
 *
 * Accepts the JSON shape produced by `ExportPanel` (versioned
 * envelope with one bucket per module) plus a legacy NDJSON / array
 * shape that pre-dates the unified format and only contained
 * Mood. Per-record idempotency is enforced via each plugin's
 * `getNaturalKey` — re-importing the same file is a no-op rather
 * than a duplicator. */
export default function ImportPanel() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFile(evt: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = evt.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!mainKey) throw new Error('Clé de chiffrement absente.');
      const text = (await file.text()).trim();
      let count = 0;
      const parts: string[] = [];

      async function pluginFor(moduleKey: string) {
        const plugin = await getDataPlugin(moduleKey);
        const runtimeKey = plugin.meta?.runtimeKey ?? plugin.meta?.id ?? moduleKey;
        if (!runtimeKey) return null;
        const sid = modules?.[runtimeKey]?.moduleUserId;
        if (!sid) return null;
        return { plugin, sid };
      }

      if (text.startsWith('{')) {
        const root = JSON.parse(text) as { modules?: Record<string, unknown[]> };
        if (!root?.modules) throw new Error('Format JSON invalide.');
        for (const [key, items] of Object.entries(root.modules)) {
          if (!Array.isArray(items) || items.length === 0) continue;
          let resolved;
          try {
            resolved = await pluginFor(key);
          } catch {
            parts.push(`${key}: ignoré (inconnu)`);
            continue;
          }
          if (!resolved) {
            parts.push(`${key}: ignoré (non activé)`);
            continue;
          }
          const { plugin, sid } = resolved;
          const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });
          let created = 0;
          let skipped = 0;
          for (const payload of items) {
            const k = plugin.getNaturalKey?.(payload) ?? null;
            if (k && existing.has(k)) {
              skipped += 1;
              continue;
            }
            await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
            if (k) existing.add(k);
            created += 1;
          }
          parts.push(`${key}: ${created} ajouté(s), ${skipped} doublon(s)`);
          count += created;
        }
      } else if (text.startsWith('[')) {
        // Legacy mood array
        const arr = JSON.parse(text) as unknown[];
        const resolved = await pluginFor('mood');
        if (!resolved) throw new Error('Module Mood non activé.');
        const { plugin, sid } = resolved;
        const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });
        for (const payload of arr) {
          const k = plugin.getNaturalKey?.(payload) ?? null;
          if (k && existing.has(k)) continue;
          await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
          if (k) existing.add(k);
          count += 1;
        }
        parts.push(`mood: ${count} ajouté(s)`);
      } else {
        throw new Error('Format inconnu.');
      }

      setSuccess(`Import terminé · ${count} entrée(s) — ${parts.join(' ; ')}`);
    } catch (err) {
      setError('Erreur d’import : ' + ((err as Error)?.message ?? ''));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">Importer</h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={loading || !mainKey}
          >
            {loading ? 'Import en cours…' : 'Importer un fichier'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json,.ndjson"
            onChange={handleFile}
            className="hidden"
          />
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          JSON ou NDJSON exporté précédemment. Doublons ignorés.
        </p>
      </div>
      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </section>
  );
}
