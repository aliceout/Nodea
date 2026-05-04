import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { ClipboardIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface SecretPanelProps {
  data: {
    secretBase32: string;
    otpauthUri: string;
    backupCodes: string[];
  };
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onActivated: () => void;
}

/**
 * Step 1/2 of TOTP setup. Shows the QR code + masked base32
 * secret + collects the 6-digit code that proves the user
 * actually scanned it. On `Activer`, calls
 * `verifyTotpEnrollment` which flips `enabled_at` server-side ;
 * on success the parent advances to the codes panel.
 *
 * Activation lives here rather than on the codes screen so the
 * user confirms the QR worked **before** committing to the
 * codes — same mental flow as « set up your authenticator,
 * then save your fallback codes ». The codes are pre-generated
 * by `/enroll/start` and stay valid whether or not the user
 * acks them on screen 2 (they're already persisted hashed in
 * `mfa_totp_recovery_codes`).
 *
 * Manual key UX : masked by default with bullets at the same
 * length so the line height stays stable on toggle. Eye toggle
 * reveals ; the copy button writes to clipboard without
 * revealing (the safer path on a shared screen).
 */
export default function SecretPanel({
  data,
  session,
  onCancel,
  onActivated,
}: SecretPanelProps) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copySecret(): Promise<void> {
    try {
      await navigator.clipboard.writeText(data.secretBase32);
      setSecretCopied(true);
      // Brief visual confirmation ; revert after 2 s so the user
      // can copy again if their app rejected the paste.
      window.setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Browsers without clipboard permission silently fail ;
      // the user can still reveal + select-all. Mirrors the
      // recovery-code page's behaviour.
    }
  }

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(data.otpauthUri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#1f1f1c', light: '#ffffff' },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch((err) => {
        if (!cancelled && import.meta.env.DEV) {
          console.warn('QR render failed', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data.otpauthUri]);

  const maskedSecret = '•'.repeat(data.secretBase32.length);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Tape les 6 chiffres affichés par ton appli.');
      return;
    }
    setSubmitting(true);
    try {
      await session.verifyTotpEnrollment(code);
      onActivated();
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Code incorrect. Réessaie avec celui en cours.');
      } else if (isApiError(err) && err.status === 400) {
        setError('Aucune activation en cours. Recommence depuis le début.');
      } else {
        setError('Erreur. Réessaie.');
        if (import.meta.env.DEV) console.warn('totp verify failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Activation TOTP · 1/2"
        title="Scanne le QR code"
        subtitle={
          <>
            Ouvre ton appli d’authentification et ajoute ce compte. Si tu ne peux
            pas scanner, dévoile la clé et tape-la manuellement.
          </>
        }
      />

      {qrSvg ? (
        <div
          className="mx-auto mb-4 flex w-fit justify-center rounded-md border border-hair bg-white p-3 [&_svg]:block [&_svg]:h-[180px] [&_svg]:w-[180px]"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      ) : (
        <div className="mx-auto mb-4 flex h-[180px] w-[180px] items-center justify-center rounded-md border border-hair bg-bg-2 text-[12px] text-muted">
          Génération…
        </div>
      )}

      <div className="mb-5 rounded-md border border-hair bg-bg-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.04em] text-muted">
            Clé secrète (saisie manuelle)
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              iconOnly
              onClick={() => void copySecret()}
              aria-label={secretCopied ? 'Copié' : 'Copier la clé'}
              title={secretCopied ? 'Copié' : 'Copier'}
              className={cn(secretCopied ? 'text-accent-deep' : 'text-muted')}
            >
              <ClipboardIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              iconOnly
              onClick={() => setSecretRevealed((v) => !v)}
              aria-label={secretRevealed ? 'Masquer la clé' : 'Afficher la clé'}
              aria-pressed={secretRevealed}
            >
              {secretRevealed ? (
                <EyeSlashIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        <p
          data-testid="totp-secret"
          className="mt-1 break-all text-left font-mono text-[12px] text-ink"
        >
          {secretRevealed ? data.secretBase32 : maskedSecret}
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Code à 6 chiffres de ton appli"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || code.length !== 6}
          className="mt-2 w-full"
        >
          {submitting ? 'Activation…' : 'Activer'}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Annuler
          </button>
        </div>
      </form>
    </>
  );
}
