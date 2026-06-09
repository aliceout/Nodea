import { useEffect, useMemo, useState } from 'react';
import type { NormalisedBook } from '@nodea/shared';

import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkButton from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';

import { FORMAT_LABEL, SEARCH_LANGUAGES } from '@/ui/dirk/forms/constants';
import { countBy, shortLang } from '@/ui/dirk/forms/format';
import CoverGrid from './CoverGrid';
import FilterRow from './FilterRow';
import ProviderBadges from './ProviderBadges';
import SearchButton from './SearchButton';

interface LookupBarProps {
  value: string;
  onChange: (next: string) => void;
  onSearch: () => void | Promise<void>;
  searching: boolean;
  error: string | null;
  results: NormalisedBook[];
  open: boolean;
  onApply: (book: NormalisedBook) => void;
  onDismiss: () => void;
  disabled: boolean;
  /** BCP 47 2-letter code chosen by the user before searching.
   *  Used as a *hard filter* by the dispatcher (no soft boost
   *  / no post-search chip). Empty string disables the search
   *  button. */
  lang: string;
  onLangChange: (next: string) => void;
  /** What gets applied when the user picks a result :
   *   - `all` (default) — all metadata fields + cover.
   *   - `cover-only` — only the picked result's cover URL is
   *     applied, existing title / author / etc. stay as-is.
   *     Surfaced as a small toggle next to the search button
   *     on the edit path so a user who wants a fresh cover
   *     doesn't have to retype their metadata. */
  mode?: 'all' | 'cover-only';
  onModeChange?: (next: 'all' | 'cover-only') => void;
}

/**
 * Single search bar at the top of the create form. Detects
 * ISBN automatically (10/13 digits) and routes through the
 * right lookup endpoint. Results render inline below the bar ;
 * clicking one prefills the rest of the form.
 *
 * Privacy reminder for the user : the search query is sent to
 * the Nodea server, which proxies the providers — see
 * Library.md §4.
 *
 * Two narrowers post-search :
 *   - « Filtrer par » — where the user's query string matched
 *     (auteur·ice / titre). Cleaner than listing every author
 *     the result set surfaced — for « Annie Ernaux » we'd see
 *     noisy one-offs like « Sergio Villani 1 » (a critic who
 *     wrote about her) which doesn't help filter anything.
 *   - « Format » (paper / ebook / audio).
 *
 * Both reset when a fresh result set arrives.
 */
