import { useState } from 'react';
import {
  type LibraryFormat,
  type LibraryStatus,
} from '@nodea/shared';

import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { useLibraryData } from '../context';
import { makeApplyResult } from './item-form/apply-result';
import LibraryItemFormFields from './item-form/form-fields';
import { saveLibraryItem } from './item-form/save';
import { useExistingCover } from './item-form/use-existing-cover';
import { useLibraryLookup } from './item-form/use-lookup';
import { useLookupSeed } from './item-form/use-lookup-seed';
import LookupBar from './lookup/LookupBar';

import type { LibraryItem } from '../lib/types';

interface LibraryItemFormProps {
  /** When set, the form edits this book. The lookup bar is pre-seeded
   *  with the current ISBN / title-author combo and the cover preview
   *  loads from the existing `coverRid`. */
  initial?: LibraryItem;
  onClose: () => void;
}

/**
 * Library item (book) form — inline composer rendered inside
 * Library's `PrimaryColumn` (above the catalogue) when `formOpen`
 * is true and the active sub-view is `livres`.
 *
 * Decomposed across `./item-form/` siblings (orchestration helpers,
 * stateless fields, lookup seed, cover loader) and the `./lookup/`
 * subfolder (the BNF / Google / OpenLibrary search shell). Both
 * folders live next door so the « inline form » feature is one
 * cohesive unit, not a tour through the UI atom tree.
 *
 * Lookup behaviour : the LookupBar is on both paths. On create it's
 * the entry point (search → pick → form prefills) ; on edit it
 * doubles as « Télécharger les métadonnées » — pre-seeded with the
 * current title / author / ISBN so the user can refresh from BNF /
 * Google / OpenLibrary without retyping. While results are being
 * displayed (`lookup.open && lookup.results.length > 0`), the form
 * fields hide to avoid the "form → empty → results → form" flicker
 * around the few hundred ms of round-trip latency — same shape as
 * the original modal body.
 */
export default function LibraryItemForm({ initial, onClose }: LibraryItemFormProps) {
  const ctx = useModuleClient('library');
  const { covers } = useLibraryData();
  // The user's Nodea-app language (synced from encrypted preferences,
  // falling back to localStorage / navigator on first paint). Passed
  // to the lookup as a *soft boost*, not a filter — providers still
  // return all languages, but the dispatcher reorders so books in the
  // user's language float to the top. Bilingual users still see the
  // alternatives below.
  const { language: userLang, t } = useI18n();
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);

  const editing = initial ?? null;
  const editingPayload = editing ?? undefined;
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
  // Editor mode for the 4ᵉ de couv field : visual (Word-style
  // contentEditable, default) or markdown source. Same pattern as the
  // Journal form — gives non-technical users a formatted surface,
  // while letting power users see / edit the raw markers.
  const [summaryMode, setSummaryMode] = useState<'visual' | 'markdown'>('visual');
  // Cover URL preview — populated when the user picks a search result
  // (`applyResult`). For freshly created items the picked URL gets
  // downloaded via the proxy + persisted as an encrypted blob by
  // `saveLibraryItem` ; for existing items the cover preview is the
  // already-decrypted blob (`useExistingCover`).
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>(editingPayload?.status ?? 'planned');
  const [format, setFormat] = useState<LibraryFormat>(editingPayload?.format ?? 'unknown');
  const [tagsInput, setTagsInput] = useState((editingPayload?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup state lives in `useLibraryLookup`. The search-language
  // defaults to the user's app language (soft boost — user can flip
  // via the `<select>`). `searchMode` toggles between « tout »
  // (overwrite every field) and « couverture seule » (only the cover
  // URL is pulled) — surfaced on the edit path only.
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

  // Load the existing cover when editing a book that already has a
  // `coverRid`. No-op on create. The provider's covers Map serves
  // the thumbnail without any network round-trip (audit 2026-06).
  useExistingCover({
    isEdit,
    coverRid: editingPayload?.coverRid ?? null,
    ctx,
    covers,
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
      t,
      editing: editing
        ? { id: editing.id, payload: { ...editing } }
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
  // not while a search is loading. This avoids the "form → empty →
  // results → form" shrink/grow flicker the user sees during the few
  // hundred ms of round-trip latency. While loading, the form stays
  // visible and the LookupBar shows its own inline « … » indicator.
  const showFormFields = !lookup.open || lookup.results.length === 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="mb-5 rounded-md border border-hair bg-bg-2 p-4"
      noValidate
    >
      <div className="space-y-3">
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
            errorId={error ? 'library-item-form-error' : null}
          />
        ) : null}
      </div>

      {error ? (
        <p id="library-item-form-error" role="alert" className="mt-3 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="neutral"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting
            ? isEdit
              ? t('common.states.updating')
              : t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('library.form.submitCreate')}
        </Button>
      </div>
    </form>
  );
}
