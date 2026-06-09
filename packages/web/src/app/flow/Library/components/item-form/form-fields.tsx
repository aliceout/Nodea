/**
 * Stateless render of the LibraryItem composer's form-fields block.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04 follow-up) — the
 * parent kept growing as the form picked up more fields (collection,
 * series, 4ᵉ de couv, cover preview…). Pulling the JSX out keeps
 * the parent under the 250-LOC ceiling while leaving the existing
 * `useState` soup untouched : every value/setter is prop-drilled in
 * (the form is self-contained, no need for context).
 *
 * The callsite still owns Cmd+Enter submission (`handleSave`) and
 * the markdown-editor mode toggle — both are passed through.
 */
import {
  LIBRARY_FORMAT_VALUES,
  LIBRARY_STATUS_VALUES,
  type LibraryFormat,
  type LibraryStatus,
} from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';

import MarkdownEditor from '@/ui/dirk/forms/MarkdownEditor';
import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

export interface LibraryItemFormFieldsProps {
  isEdit: boolean;
  submitting: boolean;
  handleSave: () => void | Promise<void>;
  // Field values + setters (kept as raw strings / typed unions, just
  // like the parent's useState slots).
  title: string;
  setTitle: (next: string) => void;
  author: string;
  setAuthor: (next: string) => void;
  year: string;
  setYear: (next: string) => void;
  isbn: string;
  setIsbn: (next: string) => void;
  publisher: string;
  setPublisher: (next: string) => void;
  collection: string;
  setCollection: (next: string) => void;
  seriesName: string;
  setSeriesName: (next: string) => void;
  seriesPosition: string;
  setSeriesPosition: (next: string) => void;
  summary: string;
  setSummary: (next: string) => void;
  summaryMode: 'visual' | 'markdown';
  setSummaryMode: (next: 'visual' | 'markdown') => void;
  coverUrl: string | null;
  coverLoadFailed: boolean;
  setCoverLoadFailed: (next: boolean) => void;
  status: LibraryStatus;
  setStatus: (next: LibraryStatus) => void;
  format: LibraryFormat;
  setFormat: (next: LibraryFormat) => void;
  tagsInput: string;
  setTagsInput: (next: string) => void;
}

export default function LibraryItemFormFields({
  isEdit, submitting, handleSave,
  title, setTitle, author, setAuthor, year, setYear,
  isbn, setIsbn, publisher, setPublisher,
  collection, setCollection,
  seriesName, setSeriesName, seriesPosition, setSeriesPosition,
  summary, setSummary, summaryMode, setSummaryMode,
  coverUrl, coverLoadFailed, setCoverLoadFailed,
  status, setStatus, format, setFormat,
  tagsInput, setTagsInput,
}: LibraryItemFormFieldsProps) {
  const { t } = useI18n();
  return (
    <>
      <DirkInput
        autoFocus={isEdit}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder={t('library.form.titlePlaceholder')}
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
        <DirkInput
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.authorPlaceholder')}
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.yearPlaceholder')}
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
          placeholder={t('library.form.isbnPlaceholder')}
          disabled={submitting}
          className="tabular-nums"
        />
        <DirkInput
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.publisherPlaceholder')}
          disabled={submitting}
        />
      </div>

      <DirkInput
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder={t('library.form.collectionPlaceholder')}
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <DirkInput
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.seriesPlaceholder')}
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={seriesPosition}
          onChange={(e) =>
            setSeriesPosition(e.target.value.replace(/\D/g, '').slice(0, 3))
          }
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.seriesPositionPlaceholder')}
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
          aria-label={t('library.form.statusAria')}
          disabled={submitting}
        >
          {LIBRARY_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {t(`library.status.${s}`)}
            </option>
          ))}
        </DirkSelect>
        <DirkSelect
          value={format}
          onChange={(e) => setFormat(e.target.value as LibraryFormat)}
          aria-label={t('library.form.formatAria')}
          disabled={submitting}
        >
          {LIBRARY_FORMAT_VALUES.map((f) => (
            <option key={f} value={f}>
              {t(`library.format.${f}`)}
            </option>
          ))}
        </DirkSelect>
        <DirkInput
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('library.form.tagsPlaceholder')}
          disabled={submitting}
        />
      </div>
    </>
  );
}
