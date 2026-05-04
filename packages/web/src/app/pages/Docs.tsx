import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import DocsLayout from '@/ui/dirk/docs/DocsLayout';
import DocsToc from '@/ui/dirk/docs/DocsToc';

import DocsTierNewbie, {
  tocSections as newbieToc,
} from './docs/DocsTierNewbie';
import DocsTierAdvanced, {
  tocSections as advancedToc,
} from './docs/DocsTierAdvanced';
import DocsTierTech, {
  tocSections as techToc,
} from './docs/DocsTierTech';
import DocsContribute, {
  tocSections as contributeToc,
} from './docs/DocsContribute';
import DocsSelfHost, {
  tocSections as selfHostToc,
} from './docs/DocsSelfHost';

/**
 * Public docs page — Direction K · Sauge.
 *
 * Three top-level sections, distinct audiences :
 *
 *   - **Sécurité** (`/docs/security/{newbie,advanced,tech}`) — modèle
 *     de chiffrement à 3 registres de lecture (utilisateur curieux,
 *     curieux technique, contributeur·rice / auditeur·rice). La
 *     section ouvre un *dropdown* qui pose les 3 tiers — c'est le
 *     pattern le plus compact pour une nav à 2 niveaux sur cette
 *     seule section.
 *   - **Contribuer** (`/docs/contribute`) — setup local, lancer les
 *     tests, recettes pour ajouter une route / un module. Source de
 *     vérité progressive : le contenu transfère depuis le repo
 *     `docs/Development.md` vers cette page.
 *   - **Auto-héberger** (`/docs/self-host`) — install Docker, env
 *     vars, reverse proxy, mises à jour, backups. Source de vérité
 *     progressive : transfère depuis `docs/Operations.md` + le root
 *     README.
 *
 * Le `/flow` privacy invariant ne s'applique pas ici : `/docs` est
 * public, l'audience varie d'un onglet à l'autre, et les URLs par
 * section + tier permettent les deep-links.
 *
 * Anciennes URLs (`/docs/newbie`, `/docs/advanced`, `/docs/tech`)
 * sont redirigées vers `/docs/security/<tier>` côté `App.tsx`.
 */

type Section = 'security' | 'contribute' | 'self-host';
type SecurityTier = 'newbie' | 'advanced' | 'tech';

const SECTIONS: ReadonlyArray<{ id: Section; label: string; path: string }> = [
  { id: 'security', label: 'Sécurité', path: '/docs/security/newbie' },
  { id: 'contribute', label: 'Contribuer', path: '/docs/contribute' },
  { id: 'self-host', label: 'Auto-héberger', path: '/docs/self-host' },
];

const SECURITY_TIERS: ReadonlyArray<{ id: SecurityTier; label: string }> = [
  { id: 'newbie', label: "L'essentiel" },
  { id: 'advanced', label: 'La mécanique' },
  { id: 'tech', label: 'Sous le capot' },
];

const SECURITY_TIER_TOCS = {
  newbie: newbieToc,
  advanced: advancedToc,
  tech: techToc,
} as const;

const DOC_TITLES = {
  'security:newbie': "L'essentiel — Documentation",
  'security:advanced': 'La mécanique — Documentation',
  'security:tech': 'Sous le capot — Documentation',
  contribute: 'Contribuer — Documentation',
  'self-host': 'Auto-héberger — Documentation',
} as const;

const CANONICAL_BASE = 'https://nodea.app';

function isSection(value: unknown): value is Section {
  return value === 'security' || value === 'contribute' || value === 'self-host';
}

function isSecurityTier(value: unknown): value is SecurityTier {
  return value === 'newbie' || value === 'advanced' || value === 'tech';
}

