import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import {
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { apiErrorMessage, isApiError } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import RecoveryCodeDisplay from '@/ui/atoms/auth/RecoveryCodeDisplay';
import AuthLayout from '@/ui/dirk/AuthLayout';

import FormPanel from './FormPanel';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * `/recover` — non-destructive password recovery via BIP39 code
 * (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * Three stages:
 *   1. **Form**: email + 12 words + new password (typed twice).
 *   2. **Display new code**: the recover flow rotates the recovery
 *      code along with the password (the OLD code is invalidated
 *      server-side as soon as /finish runs), so we show a new
 *      mnemonic with the same 4×3 grid + ack pattern as
 *      `/recovery-code`.
 *   3. **Done**: redirect to `/flow` — the server has minted a
 *      fresh session cookie at /finish so the user lands signed in.
 *
 * Throughout: anti-enum on unknown emails, anti-enum on wrong
 * recovery code (both surface as a generic "code invalide" with no
 * differentiation in the UI).
 */
type Stage =
  | { kind: 'form' }
  | { kind: 'displaying'; mnemonic: string }
  | { kind: 'done' };

export default function RecoverPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();

  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [email, setEmail] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
  const emailLooksValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    !submitting &&
    emailLooksValid &&
    wordCount === 12 &&
    rulesOk &&
    !confirmMismatch &&
    password === confirm &&
    (strength?.score ?? 0) >= 3;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const result = await session.recoverWithCode({
        email,
        mnemonic,
        newPassword: password,
      });
      setStage({ kind: 'displaying', mnemonic: result.mnemonic });
      // Wipe the entered values from React state once accepted.
      setMnemonic('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      // Bad mnemonic shape (validated client-side) AND server-side
      // wrong-code AND unknown email all surface as the same
      // « code invalide » message — anti-enum requires not
      // differentiating client-visibly. Override needed because
      // the api ships `invalid_credentials` for a wrong recovery
      // code, which the helper would translate to « wrong
      // password » — semantically off in the recovery flow.
      const isWrongRecoveryCode =
        (err instanceof Error && err.message === 'invalid_recovery_code') ||
        (isApiError(err) && err.error === 'invalid_credentials');
      if (isWrongRecoveryCode) {
        setError(
          t('errors.recovery.invalidCode', {
            defaultValue: 'Code de récupération invalide.',
          }),
        );
      } else {
        setError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('recover failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone(): void {
    setStage({ kind: 'done' });
    navigate('/flow', { replace: true });
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
            Tu repars avec un nouveau mot de passe et un nouveau code de
            récupération. L’ancien code est invalidé immédiatement.
          </p>
        </>
      }
    >
      {stage.kind === 'form' ? (
        <FormPanel
          email={email}
          setEmail={setEmail}
          mnemonic={mnemonic}
          setMnemonic={setMnemonic}
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          rules={rules}
          rulesOk={rulesOk}
          strength={strength}
          confirmMismatch={confirmMismatch}
          wordCount={wordCount}
          emailLooksValid={emailLooksValid}
          error={error}
          submitting={submitting}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />
      ) : null}

      {stage.kind === 'displaying' ? (
        <RecoveryCodeDisplay
          eyebrow="Récupération"
          title="Compte récupéré ✓"
          subtitle={
            <>
              Ton ancien code a été invalidé. Voici le nouveau, à noter
              immédiatement.
            </>
          }
          mnemonic={stage.mnemonic}
          acknowledged={acknowledged}
          setAcknowledged={setAcknowledged}
          doneLabel="Aller à l’accueil"
          onDone={handleDone}
        />
      ) : null}
    </AuthLayout>
  );
}




