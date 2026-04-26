import { useEffect, useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import {
  apiAdminListUsers,
  apiAdminDeleteUser,
  apiAdminListInvites,
  apiAdminCreateInvite,
  apiAdminDeleteInvite,
  type AdminUserRow,
  type AdminInviteRow,
} from '@/core/api/client';
import { cn } from '@/lib/utils';
import UserTable from './components/UserTable';
import InviteCodeManager, { type MintedInvite } from './components/InviteCode';
import AnnouncementsManager from './components/AnnouncementsManager';
import SourcesPanel from './components/SourcesPanel';

/**
 * Admin — Direction K · Sauge.
 *
 * Sticky topbar like Mood / Account / Passages, single column at
 * 880px, three tabs: Utilisateur·ice·s · Codes d'invitation ·
 * Annonces. Same tab interaction model as Account: keyed
 * `animate-fade-up` so each switch replays the entrance.
 */

type Tab = 'users' | 'invites' | 'announcements' | 'sources';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'users', label: 'Utilisateur·ice·s' },
  { id: 'invites', label: "Codes d'invitation" },
  { id: 'announcements', label: 'Annonces' },
  { id: 'sources', label: 'Sources' },
];

export default function AdminPage() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const currentUser = useNodeaStore(selectUser);

  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [mintedCodes, setMintedCodes] = useState<MintedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [u, i] = await Promise.all([apiAdminListUsers(), apiAdminListInvites()]);
        if (!cancelled) {
          setUsers(u);
          setInvites(i);
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
      alert('Erreur suppression : ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function handleGenerateInvite(): Promise<void> {
    setGenerating(true);
    setCopySuccess(null);
    try {
      const res = await apiAdminCreateInvite();
      // Keep the clear code in local state so the admin can copy it
      // before it's gone forever.
      setMintedCodes((prev) => [
        {
          id: res.id,
          code: res.code,
          createdBy: currentUser?.id ?? null,
          createdAt: new Date().toISOString(),
          expiresAt: null,
        },
        ...prev,
      ]);
      setCopySuccess(`Code généré : ${res.code}`);
      const i = await apiAdminListInvites();
      setInvites(i);
    } catch {
      setCopySuccess('Erreur lors de la création du code');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteInvite(id: string): Promise<void> {
    try {
      await apiAdminDeleteInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      setMintedCodes((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert('Erreur suppression code : ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function handleCopy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(`Code copié : ${code}`);
      window.setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      setCopySuccess('Erreur lors de la copie');
    }
  }

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar onOpenMenu={() => setMobileMenuOpen(true)} />

      <div className="flex flex-col gap-[18px] border-b border-hair px-6 pb-2 pt-6 sm:px-9">
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em] text-ink">
          Administration
        </h1>
        <div className="-mx-1 flex flex-wrap gap-1">
          {TABS.map((tt) => {
            const active = tab === tt.id;
            return (
              <button
                key={tt.id}
                type="button"
                onClick={() => setTab(tt.id)}
                data-active={active}
                className={cn(
                  'rounded-md px-3 py-[7px] text-[13px] transition-[background-color,color] duration-200',
                  active
                    ? 'bg-bg-2 font-semibold text-ink'
                    : 'text-muted hover:bg-bg-2 hover:text-ink',
                )}
              >
                {tt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div key={tab} className="animate-fade-up flex-1 overflow-auto px-6 py-7 sm:px-9">
        <div className="max-w-[880px]">
          {!isAdmin ? (
            <p
              role="alert"
              className="border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
            >
              {t('admin.sections.restricted', { defaultValue: 'Accès réservé aux admins.' })}
            </p>
          ) : loading ? (
            <p className="border-b border-hair py-6 text-[13px] italic text-muted">
              {t('admin.states.loading', { defaultValue: 'Chargement…' })}
            </p>
          ) : error ? (
            <p
              role="alert"
              className="border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
            >
              {error}
            </p>
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
                  'Générer un code à transmettre à un·e nouveau·elle utilisateur·ice.',
              })}
            >
              <InviteCodeManager
                mintedCodes={mintedCodes}
                unusedInvites={invites}
                generating={generating}
                copySuccess={copySuccess}
                onGenerate={handleGenerateInvite}
                onCopy={handleCopy}
                onDelete={handleDeleteInvite}
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

interface TopbarProps {
  onOpenMenu: () => void;
}

function Topbar({ onOpenMenu }: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-hair bg-bg px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] tracking-[0.02em] text-muted">Administration</span>
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
      <p className="mb-[18px] text-[13px] leading-[1.55] text-muted">{description}</p>
      {children}
    </>
  );
}
