import type { ReactNode } from 'react';

interface AuthPanelHeaderProps {
  /** Small muted line above the title — typically the section /
   *  flow name (« Connexion », « Sécurité », « Récupération »).
   *  Optional: omitted on the rare panel that doesn't carry a
   *  category label. */
  eyebrow?: ReactNode;
  /** The 24-px panel title — the H2 of the form column. */
  title: ReactNode;
  /** Body copy displayed under the title in 13.5-px ink-soft.
   *  Optional: some headers stand on their own without intro
   *  copy (typically the « Sent » / « Done » confirmation panels
   *  which lead directly into a status block). */
  subtitle?: ReactNode;
}

/**
 * Header triplet (eyebrow + h2 + subtitle) used on every auth
 * panel of the app — Login, Register, Reset, Recover, the four
 * Passkeys views, the five TOTP stages, the four LoginMfa
 * substates, ChangePassword, RequestReset, RecoveryCode,
 * BypassConfirm, SecurityMode, etc. ~30 call sites used to
 * inline the same three lines verbatim.
 *
 * The eyebrow + subtitle are optional so the atom covers panels
 * that only carry a heading or only lead into a status block.
 */
export default function AuthPanelHeader({
  eyebrow,
  title,
  subtitle,
}: AuthPanelHeaderProps) {
  return (
    <>
      {eyebrow ? (
        <p className="mb-1 text-[13px] text-muted">{eyebrow}</p>
      ) : null}
      <h2
        className={
          subtitle
            ? 'mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink'
            : 'mb-7 text-[24px] font-semibold tracking-[-0.02em] text-ink'
        }
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
          {subtitle}
        </p>
      ) : null}
    </>
  );
}
