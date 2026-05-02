import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRegisterActivate, isApiError } from '@/core/api/client';
import { useDocumentTitle } from '@/lib/use-document-title';
import { PrivacyBody } from '@/ui/dirk/auth/AuthMarketingPanel';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';

/**
 * Activate — landing page for the magic-link in the activation email.
 *
 * The link goes to `/activate?token=<base64url>`. On mount we POST
 * the token to `/auth/register/activate`; on success the user is
 * redirected to `/login?activated=1` where Login surfaces a banner.
 *
 * Failure modes get specific UI per `reason`:
 *   - `invalid_token`   : link malformed / not in DB. Most likely
 *                         clipboard truncation or a phishing attempt.
 *   - `already_consumed`: link clicked twice or account activated
 *                         elsewhere — friendly nudge to /login.
 *   - `expired`         : 7-day window passed. Suggest a fresh
 *                         registration.
 *
 * We deliberately don't auto-redirect on error; the user reads the
 * cause and clicks themselves.
 */

type ActivationStatus =
  | { state: 'pending' }
  | { state: 'success'; email: string }
  | {
      state: 'error';
      reason: 'invalid_token' | 'already_consumed' | 'expired' | 'network';
    };

export default function ActivatePage() {
  useDocumentTitle('Activation du compte');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ActivationStatus>({ state: 'pending' });
  // React 19 strict mode runs effects twice in dev to surface side-
  // effect bugs. Without this latch the first run consumes the token
  // (success) and the second run sees `already_consumed` — the user
  // ends up on the wrong panel. The latch survives strict-mode
  // double-mount because refs persist across the unmount/remount.
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = params.get('token') ?? '';
    if (!token) {
      setStatus({ state: 'error', reason: 'invalid_token' });
      return;
    }

    (async () => {
      try {
        const res = await apiRegisterActivate({ token });
        setStatus({ state: 'success', email: res.email });
        // Brief pause so the user sees the success state before the
        // redirect — feels less abrupt than an instant nav.
        setTimeout(() => {
          navigate('/login?activated=1', { replace: true });
        }, 1200);
      } catch (err) {
        if (isApiError(err)) {
          if (err.reason === 'already_consumed') {
            setStatus({ state: 'error', reason: 'already_consumed' });
          } else if (err.reason === 'expired') {
            setStatus({ state: 'error', reason: 'expired' });
          } else {
            setStatus({ state: 'error', reason: 'invalid_token' });
          }
        } else {
          setStatus({ state: 'error', reason: 'network' });
        }
      }
    })();
  }, [params, navigate]);

  return (
    <AuthLayout headline="Active ton compte." marketing={<PrivacyBody />}>
      {status.state === 'pending' ? <PendingPanel /> : null}
      {status.state === 'success' ? (
        <SuccessPanel email={status.email} />
      ) : null}
      {status.state === 'error' ? (
        <ErrorPanel reason={status.reason} />
      ) : null}
    </AuthLayout>
  );
}

function PendingPanel() {
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">Activation en cours…</h2>
      <p className="text-[13px] text-muted">
        On vérifie ton lien, deux secondes.
      </p>
    </div>
  );
}

function SuccessPanel({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white"
      >
        ✓
      </div>
      <h2 className="mb-2 text-[20px] font-semibold text-ink">Compte activé !</h2>
      <p className="mb-4 text-[14px] text-ink-soft">
        <strong>{email}</strong> est prêt. Redirection vers la connexion…
      </p>
    </div>
  );
}

const ERROR_MESSAGES: Record<
  Exclude<
    Extract<ActivationStatus, { state: 'error' }>['reason'],
    never
  >,
  { title: string; body: string; cta: { label: string; to: string } }
> = {
  invalid_token: {
    title: 'Lien invalide',
    body: 'Ce lien d’activation n’est pas reconnu. Il a peut-être été tronqué pendant la copie. Recommence l’inscription pour en recevoir un nouveau.',
    cta: { label: 'Recommencer l’inscription', to: '/register' },
  },
  already_consumed: {
    title: 'Compte déjà activé',
    body: 'Ce lien a déjà été utilisé. Tu peux te connecter directement.',
    cta: { label: 'Aller à la connexion', to: '/login' },
  },
  expired: {
    title: 'Lien expiré',
    body: 'Le lien d’activation est valable 7 jours. Recommence l’inscription pour en recevoir un nouveau.',
    cta: { label: 'Recommencer l’inscription', to: '/register' },
  },
  network: {
    title: 'Erreur réseau',
    body: 'On n’a pas pu joindre le serveur. Vérifie ta connexion et réessaie.',
    cta: { label: 'Réessayer', to: '/activate' },
  },
};

function ErrorPanel({
  reason,
}: {
  reason: Extract<ActivationStatus, { state: 'error' }>['reason'];
}) {
  const msg = ERROR_MESSAGES[reason];
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">{msg.title}</h2>
      <p className="mb-6 text-[14px] text-ink-soft">{msg.body}</p>
      <Link
        to={msg.cta.to}
        className="inline-block rounded-md bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {msg.cta.label}
      </Link>
    </div>
  );
}
