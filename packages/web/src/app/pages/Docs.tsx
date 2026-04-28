import { useSearchParams } from 'react-router-dom';

import DocsLayout from '@/ui/dirk/DocsLayout';
import DocsToc from '@/ui/dirk/DocsToc';
import Tabs from '@/ui/dirk/Tabs';

import DocsTierNewbie, {
  tocSections as newbieToc,
} from './docs/DocsTierNewbie';
import DocsTierAdvanced, {
  tocSections as advancedToc,
} from './docs/DocsTierAdvanced';
import DocsTierTech, {
  tocSections as techToc,
} from './docs/DocsTierTech';

/**
 * Public docs page — Direction K · Sauge.
 *
 * Single URL `/docs` with three tabs (Newbie / Advanced / Tech).
 * Tabs sit in the topbar (slotted via `DocsLayout.tabs`); the
 * left rail TOC is auto-derived from the active tier's markdown
 * headings.
 *
 * Active tier is mirrored in the query string (`?level=`) so each
 * tier is independently shareable, deep-linkable, and SEO-able.
 * Default tier is `newbie` — assume a brand-new visitor landing
 * from the login page link.
 *
 * Content is hand-curated markdown under `./docs/content/*.md` —
 * NOT pulled from `docs/*.md` (which target a more technical
 * reader). The three tiers cover the same security model at three
 * different reading registers; the tech tier links out to
 * `docs/Auth-Spec.md` and `docs/Security.md` for the exhaustive
 * reference.
 */
const TAB_IDS = ['newbie', 'advanced', 'tech'] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'newbie', label: 'Les bases' },
  { id: 'advanced', label: 'Comment ça marche' },
  { id: 'tech', label: 'Pour les profils sécu' },
];

const TIER_TOCS: Record<
  TabId,
  ReadonlyArray<{ id: string; label: string }>
> = {
  newbie: newbieToc,
  advanced: advancedToc,
  tech: techToc,
};

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

export default function DocsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('level');
  const level: TabId = isTabId(raw) ? raw : 'newbie';

  function handleTabChange(next: TabId): void {
    const nextParams = new URLSearchParams(params);
    if (next === 'newbie') {
      nextParams.delete('level');
    } else {
      nextParams.set('level', next);
    }
    setParams(nextParams, { replace: true });
    // Switching tabs is logically a new page — scroll to top so
    // the reader doesn't end up halfway down a different document.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const tabs = (
    <Tabs tabs={TABS} value={level} onChange={handleTabChange} />
  );

  return (
    <DocsLayout
      tabs={tabs}
      aside={<DocsToc sections={TIER_TOCS[level]} />}
    >
      <article className="animate-fade-up">
        <header className="mb-8">
          <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">
            Documentation
          </p>
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            Comment Nodea protège tes données
          </h1>
          <p className="mt-4 max-w-[640px] text-[16px] leading-[1.6] text-ink-soft">
            Trois niveaux de lecture selon ce que tu cherches. Tout est
            accessible, choisis ton entrée.
          </p>
        </header>

        {level === 'newbie' ? <DocsTierNewbie /> : null}
        {level === 'advanced' ? <DocsTierAdvanced /> : null}
        {level === 'tech' ? <DocsTierTech /> : null}
      </article>
    </DocsLayout>
  );
}
