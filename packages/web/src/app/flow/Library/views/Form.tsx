import { useState, type FormEvent } from 'react';
import {
  LIBRARY_TYPE_VALUES,
  LIBRARY_STATUS_VALUES,
  type LibraryItemPayload,
} from '@nodea/shared';
import { useLibrary } from '../hooks/useLibrary';
import Rating from '../components/Rating';
import TagsInput from '../components/TagsInput';
import {
  searchProvider,
  type ProviderSuggestion,
} from '../services/providers';

interface LibraryFormViewProps {
  onDone?: () => void;
}

type ProviderId = ProviderSuggestion['provider'];
const PROVIDERS: ProviderId[] = ['openlibrary', 'googlebooks'];

export default function LibraryFormView({ onDone }: LibraryFormViewProps) {
  const { ready, createItem } = useLibrary();

  // Core payload state
  const [type, setType] = useState<LibraryItemPayload['type']>('book');
  const [title, setTitle] = useState('');
  const [creators, setCreators] = useState<string[]>([]);
  const [year, setYear] = useState<string>('');
  const [language, setLanguage] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState<LibraryItemPayload['status']>('planned');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [provider, setProvider] = useState<ProviderId | ''>('');
  const [externalId, setExternalId] = useState('');

  // Provider search state (opt-in)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchProviderId, setSearchProviderId] = useState<ProviderId>('openlibrary');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProviderSuggestion[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runSearch(): Promise<void> {
    setSearchError(null);
    setSearchResults([]);
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const hits = await searchProvider(searchProviderId, q);
      setSearchResults(hits);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Erreur de recherche.');
    } finally {
      setSearching(false);
    }
  }

  function applySuggestion(s: ProviderSuggestion): void {
    setType(s.type);
    setTitle(s.title);
    setCreators(s.creators);
    setYear(s.year != null ? String(s.year) : '');
    setLanguage(s.language ?? '');
    setCoverUrl(s.cover_url ?? '');
    setProvider(s.provider);
    setExternalId(s.external_id);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('Un titre est requis.');
      return;
    }
    const yearNum = year.trim() ? Number(year.trim()) : undefined;
    if (yearNum != null && (!Number.isInteger(yearNum) || yearNum < 0)) {
      setError('Année invalide.');
      return;
    }

    const payload: LibraryItemPayload = {
      type,
      title: title.trim(),
      creators: creators.map((c) => c.trim()).filter(Boolean),
      status,
      tags: tags.map((t) => t.trim()).filter(Boolean),
      ...(provider ? { provider } : {}),
      ...(externalId.trim() ? { external_id: externalId.trim() } : {}),
      ...(yearNum != null ? { year: yearNum } : {}),
      ...(language.trim() ? { language: language.trim() } : {}),
      ...(coverUrl.trim() ? { cover_url: coverUrl.trim() } : {}),
      ...(startedAt ? { started_at: startedAt } : {}),
      ...(finishedAt ? { finished_at: finishedAt } : {}),
      ...(rating != null ? { rating } : {}),
    };

    setSaving(true);
    try {
      await createItem(payload);
      setSuccess('Œuvre ajoutée.');
      // Reset
      setTitle('');
      setCreators([]);
      setYear('');
      setLanguage('');
      setCoverUrl('');
      setStatus('planned');
      setStartedAt('');
      setFinishedAt('');
      setRating(undefined);
      setTags([]);
      setProvider('');
      setExternalId('');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl space-y-4 py-6">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Ajouter une œuvre</h1>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {searchOpen ? 'Masquer la recherche' : 'Rechercher (provider)'}
        </button>
      </header>

      {searchOpen ? (
        <fieldset className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            ⚠ Cette recherche envoie ton terme en clair au provider choisi
            (serveur tiers). Rien n'est stocké. Désactive si tu préfères tout
            saisir à la main.
          </p>
          <div className="flex gap-2">
            <select
              value={searchProviderId}
              onChange={(e) => setSearchProviderId(e.target.value as ProviderId)}
              className="rounded border border-slate-300 p-2"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Titre, auteur·ice…"
              className="flex-1 rounded border border-slate-300 p-2"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching || !searchQuery.trim()}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {searching ? 'Recherche…' : 'Chercher'}
            </button>
          </div>
          {searchError ? <p className="text-xs text-red-600">{searchError}</p> : null}
          {searchResults.length > 0 ? (
            <ul className="space-y-1">
              {searchResults.map((s) => (
                <li key={`${s.provider}:${s.external_id}`}>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="flex w-full items-start gap-3 rounded border border-slate-200 bg-white p-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {s.cover_url ? (
                      <img
                        src={s.cover_url}
                        alt=""
                        className="h-14 w-10 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-14 w-10 flex-shrink-0 rounded bg-slate-200 dark:bg-slate-700" />
                    )}
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs opacity-60">
                        {s.creators.join(', ')}
                        {s.year ? ` · ${s.year}` : ''}
                        {s.language ? ` · ${s.language}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
      ) : null}

      <label className="block">
        <span className="text-sm">Titre</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LibraryItemPayload['type'])}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          >
            {LIBRARY_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 block">
          <span className="text-sm">Statut</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LibraryItemPayload['status'])}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          >
            {LIBRARY_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm">Auteur·ices / créateur·ices</span>
        <TagsInput
          value={creators}
          onChange={setCreators}
          placeholder="Entrée pour valider, virgule pour séparer"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">Année</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="ex. 2022"
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
        <label className="flex-1 block">
          <span className="text-sm">Langue</span>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="ex. fr"
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm">URL de couverture</span>
        <input
          type="url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="aperçu"
            className="mt-2 h-32 rounded border border-slate-200 object-cover dark:border-slate-700"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
      </label>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">Commencé le</span>
          <input
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
        <label className="flex-1 block">
          <span className="text-sm">Terminé le</span>
          <input
            type="date"
            value={finishedAt}
            onChange={(e) => setFinishedAt(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm">Note</span>
        <Rating value={rating} onChange={setRating} />
      </div>

      <label className="block">
        <span className="text-sm">Tags</span>
        <TagsInput value={tags} onChange={setTags} placeholder="ex: essentiel, à relire…" />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <button
        type="submit"
        disabled={!ready || saving || !title.trim()}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Ajout…' : 'Ajouter'}
      </button>
    </form>
  );
}
