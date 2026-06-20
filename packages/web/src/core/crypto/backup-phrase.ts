/**
 * Derive the 12-word phrase that seals a user's encrypted backups.
 *
 * What / where : web crypto layer, used by the `/backup` export. Instead
 * of asking the user to invent a passphrase (or generating a throwaway
 * one per export — which would leave them unable to tell which phrase
 * opens which `.age`), we DERIVE a stable phrase from the account's HMAC
 * sub-key over a version-tagged label.
 *
 * Non-obvious assumptions:
 *  - Deterministic for a given (main key, version): every `.age` made at
 *    the same version opens with the SAME 12 words — the user notes them
 *    once.
 *  - Rotatable: `version` is a non-secret counter stored in the encrypted
 *    preferences (`backupPhraseVersion`, absent ⇒ 1). Bumping it derives a
 *    fresh phrase for FUTURE exports; past files keep their old phrase.
 *  - Portable despite deriving from the account: the user transcribes the
 *    words (quiz-confirmed) and types them at restore — `age` only sees a
 *    passphrase string, so a backup still restores into a brand-new
 *    account. Deriving from the main key only removes the need to STORE
 *    the phrase, never the need to keep it. (Supersedes ADR-0016's
 *    "phrase derives nothing from the account" — see the ADR amendment.)
 *  - No extra exposure: anyone able to derive it already holds the main
 *    key, hence the plaintext data.
 */
import type { HmacMainKey } from '@nodea/shared/crypto-types';

import { entropyToMnemonic, wordlist } from './bip39';
import { hmacSha256 } from './hmac';

/** Derive the stable, rotatable backup seal phrase (12 BIP39 words). */
export async function deriveBackupPhrase(
  hmacKey: HmacMainKey,
  version: number,
): Promise<string> {
  // 32-byte HMAC tag, domain-separated by a versioned label; the first
  // 16 bytes are 128 bits of BIP39 entropy → 12 words (the rest is
  // discarded). Changing the version changes the tag, hence the phrase.
  const tag = await hmacSha256(hmacKey, `nodea:backup-phrase:v${version}`);
  return entropyToMnemonic(tag.slice(0, 16), wordlist);
}
