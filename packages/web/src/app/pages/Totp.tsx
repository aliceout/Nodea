import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ClipboardIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

/**
 * Settings → TOTP (Auth-Roadmap Phase 5B, Auth-Spec §8).
 *
 * One page, four stages depending on the user's current TOTP state
 * and what they're trying to do:
 *
 *   - **Idle** (TOTP enabled): show backup-codes-remaining count +
 *     two actions, "Régénérer les codes de secours" and "Désactiver".
 *   - **Idle** (TOTP not enabled): single CTA "Activer".
 *   - **Setup** (`stage = 'setup'`): collect the password proof, drive
 *     the enrollment-start round-trip, render the QR + base32 secret
 *     + 10 backup codes for one-shot display, ask for the verify code
 *     + the "j'ai noté mes codes" ack before flipping `enabled_at`.
 *   - **Disable / regen** (small confirm screens): collect password,
 *     ship the proof, refresh state.
 *
 * Failures are surfaced inline rather than in a global toast so the
 * page stays self-contained (mirror of `/passkeys`, `/recovery-code`).
 */
type Stage =
  | { kind: 'list' }
  | {
      kind: 'setup';
      sub: 'secret' | 'codes';
      data: {
        secretBase32: string;
        otpauthUri: string;
        backupCodes: string[];
      };
    }
  | { kind: 'regen'; sub: 'password' | 'display'; codes?: string[] }
  | { kind: 'disable' };

export default function TotpPage() {
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [stage, setStage] = useState<Stage>({ kind: 'list' });

  const totpEnabled = user?.totpEnabled === true;
  const backupCodesRemaining = user?.totpBackupCodesRemaining ?? 0;

  return (
    <AuthLayout
      headline="Un code à six chiffres en plus."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le TOTP (mot de passe à usage unique basé sur le temps) ajoute une
            deuxième couche : à chaque connexion, ton appli d’authentification
            (Bitwarden, Ente Auth, Aegis, Google Auth…) génère un code de 6
            chiffres valide 30 secondes.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une fuite de ton mot de passe ne suffit alors plus à entrer — il
            faut aussi avoir ton téléphone ou ta clé hardware sous la main.
          </p>
        </>
      }
    >
      {stage.kind === 'list' ? (
            <ListView
              totpEnabled={totpEnabled}
              backupCodesRemaining={backupCodesRemaining}
              onActivate={async (password) => {
                const data = await session.startTotpEnrollment(password);
                setStage({ kind: 'setup', sub: 'secret', data });
              }}
              onRegen={() => setStage({ kind: 'regen', sub: 'password' })}
              onDisable={() => setStage({ kind: 'disable' })}
            />
          ) : null}

          {stage.kind === 'setup' ? (
            <SetupFlow
              session={session}
              stage={stage}
              setStage={setStage}
              onCancel={() => setStage({ kind: 'list' })}
              onDone={() => setStage({ kind: 'list' })}
            />
          ) : null}

          {stage.kind === 'regen' ? (
            <RegenFlow
              session={session}
              stage={stage}
              setStage={setStage}
              onCancel={() => setStage({ kind: 'list' })}
              onDone={() => setStage({ kind: 'list' })}
            />
          ) : null}

          {stage.kind === 'disable' ? (
            <DisableView
              session={session}
              onCancel={() => setStage({ kind: 'list' })}
              onDone={() => navigate('/flow', { replace: true })}
            />
          ) : null}
    </AuthLayout>
  );
}

/* ============================================================================
 * List view — landing screen, branches on totpEnabled
 * ========================================================================== */

interface ListViewProps {
  totpEnabled: boolean;
  backupCodesRemaining: number;
  /** Called with the typed password when the user clicks "Activer
   *  TOTP" on the disabled-state form. The parent handles
   *  `startTotpEnrollment` + the stage transition; we just surface
   *  errors inline. Throws on bad password (401) or other failures. */
  onActivate: (password: string) => Promise<void>;
  onRegen: () => void;
  onDisable: () => void;
}

function ListView({
  totpEnabled,
  backupCodesRemaining,
  onActivate,
  onRegen,
  onDisable,
}: ListViewProps) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Sécurité"
        title="Authentification à deux facteurs"
      />

      {totpEnabled ? (
        <EnabledView
          backupCodesRemaining={backupCodesRemaining}
          onRegen={onRegen}
          onDisable={onDisable}
        />
      ) : (
        <DisabledActivateView onActivate={onActivate} />
      )}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <Link to="/flow" className="cursor-pointer transition-colors hover:text-ink">
          ← Retour
        </Link>
      </div>
    </>
  );
}

interface EnabledViewProps {
  backupCodesRemaining: number;
  onRegen: () => void;
  onDisable: () => void;
}

