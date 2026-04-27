import { type ChangeEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';

import {
  apiChangeEmail,
  apiChangeUsername,
  apiDeleteMe,
  apiMe,
  isApiError,
} from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import { getDataPlugin, knownModules } from '@/core/utils/ImportExport/registry.data.js';
import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import ModulesManager from '@/app/flow/Settings/components/ModulesManager';

/**
 * Mon compte — Direction K · Sauge.
 *
 * Pixel-precise port of `K_Account` from the design handoff: per-page
 * topbar ("Paramètres · Mon compte"), H1 + 4 tab buttons, then a
 * tab content panel that re-mounts on each switch (keyed on the tab
 * id) so the `animate-fade-up` keyframe replays.
 *
 * The four tabs are inlined in this file because each is short and
 * lives on its own; extracting them into separate files would just
 * add navigation overhead with no reuse.
 */
type Tab = 'identity' | 'security' | 'preferences' | 'modules' | 'data' | 'danger';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'identity', label: 'Identité' },
  { id: 'security', label: 'Sécurité' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'modules', label: 'Modules' },
  { id: 'data', label: 'Données' },
  { id: 'danger', label: 'Suppression du compte' },
];

export default function AccountPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const [tab, setTab] = useState<Tab>('identity');

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar onOpenMenu={() => setMobileMenuOpen(true)} />

      <div className="flex flex-col gap-[18px] border-b border-hair px-6 pb-2 pt-6 sm:px-9">
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em] text-ink">Mon compte</h1>
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
        {tab === 'identity' ? <IdentityTab /> : null}
        {tab === 'security' ? <SecurityTab /> : null}
        {tab === 'preferences' ? <PreferencesTab /> : null}
        {tab === 'modules' ? <ModulesTab /> : null}
        {tab === 'data' ? <DataTab /> : null}
        {tab === 'danger' ? <DangerTab /> : null}
      </div>
    </div>
  );
}

interface TopbarProps {
  onOpenMenu: () => void;
}

function Topbar({ onOpenMenu }: TopbarProps) {
  return (
    <div className="flex h-[52px] items-center justify-between border-b border-hair px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] text-muted">Paramètres · Mon compte</span>
      </div>
    </div>
  );
}

/* ---------- Identity tab -------------------------------------------------- */

interface FeedbackState {
  tone: 'success' | 'error';
  text: string;
}

