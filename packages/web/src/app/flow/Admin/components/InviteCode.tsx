import { useState } from 'react';
import { ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { AdminInviteRow } from '@/core/api/client';
import { cn } from '@/lib/utils';

/** A minted invite kept in component state after creation; the `code`
 *  field is only known client-side at mint time (the server only stores
 *  the hash). */
export interface MintedInvite extends AdminInviteRow {
  code: string;
}

export interface InviteCodeManagerProps {
  /** Fresh codes minted during this session (clear code still visible). */
  mintedCodes: MintedInvite[];
  /** Server-known invites (no clear code, only metadata). */
  unusedInvites: AdminInviteRow[];
  generating: boolean;
  copySuccess: string | null;
  onGenerate(): void;
  onCopy(code: string): void;
  onDelete(id: string): void;
}

/**
 * Invite code manager — Direction K · Sauge.
 *
 * Generate button on top, two stacked sub-blocks below:
 * - Codes minted during this session (with their clear value still
 *   visible; gone forever on refresh — the server only stores the
 *   hash). Each row offers Copy + Delete.
 * - Server-known unused invites (metadata only — id prefix +
 *   created/expires timestamps). Each row offers Delete.
 */
export default function InviteCodeManager({
  mintedCodes,
  unusedInvites,
  generating,
  copySuccess,
  onGenerate,
  onCopy,
  onDelete,
}: InviteCodeManagerProps) {
  // UI-only for now — the wiring (server-side `app_settings`,
  // /admin/settings endpoint pair, /auth/register flag check, etc.)
  // is tracked in https://github.com/aliceout/Nodea/issues/31.
  const [openRegistration, setOpenRegistration] = useState(false);

  return (
    <div>
      <OpenRegistrationToggle
        checked={openRegistration}
        onChange={setOpenRegistration}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? 'Génération…' : 'Générer un code'}
        </button>
        {copySuccess ? (
          <span
            role="status"
            className={cn(
              'text-[12px]',
              copySuccess.startsWith('Erreur') ? 'text-danger' : 'text-accent-deep',
            )}
          >
            {copySuccess}
          </span>
        ) : null}
      </div>

      {mintedCodes.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
            Cette session
          </h3>
          <p className="mb-3 text-[12px] leading-[1.55] text-muted">
            Copie maintenant — ces valeurs disparaissent au rafraîchissement (le serveur ne stocke
            que le hash).
          </p>
          <ul className="flex flex-wrap gap-2">
            {mintedCodes.map((c) => (
              <li
                key={c.id}
                className="inline-flex items-center gap-2 rounded-md border border-hair bg-bg-2 px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onCopy(c.code)}
                  aria-label="Copier le code"
                  title="Copier le code"
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="font-mono text-[12.5px] text-ink">{c.code}</span>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  aria-label="Supprimer ce code"
                  title="Supprimer ce code"
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unusedInvites.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
            En attente côté serveur
          </h3>
          <ul className="flex flex-col">
            {unusedInvites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hair py-2 last:border-b-0 text-[12px] text-muted"
              >
                <span className="font-mono text-ink-soft">{i.id.slice(0, 8)}…</span>
                <span>créée {new Date(i.createdAt).toLocaleString('fr-FR')}</span>
                {i.expiresAt ? (
                  <span>· expire {new Date(i.expiresAt).toLocaleString('fr-FR')}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(i.id)}
                  aria-label="Supprimer cette invitation"
                  title="Supprimer cette invitation"
                  className="ml-auto inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface OpenRegistrationToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Switch deciding whether `/auth/register` accepts requests with no
 * `inviteCode`. UI-only — the server-side flag, settings endpoints
 * and register branch live in
 * https://github.com/aliceout/Nodea/issues/31.
 */
function OpenRegistrationToggle({ checked, onChange }: OpenRegistrationToggleProps) {
  const id = 'admin-open-registration-toggle';
  const description =
    'Quand actif, n’importe qui peut créer un compte sans code d’invitation. Sinon (par défaut), l’inscription exige un code généré ci-dessous.';
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-4 border-b border-hair pb-4"
    >
      <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full transition-colors duration-150 ease-out',
            checked ? 'bg-accent' : 'bg-hair',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-hair bg-bg transition-transform duration-150 ease-out',
            checked && 'translate-x-5',
          )}
        />
        <input
          id={id}
          type="checkbox"
          aria-label="Autoriser les inscriptions sans code d’invitation"
          className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[13.5px] font-medium transition-colors',
            checked ? 'text-ink' : 'text-ink-soft',
          )}
        >
          Autoriser les inscriptions sans code d’invitation
        </p>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-muted">{description}</p>
      </div>
    </label>
  );
}
