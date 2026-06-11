import type { ReactNode } from 'react';

import { splitMnemonicForDisplay } from '@/core/crypto/bip39';
import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import RowCard from '@/ui/dirk/module/RowCard';

interface RecoveryCodeDisplayProps {
  /** Eyebrow above the heading — distinguishes the surface
   *  context (« Sécurité » when configuring from settings,
   *  « Récupération » after a successful BIP39 recovery). */
  eyebrow: string;
  /** Heading shown above the mnemonic grid. */
  title: ReactNode;
  /** Optional one-liner under the heading (`Recover` adds a
   *  « ton ancien code a été invalidé » note ;
   *  `RecoveryCode` doesn't). */
  subtitle?: ReactNode;
  /** The 12-word mnemonic — single space-joined string. */
  mnemonic: string;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  /** Label of the final CTA — « Terminé » when finishing setup
   *  from settings, « Aller à l'accueil » after recovery. */
  doneLabel: string;
  onDone: () => void;
}

/**
 * Reusable « show this mnemonic ONCE » surface. Lives behind
 * the recovery-code KEK setup (`/recovery-code`) and the
 * post-recovery code rotation (`/recover`). Both surfaces wrap
 * the same flow :
 *
 *   1. A weighty « À noter MAINTENANT » danger banner — closing
 *      the page without writing the words down means the code
 *      is gone for good.
 *   2. A 4×3 grid of `n. word` rows in monospace.
 *   3. Copy + Download .txt buttons. Clipboard failures are
 *      silenced ; the user can transcribe by hand from the
 *      visible grid. Download is always available.
 *   4. A confirmation checkbox the user must tick before the
 *      final CTA enables — the « did you really save it? » gate.
 *
 * Lived in duplicate before the dedup — almost identical JSX in
 * `RecoveryCode.tsx` and `Recover.tsx`, only the header lines
 * and the CTA label differed. Promoted here so a future tweak
 * to the « written it down? » UX (e.g. « download as PDF »)
 * lands in one file.
 */
export default function RecoveryCodeDisplay({
  eyebrow,
  title,
  subtitle,
  mnemonic,
  acknowledged,
  setAcknowledged,
  doneLabel,
  onDone,
}: RecoveryCodeDisplayProps) {
  const rows = splitMnemonicForDisplay(mnemonic);

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mnemonic);
    } catch {
      // Browsers without clipboard permission (or insecure
      // context) — silently fail. The user can transcribe by
      // hand from the visible grid.
    }
  }

  function downloadAsTxt(): void {
    const blob = new Blob([mnemonic + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodea-recovery-code.txt';
    a.click();
    // Defer the revoke one tick : a synchronous revoke after click()
    // can abort the download before it commits in some browsers
    // (audit 2026-06 passe 2, Priorité 4 — same fix as the data exports).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={eyebrow}
        title={title}
        {...(subtitle !== undefined ? { subtitle } : {})}
      />

      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">À noter MAINTENANT</p>
        <p className="mt-1 text-ink-soft">
          Ces 12 mots ne te seront jamais re-affichés. Recopie-les sur papier ou
          dans un gestionnaire de mots de passe — sans eux, oublier ton mot de
          passe = perte de toutes tes données.
        </p>
      </div>

      <RowCard as="div" className="mb-4">
        <ol className="grid grid-cols-3 gap-x-4 gap-y-2 text-[13px] tabular-nums">
          {rows.flat().map((word, i) => (
            <li key={i} className="flex items-baseline gap-2 font-mono">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              <span className="text-ink">{word}</span>
            </li>
          ))}
        </ol>
      </RowCard>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={copyToClipboard}
          className="flex-1"
        >
          Copier
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={downloadAsTxt}
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
          className="mt-0.5 h-4 w-4 cursor-pointer rounded-[var(--radius-input)] border border-hair accent-accent"
        />
        <span>J’ai noté ces 12 mots et je les ai mis dans un endroit sûr.</span>
      </label>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-2 w-full"
      >
        {doneLabel}
      </Button>
    </>
  );
}