export default function LookupBar({
  value,
  onChange,
  onSearch,
  searching,
  error,
  results,
  open,
  onApply,
  onDismiss,
  disabled,
  lang,
  onLangChange,
  mode,
  onModeChange,
}: LookupBarProps) {
  const { t } = useI18n();
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lang) void onSearch();
    } else if (e.key === 'Escape') {
      onDismiss();
    }
  }

  // ---- Post-search filter state (chips below the bar) ----
  const [formatFilter, setFormatFilter] = useState<NormalisedBook['format']>(null);
  const [matchFilter, setMatchFilter] = useState<'author' | 'title' | null>(null);
  useEffect(() => {
    setFormatFilter(null);
    setMatchFilter(null);
  }, [results]);

  const formatCounts = useMemo(() => countBy(results, (b) => b.format), [results]);

  // Counts for the match-field chips : how many results would
  // each option keep ? Computed *as if* the chip were active so
  // the count shown alongside the chip is its actual size.
  const matchCounts = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('fr');
    if (!q) return { author: 0, title: 0 };
    let authorMatches = 0;
    let titleMatches = 0;
    for (const b of results) {
      if (b.creators.some((c) => c.name.toLocaleLowerCase('fr').includes(q))) {
        authorMatches += 1;
      }
      if (b.title.toLocaleLowerCase('fr').includes(q)) {
        titleMatches += 1;
      }
    }
    return { author: authorMatches, title: titleMatches };
  }, [results, value]);

  const filteredResults = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('fr');
    return results.filter((b) => {
      if (formatFilter && b.format !== formatFilter) return false;
      if (matchFilter === 'author') {
        if (!q) return true;
        return b.creators.some((c) => c.name.toLocaleLowerCase('fr').includes(q));
      }
      if (matchFilter === 'title') {
        if (!q) return true;
        return b.title.toLocaleLowerCase('fr').includes(q);
      }
      return true;
    });
  }, [results, formatFilter, matchFilter, value]);

  const showFilters =
    open &&
    results.length > 0 &&
    (formatCounts.length > 1 || matchCounts.author > 0 || matchCounts.title > 0);

  const expanded = open && results.length > 0;

  return (
    <div
      className={cn(
        'rounded-sm border border-hair bg-bg-2/60 p-2.5',
        // When results are showing, the bar grows to fill the
        // remaining space in the modal so the list can stretch
        // all the way down — keeps the modal-tall layout
        // filled instead of a white gap below the results card.
        expanded ? 'flex min-h-0 flex-1 flex-col' : '',
      )}
    >
      <div className="flex gap-2">
        <DirkInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('modals.composer.lookup.searchPlaceholder')}
          disabled={disabled}
        />
        <DirkSelect
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          aria-label={t('modals.composer.lookup.languageAria')}
          disabled={disabled}
          className="w-auto shrink-0"
        >
          <option value="" disabled>
            {t('modals.composer.lookup.languagePlaceholder')}
          </option>
          {SEARCH_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </DirkSelect>
        <SearchButton
          searching={searching}
          disabled={disabled || searching || value.trim().length < 2 || !lang}
          title={!lang ? t('modals.composer.lookup.searchNeedsLanguage') : undefined}
          onSearch={() => void onSearch()}
          mode={mode}
          onModeChange={onModeChange}
        />
        {open ? (
          <DirkButton
            variant="secondary"
            onClick={onDismiss}
            aria-label={t('modals.composer.lookup.closeAria')}
            title={t('modals.composer.lookup.closeTitle')}
            className="px-2"
          >
            ✕
          </DirkButton>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[11px] text-ink-soft">
          {error}
        </p>
      ) : null}
      {showFilters ? (
        <div className="mt-2 flex flex-col gap-1">
          {matchCounts.author > 0 || matchCounts.title > 0 ? (
            <FilterRow<'author' | 'title'>
              label={t('modals.composer.lookup.filterBy')}
              active={matchFilter}
              onChange={setMatchFilter}
              entries={[
                ...(matchCounts.author > 0
                  ? [
                      {
                        value: 'author' as const,
                        label: t('modals.composer.lookup.filterAuthor'),
                        count: matchCounts.author,
                      },
                    ]
                  : []),
                ...(matchCounts.title > 0
                  ? [
                      {
                        value: 'title' as const,
                        label: t('modals.composer.lookup.filterTitle'),
                        count: matchCounts.title,
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
          {formatCounts.length > 1 ? (
            <FilterRow<NormalisedBook['format']>
              label={t('modals.composer.lookup.filterFormat')}
              active={formatFilter}
              onChange={setFormatFilter}
              entries={formatCounts.map((c) => ({
                value: c.value,
                label: c.value ? FORMAT_LABEL[c.value] : '—',
                count: c.count,
              }))}
            />
          ) : null}
        </div>
      ) : null}
      {open && filteredResults.length > 0 ? (
        mode === 'cover-only' ? (
          <CoverGrid results={filteredResults} onPick={onApply} />
        ) : (
          <ul className="mt-2 max-h-[60vh] min-h-0 flex-1 overflow-auto rounded-sm border border-hair bg-bg">
            {filteredResults.map((book, i) => {
              const isbn = book.isbn13 ?? book.isbn10;
              const formatLabel = book.format ? FORMAT_LABEL[book.format] : null;
              const langCode = shortLang(book.language);
              const seriesLabel = book.series
                ? book.series.position
                  ? `${book.series.name}, t. ${book.series.position}`
                  : book.series.name
                : null;
              return (
                <li
                  key={`${book.source}-${book.title}-${i}`}
                  className="border-b border-hair last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onApply(book)}
                    className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-bg-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13px] font-medium text-ink">
                        {book.title}
                      </span>
                      <span className="truncate text-[11px] text-muted">
                        {book.creators[0]?.name ?? '—'}
                        {book.year ? <span className="ml-1.5 tabular-nums">· {book.year}</span> : null}
                        {book.publisher ? <span className="ml-1.5">· {book.publisher}</span> : null}
                        {book.collection ? <span className="ml-1.5">· {book.collection}</span> : null}
                      </span>
                      {(isbn || formatLabel || langCode || seriesLabel) ? (
                        <span className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-muted-soft">
                          {isbn ? <span className="tabular-nums">{isbn}</span> : null}
                          {langCode ? (
                            <span className="rounded bg-bg-2 px-1 py-px font-medium uppercase text-ink-soft">
                              {langCode}
                            </span>
                          ) : null}
                          {formatLabel ? (
                            <span className="rounded bg-bg-2 px-1 py-px font-medium text-ink-soft">
                              {formatLabel}
                            </span>
                          ) : null}
                          {seriesLabel ? <span className="italic">· {seriesLabel}</span> : null}
                        </span>
                      ) : null}
                    </span>
                    <ProviderBadges
                      primarySource={book.source}
                      providers={book.providers}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
