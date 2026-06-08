import ExportPanel from './data/ExportPanel';
import BackupExportPanel from './data/BackupExportPanel';
import ImportPanel from './data/ImportPanel';

/** « Données » tab — composes the plaintext export, the encrypted
 *  backup, and the import panels. All three run entirely client-side
 *  and never round-trip the user's plaintext through the server. */
export default function DataTab() {
  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <ExportPanel />
      <BackupExportPanel />
      <ImportPanel />
    </div>
  );
}
