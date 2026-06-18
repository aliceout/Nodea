import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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
import AuthLayout from '@/ui/dirk/auth/AuthLayout';

import DonePanel from './DonePanel';
import InvalidLinkPanel from './InvalidLinkPanel';
import ResetForm from './ResetForm';

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
 * Two-column shell mirrors Login / Register / RequestReset so the
 * auth surface stays one continuous design language. The marketing
 * panel here keeps a recovery-specific body — the standard
 * `<PrivacyBody />` would feel oddly upbeat next to a destructive
 * action.
 *
 * Split (REFACTO-12 + REFACTO-06) :
 *   - `ResetForm` owns its own state (RHF + Zod schema with
 *     `password ≥ 12` + match + ack literal-true) and calls back
 *     with the validated password.
 *   - This index orchestrates : URL token read, the destructive
 *     crypto pipeline (OPAQUE register + AES-GCM wraps), the
 *     stage state machine (form → done / invalid-link).
 */
export default function ResetPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.reset.documentTitle'));
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /**
   * Called by `ResetForm` when its validation passes. The form
   * already enforced the password length, the confirmation match,
   * and the destructive-acknowledgement checkbox — here we run the
   * crypto pipeline that actually destroys the account's old data.
   */
  async function handleValidSubmit(password: string): Promise<void> {
    setError(null);
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
      headline={t('auth.reset.marketing.headline')}
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.reset.marketing.body1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.reset.marketing.body2')}
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
          submitting={submitting}
          error={error}
          onValidSubmit={handleValidSubmit}
        />
      )}
    </AuthLayout>
  );
}
