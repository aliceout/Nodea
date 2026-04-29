import { useState } from 'react';

import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { getDataPlugin, knownModules } from '@/core/utils/ImportExport/registry.data.js';
import Button from '@/ui/atoms/dirk/Button';

import Feedback from '../../components/Feedback';

/** « Exporter » panel on the Data tab.
 *
 * Walks every known module, asks each for its decrypted entries
 * via `plugin.exportQuery`, and bundles them into a single JSON
 * file generated entirely client-side — the export never
 * round-trips through the server, so the user's plaintext stays
 * inside their browser. Failures on a single module are
 * non-fatal : the export still produces a file with the modules
 * that did respond. */
export default function ExportPanel() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExport(): Promise<void> {
    setSuccess('');
    setError('');
    setLoading(true);
    try {
      if (!mainKey) throw new Error('Clé de chiffrement absente');
      const out: Record<string, unknown[]> = {};
      for (const moduleKey of knownModules()) {
        try {
          const plugin = await getDataPlugin(moduleKey);
          const runtimeKey = plugin.meta?.runtimeKey ?? moduleKey;
          const sid = modules?.[runtimeKey]?.moduleUserId;
          if (!sid) continue;
          const items: unknown[] = [];
          for await (const payload of plugin.exportQuery({
            ctx: { moduleUserId: sid, mainKey },
            pageSize: 200,
          })) {
            items.push(payload);
          }
          if (items.length) out[moduleKey] = items;
        } catch (err) {
          if (import.meta.env.DEV) console.error(`Export ${moduleKey} échoué:`, err);
        }
      }
      if (Object.keys(out).length === 0) {
        setError('Aucune donnée à exporter');
        return;
      }
      const payload = {
        meta: { version: 1, exported_at: new Date().toISOString(), app: 'Nodea' },
        modules: out,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodea_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Export terminé');
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">Exporter</h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button variant="primary" size="sm" onClick={handleExport} disabled={loading || !mainKey}>
            {loading ? 'Préparation…' : 'Exporter mes données'}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          JSON déchiffré, généré chez toi. Ne quitte jamais ton navigateur.
        </p>
      </div>
      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </section>
  );
}
