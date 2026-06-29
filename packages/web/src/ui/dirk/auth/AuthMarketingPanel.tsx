import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

import { fetchPublicConfig } from '@/core/api/public-config';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import NodeaSymbol from '@/ui/branding/NodeaSymbol';

/**
 * The optional helpdesk/support URL for this instance, fetched once from the
 * API's public `GET /config`. Returns `null` until it resolves (or when the
 * operator left it unset) — the footer then renders no helpdesk link.
 */
function useHelpdeskUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchPublicConfig().then((cfg) => {
      if (alive) setUrl(cfg.helpdeskUrl);
    });
    return () => {
      alive = false;
    };
  }, []);
  return url;
}

/**
 * Shared marketing aside used by every auth page (Login, Register,
 * Request-reset). The shell is identical — Nodea logo top-left,
 * tagline middle, trust-marks at the bottom — only the headline and
 * body copy change per page.
 *
 * Centralising this means the three pages can't drift on chrome
 * (border, padding, badge wording) the way they did before — the
 * footer used to read "AGPL-3.0" on Login but the user wanted
 * "Open-source", and any page that didn't get the memo would have
 * stayed on the old copy.
 *
 * Renders only on `lg+` (`hidden … lg:flex`); the auth form panel
 * occupies the whole viewport on smaller screens, so the marketing
 * copy gets dropped rather than stacked. That's the intent of the
 * existing two-column layout.
 */
interface AuthMarketingPanelProps {
  /** Big headline (one line is the design — no wrapping intended). */
  headline: string;
  /** Body copy below the headline. Pass `<PrivacyBody />` for the
   * standard tagline, or a page-specific block (see RequestReset for
   * an example of recovery-specific copy). */
  children: ReactNode;
}

export default function AuthMarketingPanel({ headline, children }: AuthMarketingPanelProps) {
  const { t } = useI18n();
  const helpdeskUrl = useHelpdeskUrl();
  return (
    <aside className="hidden flex-col justify-between border-r border-hair bg-bg-2 px-[72px] py-16 lg:flex">
      <div className="flex items-center gap-2.5">
        <NodeaSymbol className="h-8 w-8 text-accent" />
        <span className="text-[25px] font-semibold tracking-[-0.01em] text-ink">Nodea</span>
      </div>

      {/* Headline + body share a 720 px max-width so the body text
          wraps at the same right edge the headline naturally ends —
          no awkward gap between "title ends here" and "paragraph
          ends earlier". The H1 keeps its 18 px bottom margin so the
          first paragraph sits a touch lower than `space-y-4` would
          place subsequent ones (visual hierarchy: the gap below
          the title reads bigger than gaps between paragraphs). */}
      <div className="animate-fade-up max-w-[720px]">
        <h1 className="mb-[18px] text-[56px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          {headline}
        </h1>
        <div className="space-y-4">{children}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-muted">
        <span>{t('layout.marketing.selfHostable')}</span>
        <span>·</span>
        {/* « Open-source » is a claim, so link it to the actual code
            — readers shouldn't have to take our word for it. Styled
            as an explicit external link (accent color + underline +
            outbound arrow) so it reads as clickable without the
            user having to hover-and-discover. New tab via
            `target="_blank"` so the auth flow isn't interrupted;
            `rel="noopener noreferrer"` is the usual hardening for
            external links that open from a logged-out surface. */}
        <a
          href="https://github.com/aliceout/Nodea"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('layout.marketing.openSource')}
          <ArrowTopRightOnSquareIcon
            className="h-3 w-3"
            aria-hidden="true"
          />
        </a>
        <span>·</span>
        {/* Public docs entry — short label matching the register
            of the surrounding items. The verbose "Voir comment
            Nodea protège mes données" entry lives in the marketing
            panel body (under PrivacyBody); this footer link is the
            always-reachable equivalent for skimmers. */}
        <Link
          to="/docs/newbie"
          className="cursor-pointer rounded-[2px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('layout.marketing.security')}
        </Link>
        <span>·</span>
        {/* Legal — accent-styled like « Open-source » / « Sécurité » so
            every clickable item in the row reads the same. Shared by every
            auth page through this one footer (desktop-only). */}
        <Link
          to="/terms"
          className="cursor-pointer rounded-[2px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('layout.marketing.terms')}
        </Link>
        {/* Helpdesk / support — per-instance URL from the public /config
            endpoint (sourced from Infisical). External, so the same
            outbound treatment as « Open-source ». Hidden when unset. */}
        {helpdeskUrl ? (
          <>
            <span>·</span>
            <a
              href={helpdeskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('layout.marketing.helpdesk')}
              <ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden="true" />
            </a>
          </>
        ) : null}
        <span>·</span>
        {/* Version → changelog. The label is the repo-root package.json
            version (build-time `__APP_VERSION__`); the link still opens the
            changelog so the number doubles as "what's in this build". */}
        <Link
          to="/changelog"
          className="cursor-pointer rounded-[2px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          v{__APP_VERSION__}
        </Link>
      </div>
    </aside>
  );
}

/**
 * Standard tagline — three short paragraphs each carrying their own
 * beat: what the app does, who can read your data, what we
 * deliberately don't do. Used by Login and Register.
 *
 * Kept in this file rather than sprinkled across the auth pages so
 * a copy tweak (e.g. "Nodea" → "l'équipe Nodea") only happens once.
 * Recovery / change-password / activate pages have flow-specific
 * copy — they pass their own children to {@link AuthMarketingPanel}
 * directly.
 */
export function PrivacyBody() {
  const { t } = useI18n();
  return (
    <>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        {t('layout.marketing.body.purpose')}
      </p>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        {t('layout.marketing.body.encryption', { values: { brand: 'Nodea' } })}
      </p>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        {t('layout.marketing.body.noTracking')}
      </p>
    </>
  );
}
