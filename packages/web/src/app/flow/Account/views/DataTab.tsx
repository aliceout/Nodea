import ExportPanel from './data/ExportPanel';
import ImportPanel from './data/ImportPanel';

/** « Données » tab — composes the export launcher (one split-button for
 *  the encrypted backup or the plain export) and the import panel. Both
 *  run entirely client-side and never round-trip the user's plaintext
 *  through the server. */
export default function DataTab() {
  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <ExportPanel />
      <ImportPanel />
    </div>
  );
}
