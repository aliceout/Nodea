import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useAlert } from '@/ui/dirk/confirm/confirm-context';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import {
  apiAdminListUsers,
  apiAdminDeleteUser,
  apiAdminListInvites,
  apiAdminSendInvite,
  apiAdminResendInvite,
  apiAdminDeleteInvite,
  apiAdminGetSettings,
  apiAdminPatchSettings,
  isApiError,
  type AdminUserRow,
  type AdminInviteRow,
} from '@/core/api/client';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';
import Tabs from '@/ui/dirk/Tabs';
import Topbar from '@/ui/dirk/Topbar';
import UserTable from './components/UserTable';
import InviteManager from './components/InviteCode';
import AnnouncementsManager from './components/AnnouncementsManager';
import SourcesPanel from './components/SourcesPanel';

/**
 * Admin — Direction K · Sauge.
 *
 * Sticky topbar like Mood / Account / Journal, single column at
 * 880px, four tabs: Utilisateur·ice·s · Invitations · Annonces ·
 * Sources. Same tab interaction model as Account: keyed
 * `animate-fade-up` so each switch replays the entrance.
 *
 * The Invitations tab combines the email-based invite manager
 * (Bitwarden-style send + resend + revoke) with the
 * `open_registration` toggle that flips between the closed
 * (invite-only) and open (free signup with activation email) modes.
 */

type Tab = 'users' | 'invites' | 'announcements' | 'sources';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'users', label: 'Utilisateur·ice·s' },
  { id: 'invites', label: 'Invitations' },
  { id: 'announcements', label: 'Annonces' },
  { id: 'sources', label: 'Sources' },
];

type Feedback = { kind: 'ok' | 'error'; message: string };

export default function AdminPage() {
  const { t } = useI18n();
  const alert = useAlert();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const currentUser = useNodeaStore(selectUser);

  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [openRegistration, setOpenRegistration] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [u, i, s] = await Promise.all([
          apiAdminListUsers(),
          apiAdminListInvites(),
          apiAdminGetSettings(),
        ]);
        if (!cancelled) {
          setUsers(u);
          setInvites(i);
          setOpenRegistration(s.open_registration);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleDeleteUser(id: string): Promise<void> {
    try {
      await apiAdminDeleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      await alert({
        message: 'Erreur suppression : ' + (err instanceof Error ? err.message : ''),
      });
    }
  }

  function showInviteFeedback(feedback: Feedback): void {
    setInviteFeedback(feedback);
    window.setTimeout(() => setInviteFeedback(null), 4000);
  }

  async function handleSendInvite(email: string): Promise<void> {
    try {
      const created = await apiAdminSendInvite(email);
      setInvites((prev) => [
        {
          id: created.id,
          email: created.email,
          createdBy: currentUser?.id ?? null,
          createdAt: new Date().toISOString(),
          expiresAt: created.expiresAt,
        },
        ...prev,
      ]);
      showInviteFeedback({ kind: 'ok', message: `Invitation envoyée à ${created.email}.` });
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        showInviteFeedback({
          kind: 'error',
          message: `${email} a déjà un compte.`,
        });
      } else if (isApiError(err) && err.error === 'email_send_failed') {
        showInviteFeedback({
          kind: 'error',
          message: "L'envoi de l'e-mail a échoué — vérifie la config SMTP.",
        });
      } else {
        showInviteFeedback({ kind: 'error', message: "Échec de l'invitation." });
      }
    }
  }

  async function handleResendInvite(id: string): Promise<void> {
    setBusyInviteId(id);
    try {
      const refreshed = await apiAdminResendInvite(id);
      // The server re-mints with a fresh id (old row deleted, new
      // one inserted) — replace the row in place.
      setInvites((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                id: refreshed.id,
                email: refreshed.email,
                createdBy: currentUser?.id ?? null,
                createdAt: new Date().toISOString(),
                expiresAt: refreshed.expiresAt,
              }
            : i,
        ),
      );
      showInviteFeedback({
        kind: 'ok',
        message: `Lien renvoyé à ${refreshed.email}.`,
      });
    } catch {
      showInviteFeedback({ kind: 'error', message: "Échec du renvoi." });
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRevokeInvite(id: string): Promise<void> {
    setBusyInviteId(id);
    try {
      await apiAdminDeleteInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      showInviteFeedback({ kind: 'ok', message: 'Invitation révoquée.' });
    } catch {
      showInviteFeedback({ kind: 'error', message: "Échec de la révocation." });
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleToggleOpenRegistration(next: boolean): Promise<void> {
    setToggleBusy(true);
    try {
      const updated = await apiAdminPatchSettings({ open_registration: next });
      setOpenRegistration(updated.open_registration);
    } catch {
      // Revert UI on failure so the toggle reflects server state.
      showInviteFeedback({ kind: 'error', message: 'Échec de la mise à jour.' });
    } finally {
      setToggleBusy(false);
    }
  }

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar label="Paramètres · Administration" onOpenMenu={() => setMobileMenuOpen(true)} />

      <div className="flex flex-col gap-[18px] border-b border-hair px-6 pb-2 pt-6 sm:px-9">
        <PageHeading className="m-0">Administration</PageHeading>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div key={tab} className="animate-fade-up flex-1 overflow-auto px-6 py-7 sm:px-9">
        <div className="max-w-[880px]">
          {!isAdmin ? (
            <InlineAlert>
              {t('admin.sections.restricted', { defaultValue: 'Accès réservé aux admins.' })}
            </InlineAlert>
          ) : loading ? (
            <EmptyHint>
              {t('admin.states.loading', { defaultValue: 'Chargement…' })}
            </EmptyHint>
          ) : error ? (
            <InlineAlert>{error}</InlineAlert>
          ) : tab === 'users' ? (
            <TabIntro
              description={t('admin.sections.users.description', {
                defaultValue: 'Liste et gestion des comptes.',
              })}
            >
              {currentUser ? (
                <UserTable
                  users={users}
                  currentUserId={currentUser.id}
                  onDelete={handleDeleteUser}
                />
              ) : null}
            </TabIntro>
          ) : tab === 'invites' ? (
            <TabIntro
              description={t('admin.sections.invites.description', {
                defaultValue:
                  "Envoyer un lien d'invitation à un·e nouveau·elle utilisateur·ice par e-mail. Le lien arrive directement dans sa boîte ; rien à copier-coller.",
              })}
            >
              <InviteManager
                pendingInvites={invites}
                busyInviteId={busyInviteId}
                feedback={inviteFeedback}
                openRegistration={openRegistration}
                toggleBusy={toggleBusy}
                onToggleOpenRegistration={handleToggleOpenRegistration}
                onSendInvite={handleSendInvite}
                onResendInvite={handleResendInvite}
                onRevokeInvite={handleRevokeInvite}
              />
            </TabIntro>
          ) : tab === 'announcements' ? (
            <TabIntro
              description={t('admin.sections.announcements.description', {
                defaultValue:
                  'Messages publiés sur la page d’accueil. Non chiffrés — visibles par tout le monde.',
              })}
            >
              <AnnouncementsManager />
            </TabIntro>
          ) : (
            <TabIntro
              description={t('admin.sections.sources.description', {
                defaultValue:
                  'Sources de métadonnées externes utilisées par les modules. Vérifie que chaque source répond et que les clés API sont actives.',
              })}
            >
              <SourcesPanel />
            </TabIntro>
          )}
        </div>
      </div>
    </div>
  );
}

function TabIntro({
  description,
  children,
}: {
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="mb-6 text-[13px] leading-[1.55] text-ink-soft">{description}</p>
      {children}
    </>
  );
}
