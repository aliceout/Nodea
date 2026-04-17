import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { ChangePasswordBodySchema, type ChangePasswordBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { randomBytes, bytesToBase64, base64ToBytes } from '@/core/crypto/base64';
import { deriveKeyArgon2 } from '@/core/crypto/argon2';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import type { AesMainKey, Base64, CipherIV, EncryptedBlob } from '@nodea/shared';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/** Shared envelope format for the wrapped main key: "<iv>.<data>" both base64. */
function serialiseEnvelope(iv: CipherIV, data: EncryptedBlob): string {
  return `${iv}.${data}`;
}

function parseEnvelope(envelope: string): { iv: CipherIV; data: EncryptedBlob } {
  const dot = envelope.indexOf('.');
  if (dot < 0) throw new Error('malformed encrypted-key envelope');
  return {
    iv: envelope.slice(0, dot) as Base64 as CipherIV,
    data: envelope.slice(dot + 1) as Base64 as EncryptedBlob,
  };
}

async function importKek(bytes: Uint8Array, usage: KeyUsage[]): Promise<AesMainKey> {
  return (await crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    usage,
  )) as AesMainKey;
}

/**
 * Change-password page (new back, TSX).
 *
 * Full flow, client-side:
 *   1. Read the current envelope (salt + wrapped main key) from the
 *      in-memory session user.
 *   2. Derive the CURRENT KEK = argon2id(currentPassword, currentSalt).
 *   3. Unwrap the envelope to recover the raw 32-byte main key.
 *   4. Generate a fresh salt + derive the NEW KEK.
 *   5. Rewrap the main key under the new KEK.
 *   6. Ship everything to `/auth/change-password`.
 *
 * If the current password is wrong, step 3 throws (AES-GCM auth-tag
 * mismatch) before we ever call the server — a side benefit beyond
 * the server's own argon2id check.
 *
 * Differences vs. legacy `ChangePassword.jsx`:
 *   - No double-base64 fallback: single envelope format, no legacy
 *     branch.
 *   - Raw main-key bytes are zeroed immediately after rewrap.
 *   - Password policy surfaced live via zxcvbn.
 */
export default function ChangePasswordPage() {
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [serverError, setServerError] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const strength = useMemo(() => {
    if (!newPwd) return null;
    const { score, feedback } = zxcvbn(newPwd);
    return { score, warning: feedback.warning ?? null };
  }, [newPwd]);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordBody>({
    resolver: zodResolver(ChangePasswordBodySchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      encryptionSalt: '',
      encryptedKey: '',
    },
  });

  async function onSubmit(values: ChangePasswordBody): Promise<void> {
    setServerError(null);
    if (!user) {
      setServerError('Session absente — reconnecte-toi.');
      return;
    }
    try {
      // --- 1. Derive the CURRENT KEK and unwrap the main key. ---
      const currentSaltBytes = base64ToBytes(user.encryptionSalt);
      const currentKekBytes = await deriveKeyArgon2({
        password: values.currentPassword,
        salt: currentSaltBytes,
      });
      const currentKek = await importKek(currentKekBytes, ['decrypt']);
      currentKekBytes.fill(0);

      const currentEnvelope = parseEnvelope(user.encryptedKey);
      let rawMainKeyB64: string;
      try {
        rawMainKeyB64 = await decryptAESGCM(currentEnvelope, currentKek);
      } catch {
        setServerError('Mot de passe actuel incorrect.');
        return;
      }
      const rawMainKey = base64ToBytes(rawMainKeyB64);

      // --- 2. Build the NEW envelope. ---
      try {
        const newSalt = randomBytes(16);
        const newKekBytes = await deriveKeyArgon2({
          password: values.newPassword,
          salt: newSalt,
        });
        const newKek = await importKek(newKekBytes, ['encrypt']);
        newKekBytes.fill(0);

        const rewrapped = await encryptAESGCM(rawMainKeyB64, newKek);

        const envelope: ChangePasswordBody = {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          encryptionSalt: bytesToBase64(newSalt),
          encryptedKey: serialiseEnvelope(rewrapped.iv, rewrapped.data),
        };

        await session.changePassword(envelope);
      } finally {
        rawMainKey.fill(0);
      }
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setServerError('Mot de passe actuel incorrect.');
      } else if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Nouveau mot de passe refusé.');
      } else {
        setServerError('Erreur lors du changement de mot de passe.');
        if (import.meta.env.DEV) console.warn('change-password failed', err);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">Changer le mot de passe</h1>

      <label className="block">
        <span>Mot de passe actuel</span>
        <input
          type="password"
          autoComplete="current-password"
          {...field('currentPassword')}
          className="w-full"
        />
        {errors.currentPassword ? <p role="alert">{errors.currentPassword.message}</p> : null}
      </label>

      <label className="block">
        <span>Nouveau mot de passe</span>
        <input
          type="password"
          autoComplete="new-password"
          {...field('newPassword', { onChange: (e) => setNewPwd(e.target.value) })}
          className="w-full"
        />
        {errors.newPassword ? <p role="alert">{errors.newPassword.message}</p> : null}
        {strength ? (
          <p>
            Force : {strength.score} / 4
            {strength.warning ? ` — ${strength.warning}` : null}
          </p>
        ) : null}
      </label>

      {serverError ? <p role="alert">{serverError}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
    </form>
  );
}
