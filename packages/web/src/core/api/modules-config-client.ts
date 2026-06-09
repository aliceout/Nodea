/**
 * Client for the encrypted `modules_config` (per-user "which modules
 * are enabled + their decrypted sub-config") blob.
 *
 * The server stores `{ cipherIv, payload }`. Shape of the decrypted
 * map (one entry per toggleable module):
 *
 *     {
 *       mood:  { enabled: true,  moduleUserId: "g_xxx" },
 *       goals: { enabled: false },
 *       …
 *     }
 */
import type { AesMainKey, Base64, CipherIV, EncryptedBlob } from '@nodea/shared';
import { ModulesRuntimeSchema } from '@nodea/shared';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import {
  apiGetModulesConfig,
  apiPutModulesConfig,
} from '@/core/api/client';
import type { ModulesRuntime } from '@/core/store/nodea-store';

/** Serialise → decrypt the stored blob into the runtime map.
 *
 *  The decrypted JSON is validated against `ModulesRuntimeSchema`
 *  (audit 2026-06) — this blob carries the `moduleUserId`s that
 *  scope every encrypted-records request, and it was the only one
 *  parsed without a structural check (`as ModulesRuntime` after a
 *  bare is-object test). A blob that parses but doesn't match the
 *  schema now throws ; the caller (`useModulesHydration`) keeps the
 *  store on its defaults instead of running on garbage. */
export async function loadDecryptedModulesConfig(
  aesKey: AesMainKey,
): Promise<ModulesRuntime> {
  const res = await apiGetModulesConfig();
  if (!res.cipherIv || !res.payload) return {};
  const clear = await decryptAESGCM(
    {
      iv: res.cipherIv as Base64 as CipherIV,
      data: res.payload as Base64 as EncryptedBlob,
    },
    aesKey,
  );
  return ModulesRuntimeSchema.parse(JSON.parse(clear));
}

/** Encrypt + PUT the runtime map. */
export async function saveEncryptedModulesConfig(
  aesKey: AesMainKey,
  runtime: ModulesRuntime,
): Promise<void> {
  const blob = await encryptAESGCM(JSON.stringify(runtime), aesKey);
  await apiPutModulesConfig({ cipherIv: blob.iv, payload: blob.data });
}
