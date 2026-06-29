import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  apiErrorMessage,
  apiRegisterInviteInfo,
  apiRegisterMode,
} from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import type { PreparedRegistration } from '@/core/auth/session/register';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import RecoveryCodeDisplay from '@/ui/atoms/auth/RecoveryCodeDisplay';
import { PrivacyBody } from '@/ui/dirk/auth/AuthMarketingPanel';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';

import RegisterForm from './RegisterForm';
import {
  CheckYourEmailCard,
  ClosedPanel,
  InvalidInvitePanel,
  LoadingPanel,
  RedirectingToLoginCard,
} from './Stages';

/**
 * Register — three modes (Auth-Roadmap Phase 1, post-rework v2):
 *
 *   - **Invited**   `?invite=<token>` in URL → server-issued email
 *                    pre-fills the form, locked to the invite. Submit
 *                    activates the account immediately and lands on
 *                    /login?activated=1.
 *   - **Open**      no token + admin toggle ON → free signup with
 *                    activation email + magic link.
 *   - **Closed**    no token + toggle OFF → "invitation only" panel,
 *                    no form.
 *
 * The mode is determined on mount via `apiRegisterMode()` +
 * `apiRegisterInviteInfo(token)`.
 *
 * Recovery phrase is MANDATORY at signup (Auth-Spec §7.7): the form only
 * PREPARES the account (`prepareRegistration` — OPAQUE handshake + wrapped
 * blobs, incl. the recovery factor); the user must then reveal + pass the
 * transcription quiz on `RecoveryCodeDisplay` before `finishRegistration`
 * actually creates the account. Abandoning the quiz creates NO account.
 */
type Mode =
  | { kind: 'loading' }
  | { kind: 'invited'; email: string; token: string }
  | { kind: 'invalid_invite'; token: string }
  | { kind: 'open' }
  | { kind: 'closed' };

export default function RegisterPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.register.documentTitle'));
  const session = useSession();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>({ kind: 'loading' });
  // Prepared-but-not-created account: holds the one-shot mnemonic + the wrapped
  // finish payload. Set when the form passes, cleared on « recommencer ».
  const [prepared, setPrepared] = useState<
    { data: PreparedRegistration; email: string } | null
  >(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Resolve mode on mount: if there's a token, validate it; otherwise
  // ask the server whether open registration is allowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = params.get('invite') ?? '';
      try {
        if (token) {
          const info = await apiRegisterInviteInfo(token);
          if (cancelled) return;
          if (info) {
            setMode({ kind: 'invited', email: info.email, token });
          } else {
            setMode({ kind: 'invalid_invite', token });
          }
        } else {
          const m = await apiRegisterMode();
          if (cancelled) return;
          setMode(m.openRegistration ? { kind: 'open' } : { kind: 'closed' });
        }
      } catch {
        if (!cancelled) setMode({ kind: 'closed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  // Create the account once the user has passed the recovery-phrase quiz.
  async function confirmRecovery(): Promise<void> {
    if (!prepared || finishing) return;
    setFinishError(null);
    setFinishing(true);
    try {
      const result = await session.finishRegistration(prepared.data.finishBody);
      setSubmittedEmail(result.email ?? prepared.email);
    } catch (err) {
      setFinishError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('register finish failed', err);
    } finally {
      setFinishing(false);
    }
  }

  const showForm =
    (mode.kind === 'invited' || mode.kind === 'open') &&
    prepared === null &&
    submittedEmail === null;

  return (
    <AuthLayout headline={t('auth.register.headline')} marketing={<PrivacyBody />}>
      {mode.kind === 'loading' ? <LoadingPanel /> : null}
      {mode.kind === 'closed' ? <ClosedPanel /> : null}
      {mode.kind === 'invalid_invite' ? <InvalidInvitePanel /> : null}

      {showForm ? (
        <RegisterForm
          mode={mode as { kind: 'invited'; email: string; token: string } | { kind: 'open' }}
          onPrepared={(data, email) => setPrepared({ data, email })}
          prepareRegistration={session.prepareRegistration}
        />
      ) : null}

      {/* Mandatory recovery-phrase ceremony — reveal + transcription quiz.
          `onDone` (correct quiz) creates the account; there is no skip. */}
      {prepared !== null && submittedEmail === null ? (
        <>
          <RecoveryCodeDisplay
            eyebrow={t('auth.register.eyebrow')}
            title={t('auth.register.recovery.title')}
            subtitle={t('auth.register.recovery.subtitle')}
            mnemonic={prepared.data.mnemonic}
            doneLabel={
              finishing
                ? t('common.states.submitting')
                : t('auth.register.recovery.done')
            }
            onDone={() => void confirmRecovery()}
          />
          {finishError ? (
            <>
              <InlineAlert className="mt-3">{finishError}</InlineAlert>
              <div className="mt-4 text-center text-[12.5px] text-muted">
                <button
                  type="button"
                  onClick={() => {
                    setPrepared(null);
                    setFinishError(null);
                  }}
                  className="cursor-pointer rounded-sm transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t('auth.register.recovery.restart')}
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {submittedEmail !== null && mode.kind === 'open' ? (
        <CheckYourEmailCard email={submittedEmail} />
      ) : null}
      {submittedEmail !== null && mode.kind === 'invited' ? (
        <RedirectingToLoginCard email={submittedEmail} />
      ) : null}
    </AuthLayout>
  );
}
