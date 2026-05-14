import { Link } from 'react-router-dom';

import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useHomepageData } from '../context';
import SectionLabel from './SectionLabel';

const SNIPPET_WORDS = 30;

/**
 * « Journal récent » block on the Home primary column.
 *
 * Reads the latest decrypted journal entry from the Homepage data
 * context (journal entries are sorted newest-first by
 * `projectJournalEntries`). Renders the entry's title in serif if
 * present, else falls back to the first ~30 words of content as a
 * quote. The footer carries the entry's date and a « voir le
 * journal » link.
 *
 * Hides entirely when the journal has no entry — a fresh account
 * shouldn't see an empty headline staring back.
 */
export default function RecentJournal() {
  const { t, language } = useI18n();
  const { journal } = useHomepageData();

  const latest = journal[0];
  if (!latest) return null;

  const title = latest.title?.trim() ?? '';
  const snippet = latest.content
    .trim()
    .split(/\s+/)
    .slice(0, SNIPPET_WORDS)
    .join(' ');
  const headline = title.length > 0 ? title : snippet;
  const wasTruncated =
    title.length === 0 &&
    latest.content.trim().split(/\s+/).length > SNIPPET_WORDS;

  const dateLabel = formatLongDate(latest.dateIso, language);

  return (
    <div className="mt-7">
      <SectionLabel>{t('home.journalRecent.heading')}</SectionLabel>
      <div className="py-1.5">
        <p className="font-serif text-[16px] leading-[1.5] text-ink">
          {title.length > 0 ? headline : `« ${headline}${wasTruncated ? '…' : ''} »`}
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          {dateLabel}
          {latest.thread.length > 0 ? ` · ${latest.thread}` : ''} ·{' '}
          <Link
            to="/flow"
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            {t('home.journalRecent.cta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
