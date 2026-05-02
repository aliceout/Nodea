import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import {
  apiErrorMessage,
  apiResetPasswordFinish,
  apiResetPasswordStart,
} from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import { randomBytes } from '@/core/crypto/base64';
import {
  buildKekAAD,
  buildMainKeyAAD,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '@/core/crypto/factor-wrap';
import {
  clientRegisterFinish,
  clientRegisterStart,
  opaqueReady,
} from '@/core/auth/opaque';
import AuthLayout from '@/ui/dirk/AuthLayout';

import DonePanel from './DonePanel';
import InvalidLinkPanel from './InvalidLinkPanel';
import ResetForm from './ResetForm';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Consume a reset token — Direction K · Sauge.
 *
 * Destructive flow: we generate a fresh main key client-side (32
 * random bytes), run an OPAQUE registration for the new password,
 * wrap the main key under the resulting export-key-derived KEK
 * (AES-GCM), and ship the envelope alongside the token + new
 * registration record. The server purges all old encrypted data in
 * a single transaction before rotating the credentials.
 *
 * A confirmation checkbox forces the user to acknowledge the data loss
 * before the destructive request goes out. The main key bytes are
 * zeroed in memory as soon as the wrap is done.
 *
 * Two-column shell mirrors Login / Register / RequestReset so the
 * auth surface stays one continuous design language. The marketing
 * panel here keeps a recovery-specific body — the standard
 * `<PrivacyBody />` would feel oddly upbeat next to a destructive
 * action.
 */
export default function ResetPage() {
  useDocumentTitle('Nouveau mot de passe');
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    token.length > 0 &&
    password.length >= 12 &&
    passwordsMatch &&
    acknowledged &&
    (strength?.score ?? 0) >= 3 &&
    !submitting;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    const kek = randomBytes(32);
    const rawMainKey = randomBytes(32);
    try {
      await opaqueReady;

      // Step 1: OPAQUE register start with the new password.
      const reg = clientRegisterStart(password);
      const start = await apiResetPasswordStart({
        token,
        registrationRequest: reg.registrationRequest,
      });

      // Step 2: finish OPAQUE registration locally to derive the
      // exportKey we'll wrap the KEK under.
      const finished = clientRegisterFinish({
        password,
        clientRegistrationState: reg.clientRegistrationState,
        registrationResponse: start.registrationResponse,
      });

      // Step 3: wrap the random main key under the random KEK, then
      // wrap the KEK under an HKDF sub-key of `exportKey`. AAD binds
      // both blobs to the user id the server returned at /start.
      const mainKeyWrap = await wrapMainKeyUnderKek(
        rawMainKey,
        kek,
        buildMainKeyAAD(start.userId),
      );
      const kekWrap = await wrapKekUnderFactor(
        kek,
        finished.exportKey,
        buildKekAAD(start.userId, 'password'),
      );

      // Step 4: ship everything to /reset/finish — server purges old
      // data, replaces every credential blob, marks the reset token
      // used.
      await apiResetPasswordFinish({
        resetToken: start.resetToken,
        registrationRecord: finished.registrationRecord,
        wrappedMainKey: mainKeyWrap.wrappedMainKey,
        wrappedMainKeyIv: mainKeyWrap.wrappedMainKeyIv,
        wrappedKekPassword: kekWrap.wrappedKek,
        wrappedKekPasswordIv: kekWrap.wrappedKekIv,
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('reset failed', err);
    } finally {
      kek.fill(0);
      rawMainKey.fill(0);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline="Repars sur de bonnes bases."
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mot de passe est aussi la clé qui chiffre tes entrées. Le réinitialiser
            remet ton compte à zéro — toutes les données existantes sont supprimées.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            C’est volontaire : sans la clé, personne ne peut récupérer le contenu —
            y compris l’équipe de Nodea.
          </p>
        </>
      }
    >
      {!token ? (
        <InvalidLinkPanel />
      ) : done ? (
        <DonePanel />
      ) : (
        <ResetForm
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          passwordsMatch={passwordsMatch}
          strength={strength}
          acknowledged={acknowledged}
          setAcknowledged={setAcknowledged}
          error={error}
          submitting={submitting}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />
      )}
    </AuthLayout>
  );
}


