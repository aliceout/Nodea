import { useNodeaStore } from '@/core/store/nodea-store';
import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { LiteMarkdown } from '@/lib/lite-markdown';

import { useHomepageData } from '../context';

const SNIPPET_WORDS = 35;

/**
 * Hero block on the Homepage — the most recent journal entry as
 * a calm lead-in, not a billboard. Lives between two hairline
 * rules, matching the typographic rhythm of the rest of the page
 * (no card chrome — surfaces are flat, separated by lines, not
 * boxed).
 *
 * The eyebrow folds date + thread next to the « DERNIÈRE ENTRÉE »
 * label so the metadata reads as part of the same chip instead
 * of demanding a separate footer line. The CTA stays on its own
 * baseline at the bottom (« lire la suite → »).
 *
 * Body markdown (`**bold**`, `*italic*`, `- bullet`) is rendered
 * via `LiteMarkdown` so the snippet isn't littered with literal
 * asterisks.
 *
 * Hides entirely on an empty journal — the homepage skips
 * straight to the next section.
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
  const snippetText = contentWords.slice(0, SNIPPET_WORDS).join(' ');
  const snippetForMd = truncated ? `${snippetText}…` : snippetText;

  return (
    <section
      aria-label={t('home.hero.ariaLabel')}
      className="border-y border-hair py-6 sm:py-7"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
        <span>{t('home.hero.eyebrow')}</span>
        <span aria-hidden="true" className="mx-2">·</span>
        <span>{formatLongDate(latest.dateIso, language)}</span>
        {latest.thread.length > 0 ? (
          <>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>{latest.thread}</span>
          </>
        ) : null}
      </p>

      {title.length > 0 ? (
        <>
          <h2 className="mt-3 max-w-[40ch] font-serif text-[24px] leading-[1.2] tracking-[-0.005em] text-ink sm:text-[28px]">
            {title}
          </h2>
          {snippetText.length > 0 ? (
            <div className="mt-3 max-w-[60ch] text-[14px] leading-[1.6] text-ink-soft">
              <LiteMarkdown text={snippetForMd} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-3 max-w-[60ch] font-serif text-[19px] leading-[1.45] text-ink sm:text-[20px]">
          <LiteMarkdown text={snippetForMd} />
        </div>
      )}

      <p className="mt-4 text-[11.5px]">
        <button
          type="button"
          onClick={() => setModule('journal')}
          className="cursor-pointer text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline"
        >
          {t('home.hero.cta')} →
        </button>
      </p>
    </section>
  );
}
