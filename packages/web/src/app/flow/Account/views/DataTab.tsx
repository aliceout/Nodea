import CloudBackupPanel from './data/CloudBackupPanel';
import ExportPanel from './data/ExportPanel';
import ImportPanel from './data/ImportPanel';

/** « Données » tab — composes the export launcher (one split-button for
 *  the encrypted backup or the plain export), the cloud-backup connector
 *  (auto-push the `.age` to Dropbox), and the import panel. All run entirely
 *  client-side and never round-trip the user's plaintext through the server. */
export default function DataTab() {
  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <ExportPanel />
      <CloudBackupPanel />
      <ImportPanel />
    </div>
  );
}
