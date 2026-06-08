/**
 * Portable, account-independent encrypted backup — seal & open.
 *
 * WHAT
 * Turns a set of named plaintext files (one JSON per module) into a single
 * opaque, passphrase-encrypted blob, and back. The sealed output is a binary
 * `age` file (Filippo Valsorda's `age` format, passphrase / scrypt mode) whose
 * decrypted payload is a ZIP of those per-module files. Open = decrypt → unzip.
 *
 * WHERE
 * Lives in `core/crypto` next to the other primitives, but unlike them it
 * derives **nothing** from the user's main key. A backup must outlive the
 * account it came from — it has to be re-importable into a *brand new* account
 * — so it is sealed under a user-chosen *passphrase*, never the session key or
 * the main key. Consumed only by the account data export/import UI
 * (`app/flow/Account/views/data`).
 *
 * DECISIONS (see docs — "Backup chiffré portable")
 * - Format = `age` (passphrase mode), not a home-made envelope. The primitives
 *   were a wash (age's scrypt + ChaCha20-Poly1305 vs our Argon2id + AES-GCM),
 *   but `age` is a reviewed, interoperable standard, so the *composition* —
 *   where hand-rolled crypto actually breaks (nonces, AAD, key wrapping) — is
 *   already vetted, and the backup stays "break-glass" recoverable with the
 *   standard `age` CLI even if Nodea disappears.
 * - "Option 2": the file is an **opaque** blob. The per-module structure lives
 *   *inside* the ciphertext, revealed only after decryption — the outer file
 *   leaks no module list nor per-module sizes. (A visible ZIP-of-encrypted-
 *   modules was rejected precisely for that metadata leak + the "a .zip invites
 *   opening / editing" footgun.)
 * - `age-encryption` + `fflate` are **dynamically imported** so they never
 *   weigh on the main bundle; the feature is reached rarely, through an
 *   explicit click. (Both are pre-bundled in `vite.config.js` `optimizeDeps`
 *   so the first click doesn't trigger a dev re-optimise that would drop the
 *   in-memory main key.)
 * - Passphrase *strength* (zxcvbn ≥ 3) is enforced at the UI boundary, NOT
 *   here. This module assumes the caller already blocked weak passphrases; it
 *   is a pure crypto primitive with no opinion on the passphrase's quality.
 * - scrypt work factor stays at the library default (logN = 18). Stronger would
 *   make the one-shot derivation sluggish for no real gain once a strong
 *   passphrase is enforced; weaker is never warranted.
 */

/** A backup's contents: file name → raw bytes (e.g. `"mood.json"` → …). */
export type BackupFiles = Record<string, Uint8Array>;

/**
 * Seal a set of named files into an opaque, passphrase-encrypted `age` blob.
 *
 * The files are first bundled into a (deflated) ZIP so that a single `age`
 * stream carries the whole per-module set, then that ZIP is encrypted under the
 * passphrase. Compressing before encrypting is safe here: a one-shot backup of
 * the user's own data has no chosen-plaintext oracle, so the usual
 * compression-side-channel concerns (CRIME/BREACH) don't apply.
 *
 * @throws if {@link files} is empty — sealing an empty backup is always a
 * caller bug, never a legitimate request (fail loud).
 */
export async function sealBackup(
  files: BackupFiles,
  passphrase: string,
): Promise<Uint8Array> {
  if (Object.keys(files).length === 0) {
    throw new Error('sealBackup: refusing to seal an empty backup');
  }
  const [{ Encrypter }, { zipSync }] = await Promise.all([
    import('age-encryption'),
    import('fflate'),
  ]);
  const zip = zipSync(files, { level: 6 });
  const encrypter = new Encrypter();
  encrypter.setPassphrase(passphrase);
  return encrypter.encrypt(zip);
}

/**
 * Open a backup produced by {@link sealBackup}: decrypt the `age` blob with the
 * passphrase, then unzip it back into its named files.
 *
 * A wrong passphrase and a tampered/corrupted blob are rejected the same way —
 * `age`'s authenticated decryption throws in both cases. We deliberately do not
 * distinguish them: there is nothing actionable a caller could do differently,
 * and "wrong passphrase OR corrupted file" is the honest message.
 *
 * @throws if the passphrase is wrong, or the blob is not a valid `age` file, or
 * it was altered after sealing.
 */
export async function openBackup(
  blob: Uint8Array,
  passphrase: string,
): Promise<BackupFiles> {
  const [{ Decrypter }, { unzipSync }] = await Promise.all([
    import('age-encryption'),
    import('fflate'),
  ]);
  const decrypter = new Decrypter();
  decrypter.addPassphrase(passphrase);
  const zip = await decrypter.decrypt(blob, 'uint8array');
  return unzipSync(zip);
}
