import { useState } from 'react';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { AdminInviteRow } from '@/core/api/client';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';

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
  const { t } = useI18n();
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
    <div className="divide-y divide-hair">
      <section className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          {t('admin.invites.openRegistration.heading')}
        </h3>
        <div className="grid grid-cols-1 items-center gap-y-3 lg:grid-cols-[200px_1fr] lg:gap-x-6">
          <OpenRegistrationToggle
            checked={openRegistration}
            busy={toggleBusy}
            onChange={onToggleOpenRegistration}
          />
          <p className="text-[12px] leading-[1.55] text-muted">
            {t('admin.invites.openRegistration.description')}
          </p>
        </div>
      </section>

      <section className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          {t('admin.invites.emailToInvite.heading')}
        </h3>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-center gap-y-3 lg:grid-cols-[200px_1fr] lg:gap-x-6"
        >
          <Button type="submit" size="sm" disabled={!looksValidEmail}>
            {t('admin.invites.emailToInvite.submit')}
          </Button>
          <DirkInput
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('admin.invites.emailToInvite.placeholder')}
            aria-label={t('admin.invites.emailToInvite.inputAria')}
            className="max-w-[320px]"
          />
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
      </section>

      <section className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          {t('admin.invites.pending.heading')}
        </h3>
        {pendingInvites.length === 0 ? (
          <p className="text-[12px] italic text-muted">
            {t('admin.invites.pending.empty')}
          </p>
        ) : (
          /* Real <table> rather than a CSS-grid fake — `table-auto`
             sizes each col to its widest cell while keeping every row
             aligned exactly the same, which the grid version couldn't
             guarantee once the headers had `tracking` + `uppercase`. */
          <table className="w-auto border-collapse">
            <thead>
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">
                <th className="min-w-[220px] border-b border-hair px-4 pb-1.5 font-semibold" />
                <th className="min-w-[200px] border-b border-hair px-4 pb-1.5 font-semibold">
                  {t('admin.invites.pending.columns.sent')}
                </th>
                <th className="min-w-[200px] border-b border-hair px-4 pb-1.5 font-semibold">
                  {t('admin.invites.pending.columns.expires')}
                </th>
                <th className="border-b border-hair px-4 pb-1.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((i, idx) => {
                const busy = busyInviteId === i.id;
                const isLast = idx === pendingInvites.length - 1;
                const tdCls = cn(
                  'py-2 px-4 text-[12px] text-muted align-middle',
                  !isLast && 'border-b border-hair',
                );
                return (
                  <tr key={i.id}>
                    <td className={cn(tdCls, 'font-medium text-ink')}>
                      {i.email}
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>
                      {new Date(i.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>
                      {i.expiresAt
                        ? new Date(i.expiresAt).toLocaleString('fr-FR')
                        : ''}
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          iconOnly
                          onClick={() => onResendInvite(i.id)}
                          disabled={busy}
                          aria-label={t('admin.invites.pending.resendAria')}
                          title={t('admin.invites.pending.resendAria')}
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="xs"
                          iconOnly
                          onClick={() => onRevokeInvite(i.id)}
                          disabled={busy}
                          aria-label={t('admin.invites.pending.revokeAria')}
                          title={t('admin.invites.pending.revokeAria')}
                        >
                          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
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
 *
 * The title and descriptor live in the parent section now (Account-
 * style sections, see {@link InviteManager}); this component is just
 * the toggle pill itself.
 */
function OpenRegistrationToggle({
  checked,
  busy,
  onChange,
}: OpenRegistrationToggleProps) {
  const { t } = useI18n();
  const id = 'admin-open-registration-toggle';
  return (
    <label
      htmlFor={id}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center"
    >
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
        aria-label={t('admin.invites.openRegistration.toggleAria')}
        className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden disabled:cursor-not-allowed"
        checked={checked}
        disabled={busy}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