function IdentityTab() {
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);

  // Each field has its own edit lifecycle (draft, submitting, feedback)
  // so saving the e-mail doesn't reset a username draft and vice versa.
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? '');
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<FeedbackState | null>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<FeedbackState | null>(null);

  function startEditUsername(): void {
    setUsernameDraft(user?.username ?? '');
    setUsernameFeedback(null);
    setEditingUsername(true);
  }
  function cancelEditUsername(): void {
    setUsernameDraft(user?.username ?? '');
    setUsernameFeedback(null);
    setEditingUsername(false);
  }
  async function saveUsername(): Promise<void> {
    setUsernameSubmitting(true);
    setUsernameFeedback(null);
    try {
      const trimmed = usernameDraft.trim();
      const next = trimmed.length === 0 ? null : trimmed;
      const current = user?.username ?? null;
      if (next === current) {
        setEditingUsername(false);
        return;
      }
      await apiChangeUsername({ username: next });
      const me = await apiMe();
      if (me) setAuth(me);
      setUsernameFeedback({ tone: 'success', text: 'Identifiant mis à jour.' });
      setEditingUsername(false);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setUsernameFeedback({ tone: 'error', text: 'Cet identifiant est déjà pris.' });
      } else if (isApiError(err) && err.status === 400) {
        setUsernameFeedback({ tone: 'error', text: 'Format invalide.' });
      } else {
        setUsernameFeedback({ tone: 'error', text: 'Erreur lors de la modification.' });
        if (import.meta.env.DEV) console.warn('account-username failed', err);
      }
    } finally {
      setUsernameSubmitting(false);
    }
  }

  function startEditEmail(): void {
    setEmailDraft(user?.email ?? '');
    setEmailPassword('');
    setEmailFeedback(null);
    setEditingEmail(true);
  }
  function cancelEditEmail(): void {
    setEmailDraft(user?.email ?? '');
    setEmailPassword('');
    setEmailFeedback(null);
    setEditingEmail(false);
  }
  async function saveEmail(): Promise<void> {
    setEmailSubmitting(true);
    setEmailFeedback(null);
    try {
      const next = emailDraft.trim();
      if (next === (user?.email ?? '')) {
        setEditingEmail(false);
        return;
      }
      if (!emailPassword) {
        setEmailFeedback({
          tone: 'error',
          text: 'Mot de passe actuel requis pour changer l’e-mail.',
        });
        setEmailSubmitting(false);
        return;
      }
      await apiChangeEmail({ currentPassword: emailPassword, newEmail: next });
      const me = await apiMe();
      if (me) setAuth(me);
      setEmailPassword('');
      setEmailFeedback({ tone: 'success', text: 'Adresse e-mail mise à jour.' });
      setEditingEmail(false);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setEmailFeedback({ tone: 'error', text: 'Mot de passe actuel incorrect.' });
      } else if (isApiError(err) && err.status === 409) {
        setEmailFeedback({ tone: 'error', text: 'Cette adresse est déjà utilisée.' });
      } else if (isApiError(err) && err.status === 400) {
        setEmailFeedback({ tone: 'error', text: 'Format invalide.' });
      } else {
        setEmailFeedback({ tone: 'error', text: 'Erreur lors de la modification.' });
        if (import.meta.env.DEV) console.warn('account-email failed', err);
      }
    } finally {
      setEmailSubmitting(false);
    }
  }

  return (
    <div className="grid max-w-[880px] grid-cols-1 gap-14 lg:grid-cols-[1fr_240px]">
      <div>
        <p className="mb-[18px] text-[13px] leading-[1.5] text-muted">
          Les seules infos qui te suivent d’un appareil à l’autre.
        </p>

        <IdentityRow
          label="Nom d’affichage"
          value={user?.username ?? ''}
          placeholder="non défini"
          editing={editingUsername}
          editLabel="Modifier le nom d’utilisateur·ice"
          submitting={usernameSubmitting}
          feedback={usernameFeedback}
          onEdit={startEditUsername}
          onCancel={cancelEditUsername}
          onSave={saveUsername}
        >
          <input
            type="text"
            value={usernameDraft}
            onChange={(e) => setUsernameDraft(e.target.value)}
            autoFocus
            className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
        </IdentityRow>

        <IdentityRow
          label="Adresse e-mail"
          value={user?.email ?? ''}
          placeholder=""
          editing={editingEmail}
          editLabel="Modifier l’adresse e-mail"
          submitting={emailSubmitting}
          feedback={emailFeedback}
          onEdit={startEditEmail}
          onCancel={cancelEditEmail}
          onSave={saveEmail}
        >
          <div className="space-y-2.5">
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              autoComplete="email"
              autoFocus
              className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
              className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>
        </IdentityRow>
      </div>

      <Stats />
    </div>
  );
}

