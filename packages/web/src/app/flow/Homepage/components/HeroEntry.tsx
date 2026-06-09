import { useNodeaStore } from '@/core/store/nodea-store';
import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { LiteMarkdown } from '@/lib/lite-markdown';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';

const SNIPPET_WORDS = 35;

/**
 * Hero block on the Homepage — the most recent journal entry.
 * Wrapped in the shared `HomeCard` like every other home block so
 * border weight / radius / padding / hover all stay aligned (a
 * previous version rolled its own `<section>` with bespoke serif
 * chrome and ended up reading thicker than the rest once the
 * cards landed side-by-side).
 *
 * The `title` slot packs « DERNIÈRE ENTRÉE · date · thread » into
 * one eyebrow ; the « voir le journal → » CTA lives in the
 * trailing-link slot, matching the « tout voir → » affordance the
 * other cards use. Body markdown is rendered via `LiteMarkdown`
 * so the snippet isn't littered with literal asterisks.
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

  // Eyebrow = « JOURNAL · DERNIÈRE ENTRÉE » so the card title
  // names the module the data comes from (consistent with the
  // « MOOD · 6 MOIS », « GOALS · N EN COURS » pattern). The date +
  // thread metadata moves into the body just under the title as a
  // small muted line — same info, but no longer fights with the
  // module prefix for the eyebrow's tracking-wide space.
  const eyebrow = `${t('home.hero.module')} · ${t('home.hero.eyebrow')}`;
  const metaParts = [
    formatLongDate(latest.dateIso, language),
    latest.thread.length > 0 ? latest.thread : null,
  ].filter((part): part is string => !!part);

  return (
    <HomeCard
      title={eyebrow}
      cta={
        <button
          type="button"
          onClick={() => setModule('journal')}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {t('home.hero.cta')} →
        </button>
      }
    >
      {metaParts.length > 0 ? (
        <p className="mb-2 text-[11px] text-muted">
          {metaParts.join(' · ')}
        </p>
      ) : null}
      {title.length > 0 ? (
        <>
          <h2 className="text-[14px] font-semibold leading-snug text-ink">
            {title}
          </h2>
          {snippetText.length > 0 ? (
            <div className="mt-2 text-[13px] leading-[1.5] text-ink-soft">
              <LiteMarkdown text={snippetForMd} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-[13px] leading-[1.5] text-ink-soft">
          <LiteMarkdown text={snippetForMd} />
        </div>
      )}
    </HomeCard>
  );
}
