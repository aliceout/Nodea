import { useState, type ReactNode } from 'react';

import { splitMnemonicForDisplay } from '@/core/crypto/bip39';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { copyWithExpiry } from '@/lib/clipboard';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import RowCard from '@/ui/dirk/module/RowCard';

import { checkQuizAnswers, pickQuizPositions } from './mnemonic-quiz';

/** How many word positions the confirmation quiz asks back. */
const QUIZ_WORD_COUNT = 3;

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
  /** Label of the final CTA — « Terminé » when finishing setup
   *  from settings, « Aller à l'accueil » after recovery. */
  doneLabel: string;
  onDone: () => void;
  /** Danger-banner title/body. Default to the recovery-code wording;
   *  the encrypted-backup flow passes its own (« ces 12 mots
   *  déchiffrent ta sauvegarde »). */
  warningTitle?: ReactNode;
  warningBody?: ReactNode;
  /** Filename for the « download .txt » fallback. Defaults to the
   *  recovery-code name. */
  downloadFilename?: string;
  /** Skip the REVEAL step and go straight to the quiz. Used by the
   *  encrypted-backup export on repeat runs: the phrase is derived +
   *  stable, the user already noted it, so we don't re-show the words —
   *  we just confirm they still have them. */
  verifyOnly?: boolean;
  /** Message shown above the quiz in `verifyOnly` mode (the words are
   *  never displayed in this mode, so this explains what's happening). */
  verifyOnlyMessage?: ReactNode;
  /** When provided, a « régénérer » affordance is shown under the quiz.
   *  The backup flow uses it to rotate the derived phrase. */
  onRegenerate?: () => void;
  regenerateLabel?: string;
}

/**
 * Reusable « show this mnemonic ONCE » surface. Lives behind the
 * recovery-code KEK setup (`/recovery-code`) and (later) the auto-backup
 * mnemonic.
 *
 * Two sub-steps:
 *
 *   1. REVEAL — a « À noter MAINTENANT » danger banner, the 4×3 word
 *      grid, copy + download .txt.
 *   2. VERIFY — the words are HIDDEN and the user must re-type
 *      `QUIZ_WORD_COUNT` of them at random positions (« quel est le mot
 *      n° X ? »). This is impossible from memory, so it forces an actual
 *      transcription — strictly stronger than the old « j'ai noté »
 *      checkbox it replaces. Going back to REVEAL regenerates fresh
 *      positions, so you can't pass by learning only the quizzed slots.
 *
 * The final CTA (`onDone`) only fires once the quiz is answered
 * correctly.
 */
export default function RecoveryCodeDisplay({
  eyebrow,
  title,
  subtitle,
  mnemonic,
  doneLabel,
  onDone,
  warningTitle,
  warningBody,
  downloadFilename,
  verifyOnly = false,
  verifyOnlyMessage,
  onRegenerate,
  regenerateLabel,
}: RecoveryCodeDisplayProps) {
  const { t } = useI18n();
  const rows = splitMnemonicForDisplay(mnemonic);
  const words = mnemonic.split(' ');
  const resolvedWarningTitle =
    warningTitle ?? t('auth.recoveryDisplay.warningTitle');
  const resolvedWarningBody =
    warningBody ?? t('auth.recoveryDisplay.warningBody');
  const resolvedDownloadName = downloadFilename ?? 'nodea-recovery-code.txt';

  // In `verifyOnly` mode we open directly on the quiz (no reveal), so the
  // positions must exist from the first render — lazy-init them.
  const [phase, setPhase] = useState<'reveal' | 'verify'>(
    verifyOnly ? 'verify' : 'reveal',
  );
  const [positions, setPositions] = useState<number[]>(() =>
    verifyOnly ? pickQuizPositions(words.length, QUIZ_WORD_COUNT) : [],
  );
  const [answers, setAnswers] = useState<string[]>(() =>
    verifyOnly
      ? Array.from({ length: Math.min(QUIZ_WORD_COUNT, words.length) }, () => '')
      : [],
  );
  const [failed, setFailed] = useState(false);

  function startVerify(): void {
    const next = pickQuizPositions(words.length, QUIZ_WORD_COUNT);
    setPositions(next);
    setAnswers(next.map(() => ''));
    setFailed(false);
    setPhase('verify');
  }

  function backToReveal(): void {
    // Re-revealing regenerates fresh positions on the next verify, so a
    // user can't pass by memorising only the slots they were quizzed on.
    setFailed(false);
    setPhase('reveal');
  }

  function submitVerify(): void {
    if (checkQuizAnswers(words, positions, answers)) {
      onDone();
    } else {
      setFailed(true);
    }
  }

  async function copyToClipboard(): Promise<void> {
    try {
      // Auto-clears after a delay (issue #137) — the recovery code
      // unlocks the whole account, don't let it linger.
      await copyWithExpiry(mnemonic);
    } catch {
      // Browsers without clipboard permission (or insecure context) —
      // silently fail. The user can transcribe by hand from the grid.
    }
  }

  function downloadAsTxt(): void {
    const blob = new Blob([mnemonic + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resolvedDownloadName;
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

      {phase === 'reveal' ? (
        <>
          <InlineAlert className="mb-4">
            <p className="font-semibold">{resolvedWarningTitle}</p>
            <p className="mt-1 text-ink-soft">{resolvedWarningBody}</p>
          </InlineAlert>

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
              {t('common.actions.copy')}
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="md"
              onClick={downloadAsTxt}
              className="flex-1"
            >
              {t('auth.recoveryDisplay.downloadTxt')}
            </Button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={startVerify}
            className="mt-2 w-full"
          >
            {t('auth.recoveryDisplay.toVerify')}
          </Button>
        </>
      ) : (
        <>
          <p className="mb-4 text-[13px] leading-[1.5] text-ink-soft">
            {verifyOnly ? verifyOnlyMessage : t('auth.recoveryDisplay.verifyIntro')}
          </p>

          {positions.map((pos, i) => (
            <Field
              key={pos}
              label={t('auth.recoveryDisplay.wordLabel', {
                values: { position: pos + 1 },
              })}
              value={answers[i] ?? ''}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
                if (failed) setFailed(false);
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              {...(failed ? { 'aria-invalid': true as const } : {})}
            />
          ))}

          {failed ? (
            <InlineAlert className="mb-3">
              {t('auth.recoveryDisplay.verifyError')}
            </InlineAlert>
          ) : null}

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={submitVerify}
            disabled={answers.some((a) => a.trim() === '')}
            className="mt-2 w-full"
          >
            {doneLabel}
          </Button>

          <div className="mt-4 flex flex-col items-center gap-2 text-[12.5px]">
            {!verifyOnly ? (
              <button
                type="button"
                onClick={backToReveal}
                className="cursor-pointer text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('auth.recoveryDisplay.reReveal')}
              </button>
            ) : null}
            {onRegenerate ? (
              <button
                type="button"
                onClick={onRegenerate}
                className="cursor-pointer text-muted transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {regenerateLabel}
              </button>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
