import { useEffect, useRef, useState } from 'react';
import {
  LIBRARY_FORMAT_VALUES,
  LIBRARY_STATUS_VALUES,
  type LibraryFormat,
  type LibraryStatus,
  type NormalisedBook,
} from '@nodea/shared';

import {
  apiLibraryFetchCover,
  apiLibraryLookupByIsbn,
  isApiError,
  streamLibraryLookupByQuery,
} from '@/core/api/client';
import {
  libraryCoversClient,
  libraryItemsClient,
} from '@/core/api/modules/library';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';

import Footer from '../components/Footer';
import MarkdownEditor from '../components/MarkdownEditor';
import {
  LIBRARY_FORMAT_LABEL,
  LIBRARY_STATUS_LABEL,
} from '../lib/constants';
import { normaliseAuthorName, submitOnCmdEnter } from '../lib/format';
import LookupBar from '../lookup/LookupBar';

interface LibraryItemBodyProps {
  onClose: () => void;
}

/**
 * Library item form — manual entry only at this stage (Phase 1).
 * Phase 2 will add an "ISBN / titre" lookup that prefills via the
 * `/library/lookup` proxy.
 *
 * Author convention: when typing an author manually, the form
 * normalises on save to `<Prénom> <NOM en MAJUSCULES>` per the
 * decision documented in Library.md §3.1.
 */
