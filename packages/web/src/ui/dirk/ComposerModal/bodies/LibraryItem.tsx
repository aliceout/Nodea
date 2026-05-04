import { useState } from 'react';
import {
  type LibraryFormat,
  type LibraryStatus,
} from '@nodea/shared';

import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import Footer from '../components/Footer';
import LookupBar from '../lookup/LookupBar';

import { makeApplyResult } from './library-item/apply-result';
import LibraryItemFormFields from './library-item/form-fields';
import { saveLibraryItem } from './library-item/save';
import { useExistingCover } from './library-item/use-existing-cover';
import { useLibraryLookup } from './library-item/use-lookup';
import { useLookupSeed } from './library-item/use-lookup-seed';

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
 *
 * Decomposition (REFACTO-04 follow-up): the JSX, the existing-cover
 * loader, the lookup-seed effect and the apply-result writer all
 * live in `library-item/` siblings. The parent stays as a thin
 * orchestrator over the form state — coordinating useState slots
 * is what justifies keeping it here rather than splitting per slice.
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
  // covers as encrypted blobs (`coverRid`), so wiring the upload
  // pipeline is its own story. For now this is a visual hint in
  // the form so the user can confirm they picked the right book.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>(editingPayload?.status ?? 'planned');
  const [format, setFormat] = useState<LibraryFormat>(editingPayload?.format ?? 'unknown');
  const [tagsInput, setTagsInput] = useState((editingPayload?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup state lives in `useLibraryLookup` (REFACTO-04). The
  // search-language defaults to the user's app language (soft boost,
  // user can flip via the `<select>`). `searchMode` toggles between
  // "tout" (overwrite every field) and "couverture seule" (only the
  // cover URL is pulled) — surfaced on the edit path only.
  const lookup = useLibraryLookup();
  const [searchLang, setSearchLang] = useState<string>(userLang);
  const [searchMode, setSearchMode] = useState<'all' | 'cover-only'>('all');

  const isEdit = editing !== null;

  // On edit-mount, pre-seed the LookupBar with the current ISBN /
  // title-author so the user can refresh metadata in one click.
  useLookupSeed({
    editingId: editing?.id,
    editingIsbn,
    editingPayload,
    editingCreatorName,
    setInput: lookup.setInput,
  });

  // Load the existing cover when editing an item that has a
  // `coverRid`.
  useExistingCover({
    isEdit,
    coverRid: editingPayload?.coverRid ?? null,
    ctx,
    setCoverUrl,
    setCoverLoadFailed,
  });

  const applyResult = makeApplyResult({
    getSearchMode: () => searchMode,
    setTitle,
    setAuthor,
    setYear,
    setPublisher,
    setCollection,
    setSummary,
    setSeriesName,
    setSeriesPosition,
    setFormat,
    setIsbn,
    setCoverUrl,
    setCoverLoadFailed,
    lookup: { dismiss: lookup.dismiss, setInput: lookup.setInput },
  });

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await saveLibraryItem({
      ctx,
      editing: editing
        ? { id: editing.id, payload: editing.payload }
        : null,
      fields: {
        title,
        author,
        isbn,
        year,
        publisher,
        collection,
        summary,
        seriesName,
        seriesPosition,
        status,
        format,
        tagsInput,
        coverUrl,
      },
    });
    if (result.ok) {
      bumpItemsVersion();
      onClose();
    } else {
      setError(result.error);
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
  const showFormFields = !lookup.open || lookup.results.length === 0;

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
          value={lookup.input}
          onChange={lookup.setInput}
          onSearch={() => lookup.runSearch(searchLang)}
          searching={lookup.searching}
          error={lookup.error}
          results={lookup.results}
          open={lookup.open}
          onApply={applyResult}
          onDismiss={lookup.dismiss}
          disabled={submitting}
          lang={searchLang}
          onLangChange={setSearchLang}
          {...(isEdit
            ? { mode: searchMode, onModeChange: setSearchMode }
            : {})}
        />

        {showFormFields ? (
          <LibraryItemFormFields
            {...{
              isEdit, submitting, handleSave,
              title, setTitle, author, setAuthor, year, setYear,
              isbn, setIsbn, publisher, setPublisher,
              collection, setCollection,
              seriesName, setSeriesName, seriesPosition, setSeriesPosition,
              summary, setSummary, summaryMode, setSummaryMode,
              coverUrl, coverLoadFailed, setCoverLoadFailed,
              status, setStatus, format, setFormat,
              tagsInput, setTagsInput,
            }}
          />
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
