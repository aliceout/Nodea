import {
  forwardRef,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  apiPasskeyList,
  isApiError,
} from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import type { PasskeyListItem } from '@nodea/shared';

/**
 * Settings → Passkeys (Auth-Roadmap Phase 4, Auth-Spec §9).
 *
 * One page, three modes:
 *
 *   - **Idle list** (`stage = 'list'`): show enrolled passkeys with
 *     Rename + Remove actions. Headline reflects PRF-capable count
 *     so the user understands which credentials can unlock data on
 *     their own.
 *   - **Add** (`stage = 'add'`): collect a label + the current
 *     password (re-auth fresh per the matrice §6), then drive the
 *     WebAuthn registration ceremony via `useSession.enrollPasskey`.
 *   - **Confirm-remove** (`stage = 'remove'`): collect the password
 *     proof, then delete. The §6.1 mode-max downgrade auto runs
 *     server-side.
 *
 * Failures are surfaced inline rather than in a global toast so the
 * page stays self-contained.
 */
type Stage =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'remove'; passkey: PasskeyListItem }
  | { kind: 'rename'; passkey: PasskeyListItem };

export default function PasskeysPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [stage, setStage] = useState<Stage>({ kind: 'list' });
  const [passkeys, setPasskeys] = useState<PasskeyListItem[] | null>(null);
  const [prfCount, setPrfCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const res = await apiPasskeyList();
      setPasskeys(res.passkeys);
      setPrfCount(res.prfCount);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError('Impossible de charger tes passkeys.');
      if (import.meta.env.DEV) console.warn('passkey list failed', err);
    }
  }

  useEffect(() => {
    void refresh();
    // refresh runs on mount + after each mutation; no other deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Une passkey à la place du mot de passe.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Une passkey, c’est l’empreinte de ton téléphone, le PIN de ta clé
          hardware, ou ton gestionnaire de mots de passe. Confirmer une
          connexion devient un geste — plus de mot de passe à retenir.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Une passkey compatible PRF (Touch ID, Face ID, Bitwarden, 1Password)
          peut aussi déchiffrer tes données — sinon elle te connecte mais te
          demandera ton mot de passe pour ouvrir tes entrées.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[420px]">
          {stage.kind === 'list' ? (
            <ListView
              passkeys={passkeys}
              prfCount={prfCount}
              error={error}
              onAdd={() => setStage({ kind: 'add' })}
              onRename={(p) => setStage({ kind: 'rename', passkey: p })}
              onRemove={(p) => setStage({ kind: 'remove', passkey: p })}
            />
          ) : null}

          {stage.kind === 'add' ? (
            <AddView
              session={session}
              onCancel={() => setStage({ kind: 'list' })}
              onSuccess={async () => {
                setStage({ kind: 'list' });
                await refresh();
              }}
            />
          ) : null}

          {stage.kind === 'remove' ? (
            <RemoveView
              passkey={stage.passkey}
              session={session}
              onCancel={() => setStage({ kind: 'list' })}
              onSuccess={async () => {
                setStage({ kind: 'list' });
                await refresh();
              }}
            />
          ) : null}

          {stage.kind === 'rename' ? (
            <RenameView
              passkey={stage.passkey}
              session={session}
              onCancel={() => setStage({ kind: 'list' })}
              onSuccess={async () => {
                setStage({ kind: 'list' });
                await refresh();
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ============================================================================
 * List view
 * ========================================================================== */

interface ListViewProps {
  passkeys: PasskeyListItem[] | null;
  prfCount: number;
  error: string | null;
  onAdd: () => void;
  onRename: (p: PasskeyListItem) => void;
  onRemove: (p: PasskeyListItem) => void;
}

function ListView({
  passkeys,
  prfCount,
  error,
  onAdd,
  onRename,
  onRemove,
}: ListViewProps) {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Sécurité</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Mes passkeys
      </h2>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        {passkeys === null
          ? 'Chargement…'
          : passkeys.length === 0
            ? 'Aucune passkey enregistrée. Ajoute-en une pour te connecter sans retaper ton mot de passe.'
            : `${passkeys.length} passkey${passkeys.length > 1 ? 's' : ''} · ${prfCount} déchiffre${prfCount > 1 ? 'nt' : ''} tes données${prfCount === 0 ? ' (aucune compatible PRF)' : ''}.`}
      </p>

      {error ? <InlineAlert className="mb-4">{error}</InlineAlert> : null}

      {passkeys && passkeys.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {passkeys.map((p) => (
            <PasskeyRow
              key={p.id}
              passkey={p}
              onRename={() => onRename(p)}
              onRemove={() => onRemove(p)}
            />
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onAdd}
        className="mt-2 w-full"
      >
        Ajouter une passkey
      </Button>

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <Link
          to="/flow"
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour
        </Link>
      </div>
    </>
  );
}

interface PasskeyRowProps {
  passkey: PasskeyListItem;
  onRename: () => void;
  onRemove: () => void;
}

function PasskeyRow({ passkey, onRename, onRemove }: PasskeyRowProps) {
  return (
    <li className="rounded-md border border-hair bg-bg-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">
            {passkey.label ?? 'Sans nom'}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">
            {passkey.prfSupported ? (
              <span className="text-accent-deep">Déchiffre tes données</span>
            ) : (
              <span>Connexion uniquement</span>
            )}
            {passkey.lastUsedAt ? (
              <span> · Utilisée {formatDate(passkey.lastUsedAt)}</span>
            ) : (
              <span> · Jamais utilisée</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="neutral"
            size="xs"
            onClick={onRename}
          >
            Renommer
          </Button>
          <Button
            type="button"
            variant="danger-outline"
            size="xs"
            onClick={onRemove}
          >
            Retirer
          </Button>
        </div>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

/* ============================================================================
 * Add view
 * ========================================================================== */

interface AddViewProps {
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

function AddView({ session, onCancel, onSuccess }: AddViewProps) {
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Donne un nom à cette passkey.');
      return;
    }
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await session.enrollPasskey(password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else if (isWebAuthnCancel(err)) {
        setError('Enregistrement annulé.');
      } else {
        setError('Impossible d’enregistrer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey enroll failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Ajout</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Ajouter une passkey
      </h2>
      <p className="mb-6 text-[14px] leading-[1.5] text-ink-soft">
        Donne-lui un nom, retape ton mot de passe, puis confirme avec ton
        empreinte / Face ID / PIN.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nom"
          placeholder="iPhone perso, Yubikey bureau…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
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
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? 'Enregistrement…' : 'Confirmer avec ma passkey'}
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
 * Remove view
 * ========================================================================== */

interface RemoveViewProps {
  passkey: PasskeyListItem;
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

function RemoveView({ passkey, session, onCancel, onSuccess }: RemoveViewProps) {
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
      await session.removePasskey(passkey.id, password);
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Impossible de retirer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey remove failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Retrait</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Retirer une passkey
      </h2>
      <p className="mb-5 text-[14px] leading-[1.5] text-ink-soft">
        Tu vas retirer <strong className="font-semibold text-ink">{passkey.label ?? 'Sans nom'}</strong>.
        Cette passkey ne pourra plus être utilisée pour se connecter à ton
        compte.
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
          variant="danger"
          size="lg"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? 'Retrait…' : 'Retirer'}
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
 * Rename view
 * ========================================================================== */

interface RenameViewProps {
  passkey: PasskeyListItem;
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

function RenameView({ passkey, session, onCancel, onSuccess }: RenameViewProps) {
  const [label, setLabel] = useState(passkey.label ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Donne un nom à cette passkey.');
      return;
    }
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await session.renamePasskey(passkey.id, password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Impossible de renommer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey rename failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Renommer</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Renommer une passkey
      </h2>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nouveau nom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
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
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? 'Renommage…' : 'Renommer'}
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
 * Helpers
 * ========================================================================== */

function isPasswordError(err: unknown): boolean {
  if (isApiError(err) && err.status === 401) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { status?: number }).status === 401
  );
}

/**
 * `navigator.credentials.create` rejects with `NotAllowedError` when
 * the user dismisses the prompt or the operation times out. We
 * surface a friendly message instead of the raw error.
 */
function isWebAuthnCancel(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string | undefined;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, className, id, name, ...rest },
  ref,
) {
  const inputId = id ?? `field-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <div className="mb-3.5">
      <label htmlFor={inputId} className="mb-1.25 block text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-md border border-hair bg-bg px-3 py-2.5 text-[14px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