export default function LibraryItemBody({ onClose }: LibraryItemBodyProps) {
  const ctx = useModuleClient('library');
  // The user's Nodea-app language (synced from encrypted preferences,
  // falling back to localStorage / navigator on first paint). Passed
  // to the lookup as a *soft boost*, not a filter — providers still
  // return all languages, but the dispatcher reorders so books in the
  // user's language float to the top. Bilingual users still see the
  // alternatives below.
  const { language: userLang } = useI18n();
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'library-item'
      ? s.composer.editing
      : null,
  );

  const editingPayload = editing?.payload;
  const editingCreatorName = editingPayload?.creators?.[0]?.name ?? '';
  const editingIsbn =
    editingPayload?.providers?.isbn13 ?? editingPayload?.providers?.isbn10 ?? '';

  const [title, setTitle] = useState(editingPayload?.title ?? '');
  const [author, setAuthor] = useState(editingCreatorName);
  const [isbn, setIsbn] = useState(editingIsbn);
  const [year, setYear] = useState(
    editingPayload?.year ? String(editingPayload.year) : '',
  );
  const [publisher, setPublisher] = useState(editingPayload?.publisher ?? '');
  const [collection, setCollection] = useState(editingPayload?.collection ?? '');
  const [seriesName, setSeriesName] = useState(editingPayload?.series?.name ?? '');
  const [seriesPosition, setSeriesPosition] = useState(
    editingPayload?.series?.position ? String(editingPayload.series.position) : '',
  );
  const [summary, setSummary] = useState(editingPayload?.summary ?? '');
  // Editor mode for the 4ᵉ de couv field: visual (Word-style
  // contentEditable, default) or markdown source. Same pattern as
  // the Journal Composer — gives non-technical users a formatted
  // surface, while letting power users see / edit the raw markers.
  const [summaryMode, setSummaryMode] = useState<'visual' | 'markdown'>('visual');
  // Cover URL preview — populated when the user picks a search
  // result (`applyResult`). Not persisted yet: the schema stores
  // covers as encrypted blobs (`cover_rid`), so wiring the upload
  // pipeline is its own story. For now this is a visual hint in
  // the form so the user can confirm they picked the right book.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>(editingPayload?.status ?? 'planned');
  const [format, setFormat] = useState<LibraryFormat>(editingPayload?.format ?? 'unknown');
  const [tagsInput, setTagsInput] = useState((editingPayload?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup state — only relevant on creation (the search bar is
  // hidden on edit since the user presumably knows their own data).
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NormalisedBook[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Default the search language to the user's Nodea app language —
  // it's the right choice 99 % of the time, and the user can flip
  // it via the `<select>` next to the search button. ISBN searches
  // ignore this (a 13-digit code is unambiguous across languages).
  const [searchLang, setSearchLang] = useState<string>(userLang);
  // What gets applied when the user picks a search result : « tout »
  // (default — title, author, year, cover, …) or « couverture
  // seule » (only the cover URL is pulled, everything else stays).
  // Surfaced as a small dropdown next to the search button on the
  // edit path.
  const [searchMode, setSearchMode] = useState<'all' | 'cover-only'>('all');
  // AbortController for the in-flight streaming search. We cancel
  // the previous run when the user fires a new search before the
  // old one finished — otherwise late snapshots from the old query
  // would clobber the new results, and the API keeps doing wasted
  // work on connections nobody reads from.
  const searchAbortRef = useRef<AbortController | null>(null);

  const isEdit = editing !== null;

  /**
   * Run a metadata lookup. ISBN-shaped input goes through the
   * dedicated by-isbn endpoint (one merged result, batch). Free-text
   * goes through the NDJSON streaming endpoint: snapshots arrive as
   * each provider settles (Google Books in ~1 s, Open Library in
   * ~10 s, etc.) so the user sees results progressively rather than
   * staring at a spinner for the slowest provider's full window.
   */
  async function runSearch(): Promise<void> {
    const q = searchInput.trim();
    if (!q) return;
    // Cancel any prior stream — its late snapshots would otherwise
    // overwrite our fresh results, and its `finally` would flip the
    // spinner off mid-new-run.
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setSearchError(null);
    setSearching(true);
    setSearchOpen(true);
    setSearchResults([]);
    try {
      const stripped = q.replace(/[\s-]/g, '');
      const isPossibleIsbn = /^\d{10}$|^\d{13}$|^\d{9}[\dX]$/i.test(stripped);
      if (isPossibleIsbn) {
        // ISBN: a 13-digit code is unambiguous, no point streaming.
        const response = await apiLibraryLookupByIsbn({ isbn: stripped });
        if (searchAbortRef.current !== ac) return; // superseded
        setSearchResults(response.results);
        if (response.results.length === 0) {
          setSearchError('Aucun résultat. Tu peux saisir manuellement.');
        }
        return;
      }
      // Free-text: stream snapshots in. Each snapshot is the full
      // accumulated state, so we just replace.
      let lastResults: NormalisedBook[] = [];
      await streamLibraryLookupByQuery(
        { q, lang: searchLang },
        {
          signal: ac.signal,
          onSnapshot: (snap) => {
            // Drop late snapshots from a superseded run.
            if (searchAbortRef.current !== ac) return;
            lastResults = snap.results;
            setSearchResults(snap.results);
          },
        },
      );
      if (searchAbortRef.current !== ac) return; // superseded
      if (lastResults.length === 0) {
        setSearchError('Aucun résultat. Tu peux saisir manuellement.');
      }
    } catch (err) {
      // AbortError on stream cancellation is expected and not user-
      // facing — happens when the user fires a new search.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (searchAbortRef.current !== ac) return; // superseded
      if (isApiError(err) && err.status === 429) {
        setSearchError('Trop de recherches récentes — patiente une minute.');
      } else {
        setSearchError('Recherche indisponible. Tu peux saisir manuellement.');
        if (import.meta.env.DEV) console.warn('library lookup failed', err);
      }
    } finally {
      // Only flip the spinner off if we're still the latest run —
      // otherwise an aborted stream would clear the indicator out
      // from under the new search that just started.
      if (searchAbortRef.current === ac) setSearching(false);
    }
  }

  function applyResult(book: NormalisedBook): void {
    if (searchMode === 'cover-only') {
      // Pull only the cover URL — every other field stays as the
      // user typed it. Useful when the existing metadata is fine
      // but the user wants a different cover (or the seed didn't
      // come with one).
      setCoverUrl(book.cover_url);
      setCoverLoadFailed(false);
      setSearchOpen(false);
      setSearchResults([]);
      // Keep the search input in cover-only mode so the user can
      // browse another result without re-typing.
      return;
    }
    setTitle(book.title);
    if (book.creators[0]?.name) setAuthor(book.creators[0].name);
    if (book.year) setYear(String(book.year));
    if (book.publisher) setPublisher(book.publisher);
    if (book.collection) setCollection(book.collection);
    if (book.summary) setSummary(book.summary);
    if (book.series) {
      setSeriesName(book.series.name);
      if (book.series.position) setSeriesPosition(String(book.series.position));
    }
    if (book.format) setFormat(book.format);
    if (book.isbn13) setIsbn(book.isbn13);
    else if (book.isbn10) setIsbn(book.isbn10);
    setCoverUrl(book.cover_url);
    setCoverLoadFailed(false);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchInput('');
  }

  function dismissSearch(): void {
    searchAbortRef.current?.abort();
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setSearching(false);
  }

  // Abort any in-flight stream when the body unmounts (modal closes
  // mid-search). The fetch / reader stop cleanly, the API stops
  // pushing snapshots into a connection nobody is reading.
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  // On edit-mount, pre-seed the LookupBar query with the book's
  // current ISBN (if any), else its `title author` combo. Lets the
  // user click « Chercher » immediately to refresh metadata from
  // an upstream provider without retyping their book's identity.
  // Runs once per editing target — `editing.id` is stable for a
  // given Composer open.
  const editingId = editing?.id;
  useEffect(() => {
    if (!isEdit || !editingId) return;
    const trimmedIsbn = editingIsbn.trim();
    if (trimmedIsbn) {
      setSearchInput(trimmedIsbn);
      return;
    }
    const trimmedTitle = (editingPayload?.title ?? '').trim();
    const trimmedAuthor = editingCreatorName.trim();
    const seed = [trimmedTitle, trimmedAuthor].filter(Boolean).join(' ');
    if (seed) setSearchInput(seed);
    // We deliberately depend only on `editingId` — the seed is
    // a one-shot on Composer open, not a live mirror of the
    // form's state (the user can adjust the search input freely
    // after that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // Load the existing cover when editing an item that has a
  // `cover_rid`. We list every cover record under the user's sid,
  // pick the one whose record id matches, and reconstruct the data
  // URL — same recipe as the Library page's `buildCoverMap`. Bulk
  // list is cheaper than a 1-record fetch endpoint we don't have,
  // and the cover collection is small per user.
  const editingCoverRid = editingPayload?.cover_rid ?? null;
  useEffect(() => {
    if (!isEdit || !editingCoverRid || !ctx) return undefined;
    let cancelled = false;
    libraryCoversClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const match = records.find((r) => r.id === editingCoverRid);
        if (match) {
          setCoverUrl(`data:${match.payload.mime};base64,${match.payload.blob_b64}`);
          setCoverLoadFailed(false);
        }
      })
      .catch(() => {
        // Silent — the Library page surfaces real load errors. The
        // composer just renders without the cover thumb.
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, editingCoverRid, ctx]);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Le titre est requis.');
      return;
    }
    if (!ctx) {
      setError('Module Library non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    if (year && !/^\d{4}$/.test(year)) {
      setError('L’année doit être un nombre à 4 chiffres.');
      return;
    }
    setSubmitting(true);
    try {
      const trimmedAuthor = author.trim();
      const normalisedAuthor = trimmedAuthor ? normaliseAuthorName(trimmedAuthor) : '';
      const isbnTrimmed = isbn.replace(/[\s-]/g, '');
      const providers: Record<string, string> = {};
      if (isbnTrimmed.length === 13) providers.isbn13 = isbnTrimmed;
      else if (isbnTrimmed.length === 10) providers.isbn10 = isbnTrimmed;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const basePayload = editingPayload ?? null;
      const payload = {
        // Schema defaults are not applied by zod on the input side
        // (they're "fill-in-on-parse"), so the create/update typing
        // requires every nullable field to be explicitly present.
        // We seed with sensible defaults, then let the editing
        // payload override what the user already had.
        type: 'book' as const,
        title: trimmedTitle,
        creators: normalisedAuthor
          ? [{ name: normalisedAuthor, role: 'author' }]
          : [],
        cover_rid: basePayload?.cover_rid ?? null,
        status,
        format,
        started_at: basePayload?.started_at ?? null,
        finished_at: basePayload?.finished_at ?? null,
        rating: basePayload?.rating ?? null,
        is_favorite: basePayload?.is_favorite ?? false,
        tags,
        ...(Object.keys(providers).length > 0
          ? { providers }
          : basePayload?.providers
            ? { providers: basePayload.providers }
            : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
        ...(collection.trim() ? { collection: collection.trim() } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
        ...(seriesName.trim()
          ? {
              series: {
                name: seriesName.trim(),
                ...(seriesPosition && /^\d+$/.test(seriesPosition)
                  ? { position: Number(seriesPosition) }
                  : {}),
              },
            }
          : {}),
      };
      if (editing) {
        // Edit path: cover swap mid-edit isn't wired (would need to
        // delete the old encrypted blob row and create a new one).
        // We just update the item, keeping the existing `cover_rid`
        // from `basePayload`. If the user wants to add a cover to a
        // book that didn't have one, that's still supported below.
        await libraryItemsClient.update(ctx.moduleUserId, ctx.mainKey, editing.id, payload);
        if (coverUrl && !basePayload?.cover_rid) {
          // Late-add a cover to an existing item: download via the
          // proxy, store the encrypted blob, then patch the item to
          // point at it. Best-effort — failure leaves the book without
          // a cover but doesn't roll back the rest of the edit.
          const fetched = await apiLibraryFetchCover(coverUrl);
          if (fetched) {
            try {
              const newCover = await libraryCoversClient.create(
                ctx.moduleUserId,
                ctx.mainKey,
                {
                  item_rid: editing.id,
                  mime: fetched.mime,
                  blob_b64: fetched.blob_b64,
                  fetched_from: coverUrl,
                  fetched_at: new Date().toISOString(),
                },
              );
              await libraryItemsClient.update(ctx.moduleUserId, ctx.mainKey, editing.id, {
                ...payload,
                cover_rid: newCover.id,
              });
            } catch (err) {
              if (import.meta.env.DEV) console.warn('cover persist failed', err);
            }
          }
        }
      } else {
        // Create path: race the item insert and the cover download —
        // they're independent (cover proxy lives on library-lookup,
        // not on the encrypted-records pipeline). Total wall-clock
        // is bounded by `max(itemCreate, coverFetch)` rather than
        // their sum.
        const [newItem, fetchedCover] = await Promise.all([
          libraryItemsClient.create(ctx.moduleUserId, ctx.mainKey, payload),
          coverUrl ? apiLibraryFetchCover(coverUrl) : Promise.resolve(null),
        ]);
        if (coverUrl && fetchedCover) {
          // Cover save is best-effort on create: if the encrypted-blob
          // round-trip fails we still keep the book record. Better
          // than losing the typed-out form to a flaky cover proxy.
          try {
            const newCover = await libraryCoversClient.create(
              ctx.moduleUserId,
              ctx.mainKey,
              {
                item_rid: newItem.id,
                mime: fetchedCover.mime,
                blob_b64: fetchedCover.blob_b64,
                fetched_from: coverUrl,
                fetched_at: new Date().toISOString(),
              },
            );
            await libraryItemsClient.update(ctx.moduleUserId, ctx.mainKey, newItem.id, {
              ...newItem.payload,
              cover_rid: newCover.id,
            });
          } catch (err) {
            if (import.meta.env.DEV) console.warn('cover persist failed', err);
          }
        }
      }
      bumpItemsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  // The form fields hide *only when actual results are displayed* —
  // not while a search is loading. This avoids the
  // "form → empty → results → form" shrink/grow flicker the user
  // sees during the few hundred ms of round-trip latency. While
  // loading, the form stays visible and the LookupBar shows its
  // own inline "…" indicator. The same rule applies on the edit
  // path : letting the form stay visible would squeeze the result
  // list to a 100 px slice at the top of the modal — when the user
  // is browsing search results, they're not editing the form.
  const showFormFields = !searchOpen || searchResults.length === 0;

  return (
    <>
    {/* Fixed height so the modal NEVER resizes between form / loading
        / results states (a `min-h` + natural-content combo still let
        the body grow when results > form). `max-h` clamps for small
        viewports — when the screen is short, the body shrinks below
        600 px and the inner `<ul>` scrolls. The 200 px envelope
        accounts for the type picker, footer, and the modal's top
        offset (`pt-[12vh]`). */}
    <div className="flex h-[600px] max-h-[calc(100vh-200px)] flex-col space-y-3 px-[22px] pt-3.5 pb-3">
      {/* LookupBar lives on both paths : on create it's the entry
          point (search → pick → form prefills) ; on edit it serves
          as « Télécharger les métadonnées » — pre-seeded with the
          current title / author / ISBN on mount so the user can
          refresh from BNF / Google / OpenLibrary without retyping
          their book's identity. */}
      <LookupBar
        value={searchInput}
        onChange={setSearchInput}
        onSearch={runSearch}
        searching={searching}
        error={searchError}
        results={searchResults}
        open={searchOpen}
        onApply={applyResult}
        onDismiss={dismissSearch}
        disabled={submitting}
        lang={searchLang}
        onLangChange={setSearchLang}
        {...(isEdit
          ? { mode: searchMode, onModeChange: setSearchMode }
          : {})}
      />

      {showFormFields ? (
      <>
      <DirkInput
        autoFocus={isEdit}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Titre — ex. Les Misérables"
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
        <DirkInput
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Auteur·rice — ex. Victor Hugo"
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Année"
          maxLength={4}
          disabled={submitting}
          align="center"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
        <DirkInput
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="ISBN (optionnel)"
          disabled={submitting}
          className="tabular-nums"
        />
        <DirkInput
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Éditeur (optionnel)"
          disabled={submitting}
        />
      </div>

      <DirkInput
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Collection (optionnel) — ex. Folio classique, Babel"
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <DirkInput
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Série (optionnel) — ex. Le Seigneur des Anneaux"
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={seriesPosition}
          onChange={(e) =>
            setSeriesPosition(e.target.value.replace(/\D/g, '').slice(0, 3))
          }
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Tome n°"
          disabled={submitting}
          align="center"
        />
      </div>

      {/* 4ᵉ de couv + couverture côte à côte. L'éditeur prend toute
          la largeur dispo (flex-1), la cover est fixe à droite avec
          un ratio livre 2:3. Si la cover charge mal (URL morte côté
          provider) on l'efface — pas envie d'afficher un cadre vide.
          Le MarkdownEditor rend le wiki-markup `##title##` et le
          markdown léger normalisés par le dispatcher (cleanSummary). */}
      <div className="flex flex-1 min-h-0 gap-3">
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <MarkdownEditor
            value={summary}
            onChange={setSummary}
            onSubmit={handleSave}
            disabled={submitting}
            mode={summaryMode}
            onModeChange={setSummaryMode}
            fillParent
          />
        </div>
        {coverUrl && !coverLoadFailed ? (
          <img
            src={coverUrl}
            alt=""
            onError={() => setCoverLoadFailed(true)}
            className="aspect-[2/3] w-[140px] flex-none self-start rounded-sm border border-hair bg-bg-2 object-cover"
          />
        ) : null}
      </div>

      {/* Status, Format, Tags compressés sur une seule ligne via
          deux <select> + un <input> — gagne ~110 px de hauteur sur
          le formulaire, ce qui laisse de la marge pour rajouter
          des champs (collection, série, 4ᵉ de couv) sans pousser
          la modale. La modale reste à sa hauteur fixe — l'espace
          dégagé apparaît juste comme du whitespace en bas tant
          qu'on n'a rien rajouté. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_140px_1fr]">
        <DirkSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as LibraryStatus)}
          aria-label="Statut"
          disabled={submitting}
        >
          {LIBRARY_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {LIBRARY_STATUS_LABEL[s]}
            </option>
          ))}
        </DirkSelect>
        <DirkSelect
          value={format}
          onChange={(e) => setFormat(e.target.value as LibraryFormat)}
          aria-label="Format"
          disabled={submitting}
        >
          {LIBRARY_FORMAT_VALUES.map((f) => (
            <option key={f} value={f}>
              {LIBRARY_FORMAT_LABEL[f]}
            </option>
          ))}
        </DirkSelect>
        <DirkInput
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Tags (optionnel) — ex. classique, à offrir"
          disabled={submitting}
        />
      </div>
      </>
      ) : null}
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEdit ? 'Mettre à jour' : 'Ajouter à ma bibliothèque'}
      submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}
