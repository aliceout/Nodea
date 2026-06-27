import { Cog6ToothIcon, LockClosedIcon } from '@heroicons/react/24/outline';

import { useBackgroundShade } from '@/core/theme/useBackgroundShade';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import LanguageToggle from '@/ui/dirk/preferences/LanguageToggle';
import ThemeToggle from '@/ui/dirk/preferences/ThemeToggle';

/**
 * Bottom of the sidebar: an end-to-end-encryption indicator on top, then a row
 * pairing the language picker (left) and the theme picker (right).
 *
 * The top line states the always-true encryption posture (data is sealed
 * client-side; the server only ever holds ciphertext) — a quiet, honest
 * reassurance for an app handling mental-health data. It replaced a hardcoded
 * « Synchronisé · à l'instant » placeholder that never reflected any real sync
 * state.
 *
 * The in-flight cloud-backup indicator is NOT here: it's a dedicated card
 * (`SidebarBackupCard`) ABOVE this footer's border, so a running backup reads
 * as a prominent event rather than a muted status line.
 *
 * Side-effect : also mounts `useBackgroundShade` so the user's chosen surface
 * tint is applied to `<html>` as soon as the sidebar renders post-auth. The
 * picker itself lives in the settings tab — here we just want the apply
 * lifecycle to fire on every page, the same way `ThemeToggle`'s `useTheme()`
 * call applies the theme.
 */
export default function SidebarFooter() {
  const { t } = useI18n();
  useBackgroundShade();
  return (
    <div className="-mb-2.5 mt-3 flex flex-col gap-[5px] border-t border-hair px-1.5 pt-2.5 text-[12px] text-muted">
      {/* Encryption posture — always true, so a static lock (no pulse) rather
          than a live dot. Sized + slotted exactly like the cog on the prefs
          line below so the two icons share one vertical axis. */}
      <div className="flex items-center gap-2">
        <span className="flex w-3 justify-center">
          <LockClosedIcon
            aria-hidden="true"
            className="h-[11px] w-[11px] shrink-0 text-muted"
          />
        </span>
        <span>{t('layout.encryption.label')}</span>
      </div>
      {/* Preferences — last line, indented under the encryption text so the
          two lines read as a stacked status panel à la macOS menu bar. Each
          label is a button : click cycles to the next value ; hover underlines
          + surfaces « current → next » as a tooltip. No icons, no chips — the
          footer stays purely typographic.
          5 px gap above this line so the prefs row reads as a tight follow-up
          to the line above, while the footer's -mb-2.5 still cancels half of
          the nav wrapper's py-5 below — the prefs row hugs it and the bottom
          edge of the sidebar is the breathing space. */}
      <div className="flex items-center gap-2">
        <span className="flex w-3 justify-center">
          <Cog6ToothIcon
            aria-hidden="true"
            className="h-[11px] w-[11px] shrink-0 text-muted"
          />
        </span>
        <span>
          <LanguageToggle />
          <span aria-hidden="true" className="px-2">·</span>
          <ThemeToggle />
        </span>
      </div>
    </div>
  );
}