interface IdentityRowProps {
  label: string;
  value: string;
  /** Shown when `value` is empty in display mode. */
  placeholder: string;
  editing: boolean;
  editLabel: string;
  submitting: boolean;
  feedback: FeedbackState | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

/**
 * Read-by-default row with a single "Modifier …" affordance that
 * swaps the value for the row's input(s) and surfaces save / cancel
 * buttons. Each row owns its own edit lifecycle so saving one field
 * doesn't churn the other.
 */
function IdentityRow({
  label,
  value,
  placeholder,
  editing,
  editLabel,
  submitting,
  feedback,
  onEdit,
  onCancel,
  onSave,
  children,
}: IdentityRowProps) {
  return (
    <div className="border-b border-hair py-4 last:border-b-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
          {label}
        </span>
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer text-[12px] text-accent transition-colors hover:text-accent-deep"
          >
            {editLabel}
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="text-[14px] text-ink">
          {value ? (
            value
          ) : (
            <span className="italic text-muted">{placeholder || '—'}</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">{children}</div>
          <div className="flex shrink-0 gap-2">
            <PrimaryButton onClick={onSave} disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <CancelButton onClick={onCancel} disabled={submitting}>
              Abandonner
            </CancelButton>
          </div>
        </div>
      )}

      {feedback ? <Feedback tone={feedback.tone}>{feedback.text}</Feedback> : null}
    </div>
  );
}

function Stats() {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
        En chiffres
      </div>
      <StatRow label="Entrées chiffrées" value="428" mono />
      <StatRow label="Série habits" value="12 j" mono accent />
      <StatRow label="Membre depuis" value="mars 2024" />
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}

function StatRow({ label, value, mono, accent }: StatRowProps) {
  return (
    <div className="flex items-center justify-between border-t border-hair py-2.5">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span
        className={cn(
          'text-[13px] font-semibold',
          mono ? 'tabular-nums' : '',
          accent ? 'animate-streak-pulse text-accent' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- Security tab -------------------------------------------------- */

function SecurityTab() {
  const navigate = useNavigate();

  return (
    <div className="max-w-[880px]">
      <SecuritySection
        title="Mot de passe"
        description="Re-dérive ta clé sur une page dédiée — la clé maîtresse est ré-enveloppée localement avant d’atteindre le serveur, sans perte de tes entrées chiffrées. L’admin ne la voit jamais."
      >
        <PrimaryButton onClick={() => navigate('/change-password')}>
          Renouveler la clé
        </PrimaryButton>
      </SecuritySection>

      <SecuritySection
        title="2FA"
        description="Un code à six chiffres à chaque connexion, généré par une appli d’authentification (Bitwarden, Ente Auth, Google Authenticator) en plus du mot de passe — une fuite ne suffit alors plus à entrer."
      >
        <SecondaryButton>Activer</SecondaryButton>
      </SecuritySection>

      <section>
        <h3 className="mb-3 text-[16px] font-semibold text-ink">Sessions actives · 2</h3>
        <SessionRow label="MacBook Pro · Paris" meta="maintenant" current />
        <SessionRow label="iPhone 14 · Paris" meta="il y a 1 j" />
      </section>
    </div>
  );
}

interface SecuritySectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Security row — heading on top, then a 2-column body: action
 * button on the left, single 12px descriptor on the right. The
 * left column has a fixed width (`170px`) shared across every
 * section so the descriptors line up on the same vertical line
 * regardless of each button's natural width — descriptor
 * alignment shouldn't jiggle from "Activer" to "Renouveler la
 * clé". Below `lg`, columns stack (button first, descriptor
 * under it).
 */
function SecuritySection({ title, description, children }: SecuritySectionProps) {
  return (
    <section className="mb-[34px] last:mb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{title}</h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[170px_1fr] lg:gap-x-6">
        <div>{children}</div>
        <p className="text-[12px] leading-[1.55] text-muted">{description}</p>
      </div>
    </section>
  );
}

interface SessionRowProps {
  label: string;
  meta: string;
  current?: boolean;
}

function SessionRow({ label, meta, current }: SessionRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-hair py-2.5">
      <div>
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="text-[11px] text-muted">{meta}</div>
      </div>
      {current ? (
        <span className="rounded-full bg-accent-soft px-[9px] py-[3px] text-[11px] font-semibold text-accent-deep">
          Actuelle
        </span>
      ) : (
        <button type="button" className="text-[12px] text-muted transition-colors hover:text-ink">
          Déconnecter
        </button>
      )}
    </div>
  );
}

/* ---------- Preferences tab ----------------------------------------------- */

const THEME_OPTIONS: ReadonlyArray<ThemePreference> = ['light', 'system', 'dark'];

function PreferencesTab() {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const { theme, setTheme } = useTheme();

  function handleLanguage(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
  }

  function handleTheme(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value as ThemePreference;
    if (!THEME_OPTIONS.includes(next) || next === theme) return;
    setTheme(next);
  }

  return (
    <div className="grid max-w-[880px] grid-cols-1 gap-14 lg:grid-cols-2">
      <div>
        <h3 className="mb-1 text-[16px] font-semibold text-ink">Thème</h3>
        <p className="mb-[18px] text-[13px] leading-[1.55] text-muted">
          Clair, sombre, ou suit ton système.
        </p>
        <select
          aria-label={t('settings.theme.ariaLabel', { defaultValue: 'Préférence de thème' })}
          value={theme}
          onChange={handleTheme}
          className="block h-8 w-full max-w-[280px] cursor-pointer rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
        >
          {THEME_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {t(`settings.theme.options.${id}`, { defaultValue: id })}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="mb-1 text-[16px] font-semibold text-ink">Langue</h3>
        <p className="mb-[18px] text-[13px] leading-[1.55] text-muted">
          Interface en français ou en anglais.
        </p>
        <select
          aria-label="Langue"
          value={language}
          onChange={handleLanguage}
          className="block h-8 w-full max-w-[280px] cursor-pointer rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ---------- Modules tab --------------------------------------------------- */

function ModulesTab() {
  return (
    <div className="max-w-[880px]">
      <h3 className="mb-1 text-[16px] font-semibold text-ink">Modules actifs</h3>
      <p className="mb-[18px] text-[13px] leading-[1.55] text-muted">
        Tous les modules sont activés par défaut. Désactive ceux que tu
        n’utilises pas — ils disparaîtront de la barre latérale et leurs
        données seront laissées intactes (rien n’est supprimé).
      </p>
      <ModulesManager />
    </div>
  );
}

/* ---------- Data tab ------------------------------------------------------ */

function DataTab() {
  return (
    <div className="grid max-w-[880px] grid-cols-1 gap-9 lg:grid-cols-2">
      <ExportPanel />
      <ImportPanel />
    </div>
  );
}

function ExportPanel() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExport(): Promise<void> {
    setSuccess('');
    setError('');
    setLoading(true);
    try {
      if (!mainKey) throw new Error('Clé de chiffrement absente');
      const out: Record<string, unknown[]> = {};
      for (const moduleKey of knownModules()) {
        try {
          const plugin = await getDataPlugin(moduleKey);
          const runtimeKey = plugin.meta?.runtimeKey ?? moduleKey;
          const sid = modules?.[runtimeKey]?.moduleUserId;
          if (!sid) continue;
          const items: unknown[] = [];
          for await (const payload of plugin.exportQuery({
            ctx: { moduleUserId: sid, mainKey },
            pageSize: 200,
          })) {
            items.push(payload);
          }
          if (items.length) out[moduleKey] = items;
        } catch (err) {
          if (import.meta.env.DEV) console.error(`Export ${moduleKey} échoué:`, err);
        }
      }
      if (Object.keys(out).length === 0) {
        setError('Aucune donnée à exporter');
        return;
      }
      const payload = {
        meta: { version: 1, exported_at: new Date().toISOString(), app: 'Nodea' },
        modules: out,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodea_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Export terminé');
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold tracking-[0.02em] text-accent">Exporter</div>
      <div className="mb-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Tout emporter.
      </div>
      <p className="mb-3.5 text-[13px] leading-[1.55] text-muted">
        JSON déchiffré, généré chez toi. Ne quitte jamais ton navigateur.
      </p>
      <PrimaryButton onClick={handleExport} disabled={loading || !mainKey} className="px-[18px]">
        {loading ? 'Préparation…' : 'Exporter mes données'}
      </PrimaryButton>
      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </div>
  );
}

function ImportPanel() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFile(evt: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = evt.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!mainKey) throw new Error('Clé de chiffrement absente.');
      const text = (await file.text()).trim();
      let count = 0;
      const parts: string[] = [];

      async function pluginFor(moduleKey: string) {
        const plugin = await getDataPlugin(moduleKey);
        const runtimeKey = plugin.meta?.runtimeKey ?? plugin.meta?.id ?? moduleKey;
        if (!runtimeKey) return null;
        const sid = modules?.[runtimeKey]?.moduleUserId;
        if (!sid) return null;
        return { plugin, sid };
      }

      if (text.startsWith('{')) {
        const root = JSON.parse(text) as { modules?: Record<string, unknown[]> };
        if (!root?.modules) throw new Error('Format JSON invalide.');
        for (const [key, items] of Object.entries(root.modules)) {
          if (!Array.isArray(items) || items.length === 0) continue;
          let resolved;
          try {
            resolved = await pluginFor(key);
          } catch {
            parts.push(`${key}: ignoré (inconnu)`);
            continue;
          }
          if (!resolved) {
            parts.push(`${key}: ignoré (non activé)`);
            continue;
          }
          const { plugin, sid } = resolved;
          const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });
          let created = 0;
          let skipped = 0;
          for (const payload of items) {
            const k = plugin.getNaturalKey?.(payload) ?? null;
            if (k && existing.has(k)) {
              skipped += 1;
              continue;
            }
            await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
            if (k) existing.add(k);
            created += 1;
          }
          parts.push(`${key}: ${created} ajouté(s), ${skipped} doublon(s)`);
          count += created;
        }
      } else if (text.startsWith('[')) {
        // Legacy mood array
        const arr = JSON.parse(text) as unknown[];
        const resolved = await pluginFor('mood');
        if (!resolved) throw new Error('Module Mood non activé.');
        const { plugin, sid } = resolved;
        const existing: Set<string> = await plugin.listExistingKeys({ sid, mainKey });
        for (const payload of arr) {
          const k = plugin.getNaturalKey?.(payload) ?? null;
          if (k && existing.has(k)) continue;
          await plugin.importHandler({ payload, ctx: { moduleUserId: sid, mainKey } });
          if (k) existing.add(k);
          count += 1;
        }
        parts.push(`mood: ${count} ajouté(s)`);
      } else {
        throw new Error('Format inconnu.');
      }

      setSuccess(`Import terminé · ${count} entrée(s) — ${parts.join(' ; ')}`);
    } catch (err) {
      setError('Erreur d’import : ' + ((err as Error)?.message ?? ''));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold tracking-[0.02em] text-muted">Importer</div>
      <div className="mb-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Reprendre un export.
      </div>
      <p className="mb-3.5 text-[13px] leading-[1.55] text-muted">
        JSON ou NDJSON exporté précédemment. Doublons ignorés.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading || !mainKey}
        className="block w-full rounded-md border-[1.5px] border-dashed border-hair px-[14px] py-[22px] text-center text-[13px] text-muted transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? 'Import en cours…'
          : (
            <>
              Glisse un fichier ici, ou{' '}
              <span className="text-accent transition-colors group-hover:text-accent-deep">
                choisis-le
              </span>
              .
            </>
          )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json,.ndjson"
        onChange={handleFile}
        className="hidden"
      />

      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </div>
  );
}

/* ---------- Danger tab ---------------------------------------------------- */

function DangerTab() {
  const session = useSession();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete =
    confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase() && currentPassword.length > 0;

  async function handleDelete(): Promise<void> {
    setError(null);
    if (!canDelete) {
      setError('Confirme ton e-mail et ton mot de passe pour continuer.');
      return;
    }
    if (
      !window.confirm(
        'Cette action est irréversible. Toutes tes entrées chiffrées seront supprimées. Continuer ?',
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await apiDeleteMe({ currentPassword });
      await session.logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe actuel incorrect.');
      } else {
        setError('Erreur lors de la suppression.');
        if (import.meta.env.DEV) console.warn('delete-account failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[540px]">
      <div className="mb-1.5 text-[12px] font-semibold tracking-[0.02em] text-danger">Définitif</div>
      <div className="mb-2 text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Pas de retour.
      </div>
      <p className="mb-[22px] text-[14px] leading-[1.55] text-ink-soft">
        La suppression efface toutes tes entrées chiffrées, sessions et invitations. Aucune
        récupération possible — pense à exporter avant.
      </p>
      <Field
        label="Tape ton e-mail pour confirmer"
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        type="email"
      />
      <Field
        label="Mot de passe actuel"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        type="password"
      />
      <button
        type="button"
        onClick={handleDelete}
        disabled={submitting || !canDelete}
        className="rounded-md bg-danger px-[18px] py-1.5 text-[13px] font-semibold text-white transition-[background-color,transform] hover:bg-danger/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Suppression…' : 'Supprimer définitivement'}
      </button>
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </div>
  );
}

/* ---------- Shared atoms (K house) --------------------------------------- */

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
}

function Field({ label, className, id, name, ...rest }: FieldProps) {
  const inputId = id ?? `acct-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-[5px] block text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={cn(
          'block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
    </div>
  );
}

function PrimaryButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md border border-hair bg-transparent px-4 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Discard / "Abandonner" affordance — ghost style with danger
 * tone, signalling that the click drops in-flight changes. Kept
 * separate from `SecondaryButton` so neutral secondary actions
 * (e.g. the 2FA "Activer" placeholder) don't pick up the red
 * accent.
 */
function CancelButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md bg-transparent px-4 py-1.5 text-[13px] text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Feedback({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mt-3 border-l-2 px-3 py-1.5 text-[12.5px]',
        tone === 'error' ? 'border-danger bg-danger/5 text-danger' : 'border-accent bg-accent-soft text-accent-deep',
      )}
    >
      {children}
    </p>
  );
}

declare global {
  // Re-declare here purely to align with the existing `apiChangeEmail`
  // signature in `core/api/client.ts`. The actual type lives there.
}
