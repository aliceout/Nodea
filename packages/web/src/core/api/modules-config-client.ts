/**
 * Client for the encrypted `modules_config` (per-user "which modules
 * are enabled + their decrypted sub-config") blob.
 *
 * The server stores `{ cipher_iv, payload }`. This module:
 *   - GET  /modules-config → decrypt → returns the typed runtime map
 *   - PUT  /modules-config ← encrypt(map) → serialised
 *
 * Shape of the decrypted map (one entry per toggleable module):
 *
 *     {
 *       mood:  { enabled: true,  moduleUserId: "g_xxx" },
 *       goals: { enabled: false },
 *       …
 *     }
 */
import type { AesMainKey, Base64, CipherIV, EncryptedBlob } from '@nodea/shared';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import {
  apiGetModulesConfig,
  apiPutModulesConfig,
} from '@/core/api/client';
import type { ModulesRuntime } from '@/core/store/nodea-store';

/** Serialise → decrypt the stored blob into the runtime map. */
export async function loadDecryptedModulesConfig(
  aesKey: AesMainKey,
): Promise<ModulesRuntime> {
  const res = await apiGetModulesConfig();
  if (!res.cipher_iv || !res.payload) return {};
  const clear = await decryptAESGCM(
    {
      iv: res.cipher_iv as Base64 as CipherIV,
      data: res.payload as Base64 as EncryptedBlob,
    },
    aesKey,
  );
  const parsed = JSON.parse(clear) as unknown;
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as ModulesRuntime;
}

/** Encrypt + PUT the runtime map. */
export async function saveEncryptedModulesConfig(
  aesKey: AesMainKey,
  runtime: ModulesRuntime,
): Promise<void> {
  const blob = await encryptAESGCM(JSON.stringify(runtime), aesKey);
  await apiPutModulesConfig({ cipher_iv: blob.iv, payload: blob.data });
}