function EnabledView({ backupCodesRemaining, onRegen, onDisable }: EnabledViewProps) {
  return (
    <>
      <p className="mb-4 text-[13.5px] leading-[1.5] text-ink-soft">
        TOTP activé. Tu auras besoin d’un code à 6 chiffres généré par ton
        appli d’authentification à chaque connexion.
      </p>

      <div className="mb-5 rounded-md border border-hair bg-bg-2 px-3 py-2.5 text-[12.5px]">
        <p className="text-ink-soft">
          <strong className="font-semibold text-ink">
            {backupCodesRemaining}
          </strong>{' '}
          code{backupCodesRemaining > 1 ? 's' : ''} de secours restant
          {backupCodesRemaining > 1 ? 's' : ''}.
          {backupCodesRemaining === 0 ? (
            <span className="block mt-1 text-danger">
              Plus aucun code disponible. Régénère-les maintenant.
            </span>
          ) : null}
        </p>
      </div>

      <Button
        type="button"
        variant="neutral"
        size="lg"
        onClick={onRegen}
        className="mb-2 w-full"
      >
        Régénérer les codes de secours
      </Button>
      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        onClick={onDisable}
        className="w-full"
      >
        Désactiver TOTP
      </Button>
    </>
  );
}

interface DisabledActivateViewProps {
  onActivate: (password: string) => Promise<void>;
}

/**
 * Disabled-state activation form — explanation + password input + CTA
 * on a single screen so the user doesn't traverse a bare
 * "tape ton mot de passe" intermediate panel between the marketing
 * intro and the QR code.
 */
function DisabledActivateView({ onActivate }: DisabledActivateViewProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await onActivate(password);
      setPassword('');
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe incorrect.');
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Erreur. Réessaie.');
        if (import.meta.env.DEV) console.warn('totp activate failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        Aucun TOTP configuré. Tape ton mot de passe pour générer la clé et
        commencer l’activation.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || !password}
          className="mt-2 w-full"
        >
          {submitting ? '…' : 'Activer TOTP'}
        </Button>
      </form>
    </>
  );
}

/* ============================================================================
 * Setup flow — password → display secret/QR/codes → verify
 * ========================================================================== */

interface SetupFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'setup' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

function SetupFlow({ session, stage, setStage, onCancel, onDone }: SetupFlowProps) {
  if (stage.sub === 'secret') {
    const data = stage.data;
    return (
      <SecretPanel
        data={data}
        session={session}
        onCancel={onCancel}
        onActivated={() => setStage({ kind: 'setup', sub: 'codes', data })}
      />
    );
  }

  if (stage.sub === 'codes') {
    return <CodesPanel codes={stage.data.backupCodes} onDone={onDone} />;
  }

  return null;
}

