/**
 * Typed client for the encrypted `user_preferences` blob.
 *
 * Same E2E envelope as `modules-config-client`: the server stores
 * `{ cipher_iv, payload }`, the browser handles JSON + AES-GCM.
 * Payload shape is `UserPreferencesPayload` from `@nodea/shared`.
 *
 * On decrypt failure (stale blob, wrong key), we return an empty
 * object rather than throw — the caller falls back to its defaults
 * without a UI tombstone.
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
): Promise<UserPreferencesPayload> {
  const res = await apiGetUserPreferences();
  if (!res.cipher_iv || !res.payload) return {};
  try {
    const clear = await decryptAESGCM(
      {
        iv: res.cipher_iv as Base64 as CipherIV,
        data: res.payload as Base64 as EncryptedBlob,
      },
      aesKey,
    );
    return UserPreferencesPayloadSchema.parse(JSON.parse(clear));
  } catch {
    return {};
  }
}

export async function saveEncryptedPreferences(
  aesKey: AesMainKey,
  prefs: UserPreferencesPayload,
): Promise<void> {
  const validated = UserPreferencesPayloadSchema.parse(prefs);
  const blob = await encryptAESGCM(JSON.stringify(validated), aesKey);
  await apiPutUserPreferences({ cipher_iv: blob.iv, payload: blob.data });
}
