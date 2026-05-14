import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import DocsFork, {
  tocSections as forkToc,
} from './docs/DocsFork';
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
 *   - **Reprendre le projet** (`/docs/fork`) — pour quelqu'un qui
 *     télécharge le code pour s'en faire sa propre version. Setup
 *     local, comprendre la structure, lancer les tests, invariants
 *     crypto à respecter quand on modifie. Distinct du
 *     `CONTRIBUTING.md` du repo qui couvre le workflow upstream
 *     (PR, conventions de commit) — audience différente.
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

type Section = 'security' | 'fork' | 'self-host';
type SecurityTier = 'newbie' | 'advanced' | 'tech';

const SECTIONS: ReadonlyArray<{ id: Section; label: string; path: string }> = [
  { id: 'security', label: 'Sécurité', path: '/docs/security/newbie' },
  { id: 'fork', label: 'Reprendre le projet', path: '/docs/fork' },
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
  fork: 'Reprendre le projet — Documentation',
  'self-host': 'Auto-héberger — Documentation',
} as const;

const CANONICAL_BASE = 'https://nodea.app';

function isSection(value: unknown): value is Section {
  return value === 'security' || value === 'fork' || value === 'self-host';
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
      : section === 'fork'
        ? forkToc
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
              : section === 'fork'
                ? 'Reprendre Nodea pour soi'
                : 'Auto-héberger Nodea'}
          </h1>
        </header>

        {section === 'security' && tier === 'newbie' ? <DocsTierNewbie /> : null}
        {section === 'security' && tier === 'advanced' ? <DocsTierAdvanced /> : null}
        {section === 'security' && tier === 'tech' ? <DocsTierTech /> : null}
        {section === 'fork' ? <DocsFork /> : null}
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
      <SecurityDropdown
        activeSection={activeSection}
        activeTier={activeTier}
        onTierClick={onTierClick}
      />

      {/* Contribuer + Auto-héberger : onglets simples, navigation au clic. */}
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

/**
 * Sécurité dropdown — s'ouvre au survol, se ferme 150 ms après la
 * sortie de la souris. Le délai laisse à l'utilisateur·ice le temps
 * de traverser le petit gap entre le bouton et le panneau d'items
 * sans que le menu se replie. Le clic sur le bouton bascule aussi
 * (fallback clavier / tactile).
 */
function SecurityDropdown({
  activeSection,
  activeTier,
  onTierClick,
}: {
  activeSection: Section;
  activeTier: SecurityTier;
  onTierClick: (target: SecurityTier) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  function handleEnter(): void {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }
  function handleLeave(): void {
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 150);
  }

  // Cleanup au démontage : si le composant disparaît avant que le
  // timer ait fired, on ne veut pas qu'un setOpen tardif tape sur
  // une instance morte. React émettrait un warning sinon.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const isActive = activeSection === 'security';

  return (
    <div
      className="relative inline-flex h-full items-stretch"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Sécurité (3 niveaux de lecture)"
        className={cn(
          'inline-flex h-full cursor-pointer items-center gap-1 border-b-2 px-1 text-[13px] transition-colors duration-200',
          isActive
            ? 'border-accent font-semibold text-ink'
            : 'border-transparent text-muted hover:text-ink',
        )}
      >
        Sécurité
        <ChevronDownIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-md border border-hair bg-bg p-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]',
          )}
        >
          {SECURITY_TIERS.map((tier) => {
            const tierActive = activeSection === 'security' && activeTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onTierClick(tier.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
                  tierActive
                    ? 'bg-accent-soft font-semibold text-accent-deep'
                    : 'text-ink-soft hover:bg-bg-2 hover:text-ink',
                )}
              >
                {tier.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
