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
 *  store on its defaults instead of running on garbage.
 *
 *  « Blob absent » and « blob unreadable » are DIFFERENT outcomes
 *  (audit 2026-06 passe 2) : absent returns `{}` (fresh account,
 *  safe to write) ; a decrypt/parse failure returns `null` so the
 *  caller can refuse to overwrite. Conflating them (both → `{}`,
 *  the previous behaviour) meant a corrupt read followed by a
 *  module toggle re-encrypted a near-empty blob over every
 *  `moduleUserId` — orphaning ALL encrypted data of ALL modules,
 *  irreversibly (entry rows have no `user_id`). The stricter schema
 *  parse this commit's predecessor added made that corrupt-read
 *  path MORE likely. */
export async function loadDecryptedModulesConfig(
  aesKey: AesMainKey,
): Promise<ModulesRuntime | null> {
  const res = await apiGetModulesConfig();
  if (!res.cipherIv || !res.payload) return {};
  try {
    const clear = await decryptAESGCM(
      {
        iv: res.cipherIv as Base64 as CipherIV,
        data: res.payload as Base64 as EncryptedBlob,
      },
      aesKey,
    );
    return ModulesRuntimeSchema.parse(JSON.parse(clear));
  } catch {
    // A blob exists but we can't read it — surface the distinction
    // so the caller refuses to overwrite it (see header comment).
    return null;
  }
}

/** Encrypt + PUT the runtime map. */
export async function saveEncryptedModulesConfig(
  aesKey: AesMainKey,
  runtime: ModulesRuntime,
): Promise<void> {
  const blob = await encryptAESGCM(JSON.stringify(runtime), aesKey);
  await apiPutModulesConfig({ cipherIv: blob.iv, payload: blob.data });
}
