import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
import type { SecurityMode } from '@nodea/shared';

/**
 * Settings → Mode de sécurité (Auth-Roadmap Phase 5D, Auth-Spec §6.1).
 *
 * Standalone page (parallel layout to `/totp`, `/passkeys`,
 * `/recovery-code`) — three-card mode picker with prerequisite
 * gates and an inline password confirm form. The matrice de re-auth
 * (§6) requires a fresh password proof for every mode change.
 *
 * Requirements:
 *   - `password_or_passkey` — always reachable (downgrade path).
 *   - `always_totp`         — TOTP must be enabled.
 *   - `maximum`             — TOTP enabled AND ≥ 1 PRF passkey.
 *
 * Cards whose prerequisites are unmet are disabled with a helper
 * line pointing the user to the right place (`/totp`, `/passkeys`).
 */
interface ModeOption {
  id: SecurityMode;
  label: string;
  description: string;
  /** When non-null, the mode can't be selected — the message tells
   *  the user what to do first. */
  unmetRequirement: string | null;
}

export default function SecurityModePage() {
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const currentMode = user?.securityMode ?? 'password_or_passkey';
  const totpEnabled = user?.totpEnabled === true;
  const passkeysPrfCount = user?.passkeysPrfCount ?? 0;

  const [selected, setSelected] = useState<SecurityMode | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const options: ReadonlyArray<ModeOption> = [
    {
      id: 'password_or_passkey',
      label: 'Standard',
      description:
        'Mot de passe OU passkey suffit pour se connecter. Le défaut.',
      unmetRequirement: null,
    },
    {
      id: 'always_totp',
      label: 'TOTP requis',
      description:
        'Code à 6 chiffres en plus à chaque connexion. Active la 2FA TOTP avant.',
      unmetRequirement: totpEnabled ? null : 'Active TOTP avant.',
    },
    {
      id: 'maximum',
      label: 'Maximum',
      description:
        'Mot de passe + passkey + TOTP, les trois. Une passkey PRF-capable obligatoire.',
      unmetRequirement: !totpEnabled
        ? 'Active TOTP avant.'
        : passkeysPrfCount === 0
          ? 'Enrôle une passkey PRF avant.'
          : null,
    },
  ];

  function handleClickMode(mode: SecurityMode): void {
    setError(null);
    setSuccess(null);
    if (mode === currentMode) {
      setSelected(null);
      return;
    }
    const target = options.find((o) => o.id === mode);
    if (target?.unmetRequirement) {
      setError(target.unmetRequirement);
      setSelected(null);
      return;
    }
    setSelected(mode);
    setPassword('');
  }

  async function handleConfirm(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (selected === null) return;
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await session.changeSecurityMode(selected, password);
      setSuccess(`Mode mis à jour : ${labelFor(selected)}.`);
      setSelected(null);
      setPassword('');
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 401) {
          setError('Mot de passe incorrect.');
        } else if (err.status === 400 && err.error === 'totp_required') {
          setError('Active TOTP avant de choisir ce mode.');
        } else if (err.status === 400 && err.error === 'passkey_required') {
          setError('Enrôle une passkey PRF avant de choisir ce mode.');
        } else {
          setError('Erreur lors du changement de mode.');
          if (import.meta.env.DEV) console.warn('security-mode change failed', err);
        }
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Erreur lors du changement de mode.');
        if (import.meta.env.DEV) console.warn('security-mode change failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline="Combien de facteurs à chaque login."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mode de sécurité gouverne ce que tu dois fournir à chaque
            connexion : mot de passe seul, mot de passe + TOTP, ou les trois
            facteurs (mot de passe + passkey + TOTP).
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Plus tu montes en exigence, plus tu protèges l’accès — au prix
            d’une étape supplémentaire au login. Tes données sont déjà chiffrées
            côté client : le mode ne change pas la crypto, juste les preuves
            demandées au serveur.
          </p>
        </>
      }
    >
      <AuthPanelHeader
            eyebrow="Sécurité"
            title="Mode de sécurité"
            subtitle={
              <>
                Choisis combien de facteurs sont requis à chaque connexion. Un
                changement nécessite ton mot de passe.
              </>
            }
          />

          <div className="mb-3 grid gap-2">
            {options.map((opt) => {
              const isCurrent = opt.id === currentMode;
              const isSelected = opt.id === selected;
              const isLocked = opt.unmetRequirement !== null && !isCurrent;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleClickMode(opt.id)}
                  disabled={isLocked}
                  aria-pressed={isCurrent}
                  className={cn(
                    'group flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors',
                    isCurrent
                      ? 'border-accent bg-accent/5'
                      : isSelected
                        ? 'border-ink-soft bg-bg-2'
                        : 'border-hair bg-bg hover:bg-bg-2',
                    isLocked && 'cursor-not-allowed opacity-60 hover:bg-bg',
                  )}
                >
                  <div className="mb-1 flex w-full items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-ink">
                      {opt.label}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-sm bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
                        Actif
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12px] leading-[1.45] text-ink-soft">
                    {opt.description}
                  </p>
                  {opt.unmetRequirement && !isCurrent ? (
                    <p className="mt-1.5 text-[11.5px] text-amber-700 dark:text-amber-200">
                      {opt.unmetRequirement}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selected !== null ? (
            <form onSubmit={handleConfirm} noValidate className="mt-3">
              <p className="mb-2 text-[12.5px] text-ink-soft">
                Confirme avec ton mot de passe pour passer en mode{' '}
                <strong className="font-semibold text-ink">{labelFor(selected)}</strong>.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Mot de passe actuel"
                autoFocus
                className="mb-2 w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting || !password}
                  className="flex-1"
                >
                  {submitting ? '…' : 'Confirmer'}
                </Button>
                <Button
                  type="button"
                  variant="neutral"
                  size="md"
                  onClick={() => {
                    setSelected(null);
                    setPassword('');
                    setError(null);
                  }}
                  disabled={submitting}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              role="status"
              className="mt-3 border-l-2 border-accent bg-accent/5 px-3 py-2 text-[12.5px] text-accent-deep"
            >
              {success}
            </div>
          ) : null}

          <div className="mt-4.5 text-center text-[12.5px] text-muted">
            <Link
              to="/flow/account"
              className="cursor-pointer transition-colors hover:text-ink"
            >
              ← Retour
            </Link>
          </div>
    </AuthLayout>
  );
}

function labelFor(mode: SecurityMode): string {
  if (mode === 'password_or_passkey') return 'Standard';
  if (mode === 'always_totp') return 'TOTP requis';
  return 'Maximum';
}
