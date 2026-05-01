import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
 * Three tabs (Newbie / Advanced / Tech), one URL per tab :
 * `/docs/newbie`, `/docs/advanced`, `/docs/tech`. The plain
 * `/docs` URL redirects to `/docs/newbie` upstream in `App.tsx`.
 * An unknown `:tab` (e.g. `/docs/foo`) falls back to newbie, so
 * stale or hand-typed URLs don't 404.
 *
 * Tabs sit in the topbar (slotted via `DocsLayout.tabs`); the
 * left rail TOC is auto-derived from the active tier's markdown
 * headings. h2 / h3 ids come from `rehype-slug` and can be deep-
 * linked with `/docs/:tab#section-id` — `useEffect` below scrolls
 * the matching heading into view at load.
 *
 * The /flow privacy invariant (URL must not leak the active
 * module) does NOT apply here : /docs is public, the audience for
 * each tab is broadly different anyway, and per-tab URLs are what
 * make pasted links and anchor deep-links useful in the first
 * place.
 *
 * Content is hand-curated markdown under `./docs/content/*.md` —
 * NOT pulled from `docs/*.md` (which target a more technical
 * reader). The three tiers cover the same security model at three
 * different reading registers; the tech tier links out to
 * `docs/Auth-Spec.md` and `docs/Security.md` for the exhaustive
 * reference. The Newbie tier also bundles a "Questions pratiques"
 * appendix (export, deletion, hosting, mobile…) — kept inline
 * rather than as a separate FAQ tab so newcomers find both the
 * security model and the practical answers in a single page.
 */
type TabId = 'newbie' | 'advanced' | 'tech';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'newbie', label: "L'essentiel" },
  { id: 'advanced', label: 'La mécanique' },
  { id: 'tech', label: 'Sous le capot' },
];

const TIER_TOCS = {
  newbie: newbieToc,
  advanced: advancedToc,
  tech: techToc,
} as const satisfies Record<TabId, unknown>;

function isTabId(value: unknown): value is TabId {
  return value === 'newbie' || value === 'advanced' || value === 'tech';
}

export default function DocsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const level: TabId = isTabId(tab) ? tab : 'newbie';

  // Unknown :tab (e.g. /docs/foo) → silently rewrite to /docs/newbie
  // so the URL stays in sync with the rendered tier.
  useEffect(() => {
    if (tab && !isTabId(tab)) {
      navigate('/docs/newbie', { replace: true });
    }
  }, [tab, navigate]);

  // Scroll to #section-id on load when the URL carries a hash.
  // We wait one frame so the markdown content has had time to mount
  // and `rehype-slug` has populated the heading ids. `scroll-mt-24`
  // (set on the h2 / h3 components) keeps the anchor away from the
  // sticky topbar. Re-runs when the active tier changes since
  // each tier emits its own set of ids.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return undefined;
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [level]);

  function handleTabChange(next: TabId): void {
    if (next === level) return;
    // Push a fresh history entry per tab — back button takes the
    // reader to the previous tab. Clear any anchor hash : switching
    // tabs is a new page, the previous section id may not exist
    // in the new tier.
    navigate(`/docs/${next}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const tabs = (
    <Tabs
      tabs={TABS}
      value={level}
      onChange={handleTabChange}
      variant="underline"
    />
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
        </header>

        {level === 'newbie' ? <DocsTierNewbie /> : null}
        {level === 'advanced' ? <DocsTierAdvanced /> : null}
        {level === 'tech' ? <DocsTierTech /> : null}
      </article>
    </DocsLayout>
  );
}
