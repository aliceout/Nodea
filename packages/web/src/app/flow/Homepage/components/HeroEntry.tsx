import { useNodeaStore } from '@/core/store/nodea-store';
import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useHomepageData } from '../context';

const SNIPPET_WORDS = 45;

/**
 * Hero block on the Homepage — surfaces the most recent journal
 * entry in large serif typography, treated like the front page
 * of an editorial issue. The entry's title in 28-px serif if
 * present, otherwise the opening lines of the content as a
 * pulled quote.
 *
 * Below the body : the date, the thread, and a single CTA that
 * takes the user to the Journal module. If a content-derived
 * snippet was truncated, an inline ellipsis hints at it.
 *
 * Hides entirely on an empty journal — the homepage skips
 * straight to the card grid. A first-time user sees the cards as
 * their landing, not a sad « no entry yet » placeholder.
 */
export default function HeroEntry() {
  const { t, language } = useI18n();
  const { journal } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);

  const latest = journal[0];
  if (!latest) return null;

  const title = latest.title?.trim() ?? '';
  const contentWords = latest.content.trim().split(/\s+/);
  const truncated = contentWords.length > SNIPPET_WORDS;
  const snippet = contentWords.slice(0, SNIPPET_WORDS).join(' ');

  return (
    <section
      aria-label={t('home.hero.ariaLabel')}
      className="relative overflow-hidden rounded-2xl border border-hair bg-bg-2 px-8 py-10 sm:px-12 sm:py-14"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {t('home.hero.eyebrow')}
      </p>

      {title.length > 0 ? (
        <h2 className="mt-3 max-w-[40ch] font-serif text-[28px] leading-[1.2] tracking-[-0.01em] text-ink sm:text-[34px]">
          {title}
        </h2>
      ) : (
        <p className="mt-3 max-w-[40ch] font-serif text-[22px] leading-[1.4] text-ink sm:text-[26px]">
          «&nbsp;{snippet}
          {truncated ? '…' : ''}&nbsp;»
        </p>
      )}

      {title.length > 0 && snippet.length > 0 ? (
        <p className="mt-4 max-w-[60ch] text-[14px] leading-[1.6] text-ink-soft">
          {snippet}
          {truncated ? '…' : ''}
        </p>
      ) : null}

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-muted">
        <span>{formatLongDate(latest.dateIso, language)}</span>
        {latest.thread.length > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{latest.thread}</span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setModule('journal')}
          className="cursor-pointer text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline"
        >
          {t('home.hero.cta')}
        </button>
      </p>
    </section>
  );
}
