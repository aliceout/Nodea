import { useSearchParams } from 'react-router-dom';

import DocsLayout from '@/ui/dirk/DocsLayout';
import Tabs from '@/ui/dirk/Tabs';

import DocsTierNewbie from './docs/DocsTierNewbie';
import DocsTierAdvanced from './docs/DocsTierAdvanced';
import DocsTierTech from './docs/DocsTierTech';

/**
 * Public docs page — Direction K · Sauge.
 *
 * Single URL `/docs` with three tabs (Newbie / Advanced / Tech).
 * Active tier is mirrored in the query string (`?level=`) so each
 * tier is independently shareable, deep-linkable, and SEO-able. The
 * default tier is `newbie` — assume a brand-new visitor landing
 * from the login page link.
 *
 * Content is hand-curated, NOT pulled from `docs/*.md` (which target
 * a more technical reader). The three tiers cover the same security
 * model at three different reading registers; the tech tier links
 * out to `docs/Auth-Spec.md` and `docs/Security.md` for the
 * exhaustive reference.
 */
const TAB_IDS = ['newbie', 'advanced', 'tech'] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'newbie', label: 'Les bases' },
  { id: 'advanced', label: 'Comment ça marche' },
  { id: 'tech', label: 'Pour les profils sécu' },
];

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
    // Scroll back to top — switching tab should feel like opening
    // a new page, not jumping to a same-position scroll on
    // different content.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  return (
    <DocsLayout>
      <article className="animate-fade-up">
        <header className="mb-10">
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

        <Tabs tabs={TABS} value={level} onChange={handleTabChange} className="mb-8" />

        {level === 'newbie' ? <DocsTierNewbie /> : null}
        {level === 'advanced' ? <DocsTierAdvanced /> : null}
        {level === 'tech' ? <DocsTierTech /> : null}
      </article>
    </DocsLayout>
  );
}
