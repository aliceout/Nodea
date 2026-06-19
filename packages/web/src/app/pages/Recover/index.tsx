import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';
import { zxcvbn } from '@/core/auth/password-strength';
import { useSession } from '@/core/auth/use-session';
import {
  apiErrorMessage,
  apiRecoverKekVerify,
  isApiError,
} from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import { recoveryMnemonicToEntropy, sha256Hex } from '@/core/crypto/bip39';

import PasswordPanel from './PasswordPanel';
import VerifyPanel from './VerifyPanel';

type Step = 'verify' | 'password';

/**
 * `/recover` — non-destructive password recovery via BIP39 code
 * (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * **Two visible steps (issue #48)** :
 *
 *   1. **Verify** : email + 12 words. Client derives the
 *      `recoveryCodeHash` and probes `POST /auth/recover-kek/verify`.
 *      The user sees immediately whether the code matches, before
 *      committing a new password — no more typing a strong password
 *      twice only to discover the mnemonic was wrong.
 *
 *   2. **Password** : new password + confirm. The same
 *      `recoverWithCode` action as before runs the full
 *      `/start` + `/finish` rotation. Step 1 doesn't issue a server
 *      token : the rotation in step 2 is still gated by its own
 *      `/finish` hash check, step 1 is just an up-front filter.
 *
 * Throughout : anti-enum on unknown emails, anti-enum on wrong
 * recovery code (both surface as a generic "code invalide" with no
 * differentiation in the UI).
 */
export default function RecoverPage() {
  useDocumentTitle('Récupération du compte');
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();

  const [step, setStep] = useState<Step>('verify');
  const [email, setEmail] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ---- Verify step derived state ----

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
  const emailLooksValid = /\S+@\S+\.\S+/.test(email);
  const canVerify =
    !submitting && emailLooksValid && wordCount === 12;

  // ---- Password step derived state ----

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmitPassword =
    !submitting &&
    rulesOk &&
    !confirmMismatch &&
    password === confirm &&
    (strength?.score ?? 0) >= 3;

  // ---- Handlers ----

  async function onVerify(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setVerifyError(null);
    if (!canVerify) return;

    setSubmitting(true);
    try {
      const entropy = recoveryMnemonicToEntropy(mnemonic);
      if (!entropy) {
        // Client-side bad shape (wrong words, bad checksum) — same
        // user-visible message as the server-side miss to keep the
        // anti-enum surface uniform across both legs.
        throw new Error('invalid_recovery_code');
      }
      const recoveryCodeHash = await sha256Hex(entropy);
      await apiRecoverKekVerify({ email, recoveryCodeHash });
      // Server confirmed the pair — advance to step 2. Email +
      // mnemonic stay in component state because step 2's
      // `recoverWithCode` action still needs them to unwrap the KEK
      // and re-wrap it under the new password.
      setStep('password');
    } catch (err) {
      // Same UX rule as the previous monolithic flow : every miss
      // (bad shape, unknown email, hash mismatch, network) surfaces
      // as a single « code invalide » message. The api ships
      // `invalid_credentials` on 401, the helper would translate
      // that to « wrong password » — wrong semantics here.
      const isWrongCode =
        (err instanceof Error && err.message === 'invalid_recovery_code') ||
        (isApiError(err) && err.error === 'invalid_credentials');
      if (isWrongCode) {
        setVerifyError(
          t('errors.recovery.invalidCode', {
            defaultValue: 'Code de récupération invalide.',
          }),
        );
      } else {
        setVerifyError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('recover-verify failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitPassword(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setPasswordError(null);
    if (!canSubmitPassword) return;

    setSubmitting(true);
    try {
      await session.recoverWithCode({
        email,
        mnemonic,
        newPassword: password,
      });
      // Wipe entered values from React state. The server has minted
      // a fresh session cookie + nulled the recovery code, so we
      // land on /flow and the sidebar tip will prompt the user to
      // configure a new code when they're ready.
      setMnemonic('');
      setPassword('');
      setConfirm('');
      navigate('/flow', { replace: true });
    } catch (err) {
      // Theoretically step 1 already vetted the (email, mnemonic)
      // pair, so a wrong-code error here means the row changed
      // under us (race, concurrent admin action) or the user took
      // long enough that the limiter window reset and a new typo
      // crept in. Same message either way.
      const isWrongCode =
        (err instanceof Error && err.message === 'invalid_recovery_code') ||
        (isApiError(err) && err.error === 'invalid_credentials');
      if (isWrongCode) {
        setPasswordError(
          t('errors.recovery.invalidCode', {
            defaultValue: 'Code de récupération invalide.',
          }),
        );
        // Send the user back to step 1 to confirm again — their
        // mnemonic isn't trusted anymore.
        setStep('verify');
        setVerifyError(
          t('errors.recovery.invalidCode', {
            defaultValue: 'Code de récupération invalide.',
          }),
        );
      } else {
        setPasswordError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('recover failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onBackToVerify(): void {
    setPasswordError(null);
    setPassword('');
    setConfirm('');
    setStep('verify');
  }

  return (
    <AuthLayout
      headline="Récupère sans tout perdre."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Avec tes 12 mots, on peut redériver la clé qui chiffre tes données et
            la rechiffrer sous un nouveau mot de passe — sans toucher aux entrées
            existantes.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Ton ancien code de récupération est invalidé dès cette étape. Tu en
            définiras un nouveau quand tu veux depuis tes réglages — un email te
            confirmera l’invalidation.
          </p>
        </>
      }
    >
      {step === 'verify' ? (
        <VerifyPanel
          email={email}
          setEmail={setEmail}
          mnemonic={mnemonic}
          setMnemonic={setMnemonic}
          wordCount={wordCount}
          emailLooksValid={emailLooksValid}
          error={verifyError}
          submitting={submitting}
          canSubmit={canVerify}
          onSubmit={onVerify}
        />
      ) : (
        <PasswordPanel
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          rules={rules}
          rulesOk={rulesOk}
          strength={strength}
          confirmMismatch={confirmMismatch}
          error={passwordError}
          submitting={submitting}
          canSubmit={canSubmitPassword}
          onSubmit={onSubmitPassword}
          onBack={onBackToVerify}
        />
      )}
    </AuthLayout>
  );
}
