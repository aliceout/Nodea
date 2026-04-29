import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

import { useSession } from '@/core/auth/use-session';
import {
  apiRegisterInviteInfo,
  apiRegisterMode,
} from '@/core/api/client';
import { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';
import AuthLayout from '@/ui/dirk/AuthLayout';

import RegisterForm from './RegisterForm';
import {
  CheckYourEmailCard,
  ClosedPanel,
  InvalidInvitePanel,
  LoadingPanel,
  RedirectingToLoginCard,
} from './Stages';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

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
 * `apiRegisterInviteInfo(token)`. While that's resolving we show a
 * neutral loading state; once settled we pick the right panel.
 */
type Mode =
  | { kind: 'loading' }
  | { kind: 'invited'; email: string; token: string }
  | { kind: 'invalid_invite'; token: string }
  | { kind: 'open' }
  | { kind: 'closed' };

export default function RegisterPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>({ kind: 'loading' });
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

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

  return (
    <AuthLayout headline="Crée ton espace." marketing={<PrivacyBody />}>
      {mode.kind === 'loading' ? <LoadingPanel /> : null}
      {mode.kind === 'closed' ? <ClosedPanel /> : null}
      {mode.kind === 'invalid_invite' ? <InvalidInvitePanel /> : null}

      {(mode.kind === 'invited' || mode.kind === 'open') &&
      submittedEmail === null ? (
        <RegisterForm
          mode={mode}
          onSubmitted={setSubmittedEmail}
          submitRegistration={session.submitRegistration}
        />
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