export default function DocsPage() {
  const { section: rawSection, tier: rawTier } = useParams<{
    section?: string;
    tier?: string;
  }>();
  const navigate = useNavigate();

  const section: Section = isSection(rawSection) ? rawSection : 'security';
  const tier: SecurityTier =
    section === 'security' && isSecurityTier(rawTier) ? rawTier : 'newbie';

  // Compose the canonical URL for the active page. Section without
  // a tier (`contribute`, `self-host`) uses just `/docs/<section>` ;
  // security uses `/docs/security/<tier>`.
  const canonicalPath =
    section === 'security' ? `/docs/security/${tier}` : `/docs/${section}`;

  // Title key — the security section keeps a per-tier title (« Sous
  // le capot » etc.) ; the other two have a single title each.
  const titleKey =
    section === 'security' ? (`security:${tier}` as const) : section;
  useDocumentTitle(DOC_TITLES[titleKey]);

  // Update the canonical link to the active page (FRONT-12).
  useEffect(() => {
    const target = `${CANONICAL_BASE}${canonicalPath}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel=canonical]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    const previous = link.href;
    link.href = target;
    return () => {
      link.href = previous || `${CANONICAL_BASE}/`;
    };
  }, [canonicalPath]);

  // Unknown :section (e.g. /docs/foo) → silently rewrite to the
  // default section/tier so stale or hand-typed URLs don't 404.
  useEffect(() => {
    if (rawSection && !isSection(rawSection)) {
      navigate('/docs/security/newbie', { replace: true });
      return;
    }
    if (
      section === 'security' &&
      rawTier !== undefined &&
      !isSecurityTier(rawTier)
    ) {
      navigate('/docs/security/newbie', { replace: true });
    }
  }, [rawSection, rawTier, section, navigate]);

  // Scroll to #section-id on load when the URL carries a hash.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return undefined;
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [section, tier]);

  function navigateToSection(target: Section): void {
    if (target === section) return;
    const path = SECTIONS.find((s) => s.id === target)?.path ?? '/docs/security/newbie';
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function navigateToTier(target: SecurityTier): void {
    if (section === 'security' && target === tier) return;
    navigate(`/docs/security/${target}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const tocSections =
    section === 'security'
      ? SECURITY_TIER_TOCS[tier]
      : section === 'contribute'
        ? contributeToc
        : selfHostToc;

  return (
    <DocsLayout
      tabs={
        <TopNav
          activeSection={section}
          activeTier={tier}
          onSectionClick={navigateToSection}
          onTierClick={navigateToTier}
        />
      }
      aside={<DocsToc sections={tocSections} />}
    >
      <article className="animate-fade-up">
        <header className="mb-8">
          <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">
            Documentation
          </p>
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {section === 'security'
              ? 'Comment Nodea protège tes données'
              : section === 'contribute'
                ? 'Contribuer à Nodea'
                : 'Auto-héberger Nodea'}
          </h1>
        </header>

        {section === 'security' && tier === 'newbie' ? <DocsTierNewbie /> : null}
        {section === 'security' && tier === 'advanced' ? <DocsTierAdvanced /> : null}
        {section === 'security' && tier === 'tech' ? <DocsTierTech /> : null}
        {section === 'contribute' ? <DocsContribute /> : null}
        {section === 'self-host' ? <DocsSelfHost /> : null}
      </article>
    </DocsLayout>
  );
}

/* ============================================================================
 * Top navigation — 3 sections en onglets, le premier ouvre un dropdown
 * sur les 3 tiers de sécurité.
 * ========================================================================== */

interface TopNavProps {
  activeSection: Section;
  activeTier: SecurityTier;
  onSectionClick: (target: Section) => void;
  onTierClick: (target: SecurityTier) => void;
}

function TopNav({
  activeSection,
  activeTier,
  onSectionClick,
  onTierClick,
}: TopNavProps) {
  return (
    <div className="flex h-full items-stretch gap-6" role="tablist">
      {/* Sécurité — dropdown trigger (Headless UI Menu).
          Le bouton hérite du même style que les autres onglets pour
          que la nav reste visuellement cohérente. */}
      <Menu as="div" className="relative inline-flex h-full items-stretch">
        <MenuButton
          className={cn(
            'inline-flex h-full cursor-pointer items-center gap-1 border-b-2 px-1 text-[13px] transition-colors duration-200',
            activeSection === 'security'
              ? 'border-accent font-semibold text-ink'
              : 'border-transparent text-muted hover:text-ink',
          )}
          aria-label="Sécurité (3 niveaux de lecture)"
        >
          Sécurité
          <ChevronDownIcon
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        </MenuButton>
        <MenuItems
          anchor="bottom start"
          className={cn(
            'z-50 mt-1 min-w-[200px] rounded-md border border-hair bg-bg p-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)] [--anchor-gap:6px]',
            'focus:outline-none',
          )}
        >
          {SECURITY_TIERS.map((t) => {
            const isActive = activeSection === 'security' && activeTier === t.id;
            return (
              <MenuItem key={t.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => onTierClick(t.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
                      isActive
                        ? 'bg-accent-soft font-semibold text-accent-deep'
                        : focus
                          ? 'bg-bg-2 text-ink'
                          : 'text-ink-soft',
                    )}
                  >
                    {t.label}
                  </button>
                )}
              </MenuItem>
            );
          })}
        </MenuItems>
      </Menu>

      {/* Contribuer + Auto-héberger : onglets simples. */}
      {SECTIONS.filter((s) => s.id !== 'security').map((s) => {
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSectionClick(s.id)}
            data-active={isActive}
            className={cn(
              'inline-flex h-full cursor-pointer items-center border-b-2 px-1 text-[13px] transition-colors duration-200',
              isActive
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
