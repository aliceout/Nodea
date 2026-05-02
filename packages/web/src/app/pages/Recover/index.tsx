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
import { useDocumentTitle } from '@/lib/use-document-title';
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
 * Two stages :
 *   1. **Form** : email + 12 words + new password (typed twice).
 *   2. **Done** : the server replaced the password credential AND
 *      nulled the recovery code (the typed mnemonic is consumed —
 *      useless if leaked). The user is redirected to `/flow` and
 *      lands signed in. The sidebar « configure a recovery code »
 *      tip reappears (driven by `recoveryCodeSet: false` on
 *      `/auth/me`) prompting the user to define a new code at
 *      their leisure. The notification email also tells them the
 *      old code is now invalid.
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

  const [email, setEmail] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await session.recoverWithCode({
        email,
        mnemonic,
        newPassword: password,
      });
      // Wipe the entered values from React state. The server has
      // minted a fresh session cookie + nulled the recovery code,
      // so we land on /flow and the sidebar tip will prompt the
      // user to configure a new code when they're ready.
      setMnemonic('');
      setPassword('');
      setConfirm('');
      navigate('/flow', { replace: true });
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
    </AuthLayout>
  );
}