interface PasswordPanelProps {
  title: string;
  body: string;
  cta: string;
  destructive?: boolean;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

function PasswordPanel({
  title,
  body,
  cta,
  destructive = false,
  onSubmit,
  onCancel,
}: PasswordPanelProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(password);
      setPassword('');
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe incorrect.');
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Erreur. Réessaie.');
        if (import.meta.env.DEV) console.warn('totp password panel failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader eyebrow="Sécurité" title={title} subtitle={body} />

      <form onSubmit={handle} noValidate>
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant={destructive ? 'danger' : 'primary'}
          size="lg"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? '…' : cta}
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

/* ============================================================================
 * Secret panel — QR code + manual base32 key (step 1 of display)
 * ========================================================================== */

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
 * Secret panel — step 1/2 of TOTP setup. Shows QR + masked secret
 * + collects the 6-digit code that proves the user actually scanned
 * it. On `Activer`, calls `verifyTotpEnrollment` which flips
 * `enabled_at` server-side; on success the parent advances to the
 * codes panel (which by then is showing already-active backup codes,
 * not pending ones).
 *
 * Activation lives here rather than on the codes screen so the user
 * confirms the QR worked **before** committing to the codes — same
 * mental flow as "set up your authenticator, then save your fallback
 * codes". The codes are pre-generated by /enroll/start and stay
 * valid whether or not the user acks them on screen 2 (they're
 * already persisted hashed in `mfa_totp_recovery_codes`).
 */
function SecretPanel({ data, session, onCancel, onActivated }: SecretPanelProps) {
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
      // Brief visual confirmation; revert after 2 s so the user can
      // copy again if their app rejected the paste.
      window.setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Browsers without clipboard permission silently fail; the
      // user can still reveal + select-all. Mirrors the recovery-
      // code page's behaviour.
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

  // Mask the base32 secret with bullets at the same length so the
  // line height stays stable on toggle.
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

      {/* QR cap — 180×180 keeps the code scannable but compact. */}
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

      {/* Manual key — masked by default. Eye toggle reveals; copy
          button writes to clipboard without revealing (the safer
          path on a shared screen). Left-aligned for natural reading. */}
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
              className={cn(
                secretCopied ? 'text-accent-deep' : 'text-muted',
              )}
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
        <p className="mt-1 break-all text-left font-mono text-[12px] text-ink">
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

/* ============================================================================
 * Codes panel — 10 backup codes + ack (step 2 of display)
 * ========================================================================== */

interface CodesPanelProps {
  codes: string[];
  onDone: () => void;
}

/**
 * Codes panel (step 2/2 of TOTP setup, post-activation). TOTP is
 * already enabled by the time we render here — the codes shown are
 * the 10 backup codes generated at /enroll/start, persisted hashed
 * in `mfa_totp_recovery_codes` and ready to be used.
 *
 * The user must acknowledge they noted the codes before "Terminé"
 * unlocks; they can still close the tab and the codes remain
 * valid (no rollback). The ack is purely UX — refusing to leave
 * before reading them — not a server-side gate at this stage.
 */
function CodesPanel({ codes, onDone }: CodesPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  function copy(): void {
    void navigator.clipboard.writeText(codes.join('\n')).catch(() => undefined);
  }

  function download(): void {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodea-totp-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Activation TOTP · 2/2"
        title="Codes de secours"
      />

      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">
          TOTP est activé. Ces 10 codes te dépanneront si tu perds l’accès à
          ton appli d’authentification. Single-use, ne te seront jamais
          re-affichés.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-hair bg-bg-2 p-3">
        <ol className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] tabular-nums">
          {codes.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2 font-mono">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              <span className="text-ink">{c}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={copy}
          className="flex-1"
        >
          Copier
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={download}
          className="flex-1"
        >
          Télécharger .txt
        </Button>
      </div>

      <label className="mb-4 flex items-start gap-2 text-[12.5px] text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
        />
        <span>J’ai noté les 10 codes dans un endroit sûr.</span>
      </label>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-2 w-full"
      >
        Terminé
      </Button>
    </>
  );
}

/* ============================================================================
 * Regenerate backup codes flow — password → display fresh codes
 * ========================================================================== */

interface RegenFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'regen' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

function RegenFlow({ session, stage, setStage, onCancel, onDone }: RegenFlowProps) {
  if (stage.sub === 'password') {
    return (
      <PasswordPanel
        title="Régénérer les codes de secours"
        body="Tape ton mot de passe. L’ancien lot de codes sera invalidé immédiatement — assure-toi de pouvoir noter le nouveau."
        cta="Régénérer"
        onCancel={onCancel}
        onSubmit={async (password) => {
          const codes = await session.regenerateTotpBackupCodes(password);
          setStage({ kind: 'regen', sub: 'display', codes });
        }}
      />
    );
  }

  if (stage.sub === 'display' && stage.codes) {
    return <RegenDisplayPanel codes={stage.codes} onDone={onDone} />;
  }

  return null;
}

interface RegenDisplayPanelProps {
  codes: string[];
  onDone: () => void;
}

function RegenDisplayPanel({ codes, onDone }: RegenDisplayPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  function copy(): void {
    void navigator.clipboard.writeText(codes.join('\n')).catch(() => undefined);
  }

  function download(): void {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodea-totp-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Sécurité"
        title="Nouveaux codes de secours"
      />

      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">
          Ces 10 codes ne te seront jamais re-affichés. L’ancien lot est
          invalidé.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-hair bg-bg-2 p-3">
        <ol className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] tabular-nums">
          {codes.map((code, i) => (
            <li key={i} className="flex items-baseline gap-2 font-mono">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              <span className="text-ink">{code}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={copy}
          className="flex-1"
        >
          Copier
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={download}
          className="flex-1"
        >
          Télécharger .txt
        </Button>
      </div>

      <label className="mb-4 flex items-start gap-2 text-[12.5px] text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
        />
        <span>J’ai noté les 10 nouveaux codes.</span>
      </label>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-2 w-full"
      >
        Terminé
      </Button>
    </>
  );
}

/* ============================================================================
 * Disable view
 * ========================================================================== */

interface DisableViewProps {
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onDone: () => void;
}

function DisableView({ session, onCancel, onDone }: DisableViewProps) {
  return (
    <PasswordPanel
      title="Désactiver TOTP"
      body="Confirmer désactive la 2FA. Si ton mode de sécurité l’exige (always_totp / maximum), il sera redescendu vers password_or_passkey."
      cta="Désactiver"
      destructive
      onCancel={onCancel}
      onSubmit={async (password) => {
        await session.disableTotp(password);
        onDone();
      }}
    />
  );
}

/* ============================================================================
 * Field
 * ========================================================================== */

