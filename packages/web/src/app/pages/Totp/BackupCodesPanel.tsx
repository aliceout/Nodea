import { useState, type ReactNode } from 'react';

import { copyWithExpiry } from '@/lib/clipboard';
import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import RowCard from '@/ui/dirk/module/RowCard';

interface BackupCodesPanelProps {
  /** Eyebrow above the title — distinguishes the surface :
   *  « Activation TOTP · 2/2 » during initial setup,
   *  « Sécurité » when regenerating from settings. */
  eyebrow: string;
  title: string;
  /** Body of the « À noter MAINTENANT » alert — different
   *  copy for first-time setup (« TOTP est activé… ») vs
   *  regeneration (« L'ancien lot est invalidé »). */
  alertBody: ReactNode;
  /** Wording on the acknowledgement checkbox. */
  ackLabel: string;
  codes: string[];
  onDone: () => void;
}

/**
 * Reusable « show these 10 backup codes ONCE » surface. Used by
 * both the initial TOTP setup (after the user types a verifying
 * code, the page advances here) and the « Régénérer » flow
 * (after a fresh password reauth, the new codes appear here).
 *
 * Lived in duplicate before the dedup — almost identical JSX
 * in `CodesPanel` and `RegenDisplayPanel`, only the eyebrow,
 * title, alert body, and ack label differed. Promoted here so
 * a tweak to the « written it down? » UX (e.g. download as
 * CSV) lands in one file.
 *
 * Note : the codes are **already persisted hashed** server-side
 * by the time we render here ; the ack checkbox is a UX gate
 * (force the user to read them) not a server-side
 * commitment — closing the tab without ticking the box keeps
 * the codes valid (no rollback).
 */
export default function BackupCodesPanel({
  eyebrow,
  title,
  alertBody,
  ackLabel,
  codes,
  onDone,
}: BackupCodesPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  function copy(): void {
    // Auto-clears after a delay (issue #137) — backup codes are account
    // recovery secrets, they shouldn't linger in the clipboard.
    void copyWithExpiry(codes.join('\n')).catch(() => undefined);
  }

  function download(): void {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodea-totp-backup-codes.txt';
    a.click();
    // Defer the revoke one tick : revoking synchronously after click()
    // can abort the download in some browsers before it's committed
    // (audit 2026-06 passe 2, Priorité 4 — same fix as the data exports).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <AuthPanelHeader eyebrow={eyebrow} title={title} />

      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">{alertBody}</p>
      </div>

      <RowCard as="div" className="mb-4">
        <ol className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] tabular-nums">
          {codes.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2 font-mono">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              <span className="text-ink">{c}</span>
            </li>
          ))}
        </ol>
      </RowCard>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={copy}
          className="flex-1"
        >
          Copier
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={download}
          className="flex-1"
        >
          Télécharger .txt
        </Button>
      </div>

      <label className="mb-4 flex items-start gap-2 text-[12.5px] text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
        />
        <span>{ackLabel}</span>
      </label>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-2 w-full"
      >
        Terminé
      </Button>
    </>
  );
}
