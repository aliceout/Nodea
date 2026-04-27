import type { ReactNode } from 'react';

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
  return (
    <aside className="hidden flex-col justify-between border-r border-hair bg-bg-2 px-[72px] py-16 lg:flex">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
        <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Nodea</span>
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

      <div className="flex gap-3.5 text-[12px] text-muted">
        <span>Chiffré côté client</span>
        <span>·</span>
        <span>Open-source</span>
        <span>·</span>
        <span>Auto-hébergeable</span>
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
  return (
    <>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        Un espace pour écrire, faire le point, suivre tes humeurs, tes lectures,
        ce que tu vises.
      </p>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        Toutes les données sont chiffrées côté client. Illisibles pour d’autres,
        même pour l’équipe de Nodea — tu es la seule personne à y avoir accès.
      </p>
      <p className="text-[18px] leading-[1.5] text-ink-soft">
        Pas de tracking, pas de cookie, pas de pub, pas de surveillance.
      </p>
    </>
  );
}
