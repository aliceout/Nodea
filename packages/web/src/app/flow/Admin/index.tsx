import { useEffect, useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import SectionHeader from '@/ui/atoms/typography/SectionHeader.jsx';
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
import UserTable from './components/UserTable';
import InviteCodeManager, { type MintedInvite } from './components/InviteCode';

/**
 * Admin page.
 *
 * Uses the new `/admin/*` endpoints exclusively. Announcements and
 * email-based password reset were PocketBase-specific features and
 * aren't ported — announcements will come back when the back grows a
 * table for them, reset when the api grows SMTP.
 */
export default function AdminPage() {
  const { t } = useI18n();
  const currentUser = useNodeaStore(selectUser);

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
      // Also refresh the server-known list.
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

  if (!isAdmin) {
    return (
      <div className="bg-slate-50 p-8 text-red-500 dark:bg-slate-900 dark:text-red-300">
        {t('admin.sections.restricted', { defaultValue: 'Accès réservé aux admins.' })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-50 py-12 text-center text-gray-500 dark:bg-slate-900 dark:text-slate-400">
        {t('admin.states.loading', { defaultValue: 'Chargement…' })}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 py-12 text-center text-red-500 dark:bg-slate-900 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 transition-colors dark:bg-slate-900">
      <Subheader />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <section>
          <SectionHeader
            title={t('admin.sections.users.title', { defaultValue: 'Utilisateur·ice·s' })}
            description={t('admin.sections.users.description', {
              defaultValue: 'Liste et gestion des comptes.',
            })}
          />
          {currentUser ? (
            <UserTable users={users} currentUserId={currentUser.id} onDelete={handleDeleteUser} />
          ) : null}
        </section>

        <section>
          <SectionHeader
            title={t('admin.sections.invites.title', { defaultValue: "Codes d'invitation" })}
            description={t('admin.sections.invites.description', {
              defaultValue: 'Générer un code à transmettre à un·e nouveau·elle utilisateur·ice.',
            })}
          />
          <InviteCodeManager
            mintedCodes={mintedCodes}
            unusedInvites={invites}
            generating={generating}
            copySuccess={copySuccess}
            onGenerate={handleGenerateInvite}
            onCopy={handleCopy}
            onDelete={handleDeleteInvite}
          />
        </section>
      </div>
    </div>
  );
}
