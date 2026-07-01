/**
 * Read the `measurements.json` text out of a Clue export file.
 *
 * Clue's export is a password-protected `.zip` (helloclue shows a one-time
 * password at export). We accept EITHER that raw `.zip` — decrypting it in the
 * browser with `@zip.js/zip.js` (the one thing `fflate` can't do: encrypted
 * entries) — OR an already-extracted `.json` / `.cluedata` file, so a user who
 * unzipped manually can still import.
 *
 * Encryption handling : an encrypted zip with no password throws
 * `needs_password` (the UI prompts) ; a bad password throws `wrong_password`.
 * An unencrypted zip is read straight through.
 */
import { BlobReader, TextWriter, ZipReader, configure } from '@zip.js/zip.js';

// No web worker : a Clue export is a few hundred KB, so inline decoding is
// plenty fast and avoids bundling a separate worker chunk under Vite.
configure({ useWebWorkers: false });

export type ClueReadError = 'needs_password' | 'wrong_password' | 'no_measurements';

export async function readClueMeasurements(
  file: File,
  password?: string,
): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json') || name.endsWith('.cluedata')) {
    return file.text();
  }

  const reader = new ZipReader(
    new BlobReader(file),
    password ? { password } : {},
  );
  try {
    const entries = await reader.getEntries();
    const entry = entries.find(
      (e) =>
        !e.directory &&
        (e.filename === 'measurements.json' ||
          e.filename.endsWith('/measurements.json')),
    );
    // `getData` lives on the file-entry arm of the `Entry` union only —
    // `'getData' in entry` narrows away the directory arm.
    if (!entry || !('getData' in entry)) {
      throw new Error('no_measurements');
    }
    if (entry.encrypted && !password) throw new Error('needs_password');
    try {
      return await entry.getData(new TextWriter());
    } catch {
      // CRC / signature mismatch on an encrypted entry ⇒ wrong password ;
      // otherwise the entry is corrupt / unreadable.
      throw new Error(entry.encrypted ? 'wrong_password' : 'no_measurements');
    }
  } finally {
    await reader.close();
  }
}
