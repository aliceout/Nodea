import { useState } from 'react';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { AdminInviteRow } from '@/core/api/client';
import { cn } from '@/lib/utils';

/**
 * Email-bound invite manager (Auth-Roadmap Phase 1, post-rework v2).
 *
 * Replaces the old "mint a clear code, copy/paste it" UI. Admin enters
 * an email; the server generates a token, hashes it, emails the link
 * directly to the recipient. The clear token never appears in the admin
 * UI — there is nothing to copy. Each pending invite carries Resend
 * (re-issue + re-email) and Revoke (delete) actions.
 */

export interface InviteManagerProps {
  pendingInvites: AdminInviteRow[];
  /** Pending state of the per-row Resend / Revoke buttons. Keyed by
   *  invite id so multiple rows can mutate independently without a
   *  global "busy" flag. */
  busyInviteId: string | null;
  feedback: { kind: 'ok' | 'error'; message: string } | null;
  /** Open / Closed registration setting + setter. The toggle lives in
   *  this panel for now — admins coming to manage invites also tend
   *  to think about access policy at the same time. */
  openRegistration: boolean;
  toggleBusy: boolean;
  onToggleOpenRegistration(next: boolean): void;
  onSendInvite(email: string): void;
  onResendInvite(id: string): void;
  onRevokeInvite(id: string): void;
}

export default function InviteManager({
  pendingInvites,
  busyInviteId,
  feedback,
  openRegistration,
  toggleBusy,
  onToggleOpenRegistration,
  onSendInvite,
  onResendInvite,
  onRevokeInvite,
}: InviteManagerProps) {
  const [email, setEmail] = useState('');
  const trimmed = email.trim();
  const looksValidEmail = /\S+@\S+\.\S+/.test(trimmed);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksValidEmail) return;
    onSendInvite(trimmed);
    setEmail('');
  }

  return (
    <div>
      <OpenRegistrationToggle
        checked={openRegistration}
        busy={toggleBusy}
        onChange={onToggleOpenRegistration}
      />

      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-end gap-3">
        <div className="grow basis-[280px]">
          <label
            htmlFor="invite-email"
            className="mb-[5px] block text-[12px] font-medium text-muted"
          >
            E-mail à inviter
          </label>
          <input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ami@example.com"
            className="w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]"
          />
        </div>
        <button
          type="submit"
          disabled={!looksValidEmail}
          className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          Envoyer l'invitation
        </button>
      </form>

      {feedback ? (
        <p
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
          className={cn(
            'mt-3 text-[12px]',
            feedback.kind === 'ok' ? 'text-accent-deep' : 'text-danger',
          )}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-7">
        <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
          Invitations en attente
        </h3>
        {pendingInvites.length === 0 ? (
          <p className="text-[12px] italic text-muted">
            Aucune invitation en attente.
          </p>
        ) : (
          <ul className="flex flex-col">
            {pendingInvites.map((i) => {
              const busy = busyInviteId === i.id;
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hair py-2 last:border-b-0 text-[12px] text-muted"
                >
                  <span className="font-medium text-ink">{i.email}</span>
                  <span>· envoyée {new Date(i.createdAt).toLocaleString('fr-FR')}</span>
                  {i.expiresAt ? (
                    <span>· expire {new Date(i.expiresAt).toLocaleString('fr-FR')}</span>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onResendInvite(i.id)}
                      disabled={busy}
                      aria-label="Renvoyer l'invitation"
                      title="Renvoyer l'invitation"
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRevokeInvite(i.id)}
                      disabled={busy}
                      aria-label="Révoquer cette invitation"
                      title="Révoquer cette invitation"
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface OpenRegistrationToggleProps {
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Toggle that flips `app_settings.open_registration` server-side.
 * When ON, anyone can register without an invite (free signup with
 * activation email). When OFF (default), registration requires an
 * invite link issued by an admin.
 */
function OpenRegistrationToggle({
  checked,
  busy,
  onChange,
}: OpenRegistrationToggleProps) {
  const id = 'admin-open-registration-toggle';
  const description =
    'Quand actif, n\'importe qui peut créer un compte sans invitation (parcours d\'activation par e-mail). Sinon (par défaut), l\'inscription exige un lien envoyé par un·e admin.';
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
            busy && 'opacity-60',
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
          aria-label="Autoriser les inscriptions ouvertes (sans invitation)"
          className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden disabled:cursor-not-allowed"
          checked={checked}
          disabled={busy}
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
          Inscription ouverte (sans invitation)
        </p>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-muted">{description}</p>
      </div>
    </label>
  );
}
