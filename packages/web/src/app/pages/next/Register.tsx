import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { RegisterBodySchema, type RegisterBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { randomBytes, bytesToBase64 } from '@/core/crypto/base64';
import { deriveKeyArgon2 } from '@/core/crypto/argon2';
import { deriveMainKeys } from '@/core/crypto/key-material';
import { encryptAESGCM } from '@/core/crypto/aes';
import type { AesMainKey } from '@nodea/shared';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Registration page (new back, TSX).
 *
 * The form generates the crypto envelope client-side:
 *   - Fresh 16-byte salt (base64)
 *   - Fresh 32-byte main key (base64 of the raw bytes)
 *   - KEK = argon2id(password, salt)
 *   - encryptedKey = AES-GCM(KEK wraps the main-key bytes)
 *
 * The server only ever sees `encryption_salt` and `encrypted_key` as
 * opaque strings — it cannot decrypt without the password.
 *
 * Differences vs. legacy `Register.jsx`:
 *   - No preliminary `invites_codes` lookup. The code is only verified
 *     inside `/auth/register`, which eliminates the enumeration vector
 *     and the string-interpolation filter injection.
 *   - zxcvbn strength + length feedback surfaced live.
 *   - No verbose logs in prod.
 */
export default function RegisterPage() {
  const session = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterBody>({
    resolver: zodResolver(RegisterBodySchema),
    defaultValues: {
      email: '',
      password: '',
      inviteCode: '',
      encryptionSalt: '',
      encryptedKey: '',
    },
  });

  async function onSubmit(values: RegisterBody): Promise<void> {
    setServerError(null);
    try {
      // Build the crypto envelope locally.
      const salt = randomBytes(16);
      const mainKey = randomBytes(32);
      const kekBytes = await deriveKeyArgon2({ password: values.password, salt });

      // Wrap the main key: import KEK as AES-GCM, encrypt the mainKey bytes.
      const kekCryptoKey = (await crypto.subtle.importKey(
        'raw',
        kekBytes as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
      )) as AesMainKey;
      const wrapped = await encryptAESGCM(bytesToBase64(mainKey), kekCryptoKey);

      // Zero the in-memory copies. The wrapped blob is what we ship.
      kekBytes.fill(0);
      mainKey.fill(0);

      const envelope: RegisterBody = {
        email: values.email,
        password: values.password,
        inviteCode: values.inviteCode,
        encryptionSalt: bytesToBase64(salt),
        // We concatenate iv:data into a single string since that's the
        // legacy shape the rest of the codebase expects. Phase 6 may
        // adjust to a structured object once all callers are migrated.
        encryptedKey: `${wrapped.iv}.${wrapped.data}`,
      };
      await session.register(envelope);
      // Derive the main key live for the session so the next page can
      // decrypt module data. Phase 6 will move this into a dedicated
      // post-auth hook.
      await deriveMainKeys(mainKey);
      window.location.href = '/';
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Échec de l’inscription.');
      } else {
        setServerError('Erreur lors de l’inscription. Réessayez.');
        if (import.meta.env.DEV) console.warn('register failed', err);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">Inscription</h1>

      <label className="block">
        <span>E-mail</span>
        <input type="email" autoComplete="email" {...field('email')} className="w-full" />
        {errors.email ? <p role="alert">{errors.email.message}</p> : null}
      </label>

      <label className="block">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="new-password"
          {...field('password', { onChange: (e) => setPassword(e.target.value) })}
          className="w-full"
        />
        {errors.password ? <p role="alert">{errors.password.message}</p> : null}
        {strength ? (
          <p>
            Force : {strength.score} / 4
            {strength.warning ? ` — ${strength.warning}` : null}
          </p>
        ) : null}
      </label>

      <label className="block">
        <span>Code d’invitation</span>
        <input type="text" {...field('inviteCode')} className="w-full" />
        {errors.inviteCode ? <p role="alert">{errors.inviteCode.message}</p> : null}
      </label>

      {serverError ? <p role="alert">{serverError}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Inscription…' : 'Créer le compte'}
      </button>
    </form>
  );
}
