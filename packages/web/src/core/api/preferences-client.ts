/**
 * Typed client for the encrypted `user_preferences` blob.
 *
 * Same E2E envelope as `modules-config-client`: the server stores
 * `{ cipher_iv, payload }`, the browser handles JSON + AES-GCM.
 * Payload shape is `UserPreferencesPayload` from `@nodea/shared`.
 *
 * « Blob absent » and « blob indéchiffrable » are DIFFERENT
 * outcomes (audit 2026-06) : absent returns `{}` (a fresh account,
 * safe to write) while a decrypt/parse failure returns `null` so
 * the caller can flip into read-only mode — the previous behaviour
 * (both → `{}`) meant the first `setPreferences()` after a corrupt
 * read silently re-encrypted an EMPTY object over every preference
 * the user had (theme, language, dismissed announcements…).
 */
import type {
  AesMainKey,
  Base64,
  CipherIV,
  EncryptedBlob,
  UserPreferencesPayload,
} from '@nodea/shared';
import { UserPreferencesPayloadSchema } from '@nodea/shared';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import {
  apiGetUserPreferences,
  apiPutUserPreferences,
} from '@/core/api/client';

export async function loadDecryptedPreferences(
  aesKey: AesMainKey,
): Promise<UserPreferencesPayload | null> {
  const res = await apiGetUserPreferences();
  if (!res.cipherIv || !res.payload) return {};
  try {
    const clear = await decryptAESGCM(
      {
        iv: res.cipherIv as Base64 as CipherIV,
        data: res.payload as Base64 as EncryptedBlob,
      },
      aesKey,
    );
    return UserPreferencesPayloadSchema.parse(JSON.parse(clear));
  } catch {
    // A blob exists but we can't read it — surface the distinction
    // so the caller refuses to overwrite it (see header comment).
    return null;
  }
}

export async function saveEncryptedPreferences(
  aesKey: AesMainKey,
  prefs: UserPreferencesPayload,
): Promise<void> {
  const validated = UserPreferencesPayloadSchema.parse(prefs);
  const blob = await encryptAESGCM(JSON.stringify(validated), aesKey);
  await apiPutUserPreferences({ cipherIv: blob.iv, payload: blob.data });
}
