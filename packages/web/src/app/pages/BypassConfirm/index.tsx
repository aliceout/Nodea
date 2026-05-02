import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiMfaBypassConfirm } from '@/core/api/client';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/AuthLayout';

import ErrorPanel, { type ErrorReason } from './ErrorPanel';
import PendingPanel from './PendingPanel';
import SuccessPanel from './SuccessPanel';

/**
 * BypassConfirm — landing page for the MFA bypass confirm email
 * link (Auth-Roadmap Phase 6).
 *
 * The email link points at `/auth/bypass/confirm?t=<token>`. On
 * mount we hit the API ; on success we surface a live HH:MM
 * countdown to `earliestApplyAt` (now + 7 days). Other server
 * statuses (`cancelled`, `consumed`, `expired`, `unknown`) each
 * get their own panel — the user gets a clear « what happened,
 * what to do next » message rather than a 404.
 *
 * The double-mount latch mirrors `Activate.tsx` : React 19 strict
 * mode runs effects twice in dev, and the first call would already
 * flip `confirmed_at`, making the second see `already_confirmed`.
 *
 * Split (REFACTO-12) :
 *   - `PendingPanel` while the api call is in flight.
 *   - `SuccessPanel` (with inline `Countdown`) on confirm OK.
 *   - `ErrorPanel` for every non-success status.
 *   - This file orchestrates : URL token read, api call, status
 *     dispatch, AuthLayout wrap.
 */
type Status =
  | { state: 'pending' }
  | {
      state: 'success';
      factor: 'totp' | 'passkey';
      earliestApplyAt: Date;
      /** True when the request was already confirmed before this
       *  click — UI nudges the user that the timer started earlier. */
      alreadyConfirmed: boolean;
    }
  | { state: 'error'; reason: ErrorReason };

export default function BypassConfirmPage() {
  useDocumentTitle('Confirmation MFA');
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>({ state: 'pending' });
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = params.get('t') ?? '';
    if (!token) {
      setStatus({ state: 'error', reason: 'unknown' });
      return;
    }

    (async () => {
      try {
        const res = await apiMfaBypassConfirm(token);
        if (res.status === 'ok' || res.status === 'already_confirmed') {
          setStatus({
            state: 'success',
            factor: res.factor,
            earliestApplyAt: new Date(res.earliestApplyAt),
            alreadyConfirmed: res.status === 'already_confirmed',
          });
        } else {
          setStatus({ state: 'error', reason: res.status });
        }
      } catch {
        setStatus({ state: 'error', reason: 'network' });
      }
    })();
  }, [params]);

  return (
    <AuthLayout
      headline="Récupération MFA."
      maxWidth="400"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Quelqu’un a demandé à se connecter sans un de tes facteurs 2FA
            (TOTP ou passkey). Toi, on espère.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une fois confirmé, le compteur 7 jours démarre. Cette latence te
            laisse le temps de réagir si ce n’est pas toi qui as déclenché la
            demande — il suffit de te reconnecter normalement à Nodea pour que
            la demande soit annulée.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Au prochain login après le délai, le facteur sera retiré et tu
            pourras te reconnecter.
          </p>
        </>
      }
    >
      {status.state === 'pending' ? <PendingPanel /> : null}
      {status.state === 'success' ? (
        <SuccessPanel
          factor={status.factor}
          earliestApplyAt={status.earliestApplyAt}
          alreadyConfirmed={status.alreadyConfirmed}
        />
      ) : null}
      {status.state === 'error' ? <ErrorPanel reason={status.reason} /> : null}
    </AuthLayout>
  );
}
