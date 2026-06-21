import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { LiteMarkdown } from '@/lib/lite-markdown';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';
import HomeModuleLink from './HomeModuleLink';

const SNIPPET_WORDS = 28;
const MAX_ENTRIES = 3;

/**
 * Journal block on the Homepage — the three most recent entries.
 * Wrapped in the shared `HomeCard` like every other home block so
 * border weight / radius / padding / hover stay aligned.
 *
 * The `title` slot packs « JOURNAL · DERNIÈRES ENTRÉES » into one
 * eyebrow ; the « voir le journal → » CTA lives in the trailing-link
 * slot. Each entry shows its date · thread on a muted line, the
 * title, then a 2-line markdown snippet (rendered via `LiteMarkdown`
 * so it isn't littered with literal asterisks). Hides entirely on an
 * empty journal — the homepage skips to the next section.
 */
export default function HeroEntry() {
  const { t, language } = useI18n();
  const { journal } = useHomepageData();

  const entries = journal.slice(0, MAX_ENTRIES);
  if (entries.length === 0) return null;

  const eyebrow = `${t('home.hero.module')} · ${t('home.hero.eyebrow')}`;

  return (
    <HomeCard
      title={eyebrow}
      cta={<HomeModuleLink module="journal" label={t('home.hero.cta')} />}
    >
      <ul className="divide-y divide-hair">
        {entries.map((entry) => {
          const title = entry.title?.trim() ?? '';
          const contentWords = entry.content.trim().split(/\s+/);
          const truncated = contentWords.length > SNIPPET_WORDS;
          const snippetText = contentWords.slice(0, SNIPPET_WORDS).join(' ');
          const snippetForMd = truncated ? `${snippetText}…` : snippetText;
          const metaParts = [
            formatLongDate(entry.dateIso, language),
            entry.thread.length > 0 ? entry.thread : null,
          ].filter((part): part is string => !!part);

          return (
            <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0">
              {metaParts.length > 0 ? (
                <p className="mb-1 text-[11px] text-muted">
                  {metaParts.join(' · ')}
                </p>
              ) : null}
              {title.length > 0 ? (
                <h3 className="text-[13.5px] font-semibold leading-snug text-ink">
                  {title}
                </h3>
              ) : null}
              {snippetText.length > 0 ? (
                <LiteMarkdown
                  text={snippetForMd}
                  className="mt-1 line-clamp-2 text-[12.5px]"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}
