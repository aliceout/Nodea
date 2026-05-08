import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
} from '@heroicons/react/24/outline';
import type { Base64, CipherIV, EncryptedBlob } from '@nodea/shared/crypto-types';
import type { ActiveSession } from '@nodea/shared';

import {
  apiListActiveSessions,
  apiLogoutAllSessions,
  apiPatchCurrentSessionDeviceLabel,
  apiRevokeSession,
} from '@/core/api/sessions';
import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useSession } from '@/core/auth/use-session';
import { buildSessionDeviceLabelAAD } from '@/core/crypto/factor-wrap';
import {
  decryptMetaString,
  encryptMetaString,
} from '@/core/crypto/session-meta';
import { useNodeaStore, selectMainKey, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { parseDeviceLabel } from '@/lib/device-label';
import Button from '@/ui/atoms/dirk/Button';

import Field from './Field';

/**
 * « Sessions actives » block in Account → Sécurité (issue #47).
 *
 * Reads the user's full sessions, decrypts the encrypted device
 * label client-side (the server never sees the cleartext), shows
 * one row per session with a Révoquer button (disabled on the
 * current row — that's what /logout is for), plus a footer
 * « Se déconnecter partout » button.
 *
 * Privacy invariants :
 * - The server never captures `User-Agent` or IP.
 * - The label is AES-GCM encrypted with the user's AES sub-key,
 *   AAD-bound to `users.id` so an opped server can't migrate
 *   labels between users (auth-tag fails at decrypt).
 * - On first mount after login, if the current session has no
 *   stored label yet (legacy or fresh), the component
 *   opportunistically encrypts `navigator.userAgent` →
 *   « MacBook »/« iPhone »/etc. and PATCHes it. Subsequent loads
 *   just decrypt the stored cipher.
 */
export default function SessionsCard() {
  const { t, tn, language } = useI18n();
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const mainKey = useNodeaStore(selectMainKey);

  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  // Per-row password gate. The DELETE / logout-all routes require
  // a fresh-password re-auth ; if a 401 surfaces we ask for the
  // password inline rather than throwing the user out.
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'revoke'; id: string }
    | { kind: 'logoutAll' }
    | null
  >(null);
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    apiListActiveSessions()
      .then((res) => {
        if (cancelled) return;
        setSessions(res.sessions);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(t('account.security.sessions.errorLoad'));
        if (import.meta.env.DEV) console.warn('sessions load failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  // ---- Decrypt labels as sessions arrive ----
  useEffect(() => {
    if (!sessions || !mainKey || !user) return;
    let cancelled = false;
    const aad = buildSessionDeviceLabelAAD(user.id);
    void Promise.all(
      sessions.map(async (s) => {
        if (!s.deviceLabelCipher || !s.deviceLabelIv) return null;
        try {
          const label = await decryptMetaString(
            {
              cipher: s.deviceLabelCipher as Base64 as EncryptedBlob,
              iv: s.deviceLabelIv as Base64 as CipherIV,
            },
            mainKey.aesKey,
            aad,
          );
          return { id: s.id, label };
        } catch {
          // Corrupt blob, AAD mismatch, or wrong key — surface as
          // "decryption failed" rather than crashing the page.
          return { id: s.id, label: t('account.security.sessions.decryptFailed') };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next = new Map<string, string>();
      for (const r of results) {
        if (r) next.set(r.id, r.label);
      }
      setLabels(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sessions, mainKey, user, t]);

  // ---- Opportunistic PATCH for current session if cipher is null ----
  useEffect(() => {
    if (!sessions || !mainKey || !user) return;
    const current = sessions.find((s) => s.isCurrent);
    if (!current || current.deviceLabelCipher !== null) return;
    let cancelled = false;
    const hint = parseDeviceLabel(navigator.userAgent);
    const aad = buildSessionDeviceLabelAAD(user.id);
    encryptMetaString(hint.label, mainKey.aesKey, aad)
      .then(({ cipher, iv }) =>
        apiPatchCurrentSessionDeviceLabel({ cipher, iv }),
      )
      .then(() => {
        if (cancelled) return;
        // Refresh the view : the local label cache for the current
        // session now points at the just-encrypted hint, and the
        // session row's cipher fields can be marked as set so we
        // don't try to PATCH again on rerender.
        setLabels((prev) => new Map(prev).set(current.id, hint.label));
        setSessions((prev) =>
          prev
            ? prev.map((s) =>
                s.id === current.id
                  ? { ...s, deviceLabelCipher: 'set', deviceLabelIv: 'set' }
                  : s,
              )
            : prev,
        );
      })
      .catch((err: unknown) => {
        // Best-effort : if the PATCH fails, the row will just show
        // « Appareil inconnu » and we'll retry on the next mount.
        if (import.meta.env.DEV) console.warn('device-label PATCH failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [sessions, mainKey, user]);

  function resetActionState(): void {
    setPendingAction(null);
    setPassword('');
    setActionError(null);
    setSubmitting(false);
  }

  async function refreshSessions(): Promise<void> {
    try {
      const res = await apiListActiveSessions();
      setSessions(res.sessions);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('sessions refresh failed', err);
    }
  }

  async function executePendingAction(): Promise<void> {
    if (!pendingAction) return;
    setActionError(null);
    setSubmitting(true);
    try {
      // Stamp a fresh password proof on the current session — the
      // mutating routes both gate behind `requireFreshPassword`.
      await freshenPasswordReauth(password);
      if (pendingAction.kind === 'revoke') {
        await apiRevokeSession(pendingAction.id);
        await refreshSessions();
      } else {
        await apiLogoutAllSessions();
        await session.logout().catch(() => undefined);
        navigate('/login', { replace: true });
        return;
      }
      resetActionState();
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setActionError(t('account.security.sessions.passwordError'));
      } else {
        setActionError(
          pendingAction.kind === 'revoke'
            ? t('account.security.sessions.revokeError')
            : t('account.security.sessions.logoutAllError'),
        );
        if (import.meta.env.DEV) console.warn('session action failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRevoke(id: string): void {
    if (!window.confirm(t('account.security.sessions.revokeConfirm'))) return;
    setPendingAction({ kind: 'revoke', id });
    setPassword('');
    setActionError(null);
  }

  function handleLogoutAll(): void {
    if (!window.confirm(t('account.security.sessions.logoutAllConfirm'))) return;
    setPendingAction({ kind: 'logoutAll' });
    setPassword('');
    setActionError(null);
  }

  // ---- Last-seen formatter (locale-aware) ----
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
      }),
    [language],
  );

  function formatLastSeen(s: ActiveSession): string {
    if (!s.lastSeenAt) return t('account.security.sessions.neverSeen');
    const seen = new Date(s.lastSeenAt).getTime();
    const now = Date.now();
    const seconds = Math.max(0, Math.floor((now - seen) / 1000));
    let when: string;
    if (seconds < 60) {
      when = t('account.security.sessions.lastSeenJustNow');
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      when = tn('account.security.sessions.lastSeenMinutes', minutes);
    } else if (seconds < 86_400) {
      const hours = Math.floor(seconds / 3600);
      when = tn('account.security.sessions.lastSeenHours', hours);
    } else {
      const days = Math.floor(seconds / 86_400);
      when = tn('account.security.sessions.lastSeenDays', days);
    }
    return t('account.security.sessions.lastSeenAt', { values: { when } });
  }

  function deviceIcon(label: string | undefined): React.ReactElement {
    // Heuristic on the decrypted label — we don't carry the kind
    // through the wire to keep the cipher payload short. The
    // strings below match `parseDeviceLabel`'s outputs.
    if (label === 'iPhone' || label?.toLowerCase().includes('téléphone'))
      return <DevicePhoneMobileIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
    if (label === 'iPad' || label?.toLowerCase().includes('tablette'))
      return <DeviceTabletIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
    return <ComputerDesktopIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.security.sessions.title')}
      </h3>
      <p className="mb-4 text-[12px] leading-[1.55] text-muted">
        {t('account.security.sessions.description')}
      </p>

      {loadError ? (
        <p
          role="alert"
          className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {loadError}
        </p>
      ) : null}

      {sessions === null ? (
        <p className="text-[13px] text-muted">
          {t('account.security.sessions.loading')}
        </p>
      ) : (
        <ul className="divide-y divide-hair rounded border border-hair">
          {sessions.map((s) => {
            const label = labels.get(s.id) ?? t('account.security.sessions.unknownDevice');
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                {deviceIcon(label)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-ink">
                      {label}
                    </span>
                    {s.isCurrent ? (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-deep">
                        {t('account.security.sessions.currentBadge')}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-muted">
                    {formatLastSeen(s)} · {t('account.security.sessions.createdAt', {
                      values: { date: dateFormatter.format(new Date(s.createdAt)) },
                    })}
                  </div>
                </div>
                {!s.isCurrent ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(s.id)}
                    aria-label={t('account.security.sessions.revokeAria')}
                  >
                    {t('account.security.sessions.revokeCta')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pendingAction ? (
        <div className="mt-4 rounded border border-hair bg-bg-2 p-3">
          <Field
            label={t('account.security.sessions.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {actionError ? (
            <p role="alert" className="mb-2 text-[12px] text-danger">
              {actionError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={executePendingAction}
              disabled={submitting || password.length === 0}
            >
              {pendingAction.kind === 'revoke'
                ? t('account.security.sessions.revokeCta')
                : t('account.security.sessions.logoutAllCta')}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetActionState}>
              {t('common.actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="danger-ghost" size="sm" onClick={handleLogoutAll}>
            {t('account.security.sessions.logoutAllCta')}
          </Button>
        </div>
      )}
    </section>
  );
}
