/**
 * Shared zxcvbn password-strength scorer.
 *
 * Where it sits : web auth layer. Every password/passphrase form
 * (Register, Recover, Reset, ChangePassword, BackupExport) scores its
 * input through this single entry point so the dictionary + adjacency
 * graphs are configured once.
 *
 * Why it exists : @zxcvbn-ts/core v4 dropped the v3 top-level
 * `zxcvbn()` function and the `zxcvbnOptions.setOptions()` singleton in
 * favour of a `ZxcvbnFactory` instance. Rather than re-create the
 * factory (or re-run setOptions) in each form — the v3 `setOptions`
 * block was copy-pasted across five files — we own one configured
 * factory here and expose a thin `zxcvbn()` compatible with the old
 * call sites (`const { score, feedback } = zxcvbn(pwd)`).
 */
import { ZxcvbnFactory, type ZxcvbnResult } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

// Built once at module load. Common-language dictionary + spatial
// graphs only — we don't feed user inputs (email/username) as a
// dictionary because the score is a UI hint, not a server gate.
const factory = new ZxcvbnFactory({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/** Score a password. Returns the full zxcvbn result; callers
 *  typically destructure `{ score, feedback }`. `score` is `0..4`. */
export function zxcvbn(password: string): ZxcvbnResult {
  return factory.check(password);
}
