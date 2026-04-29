import { cn } from '@/lib/utils';

interface StrengthBarProps {
  score: 0 | 1 | 2 | 3 | 4;
  warning: string | null;
  /** Whether all five canonical rules are met. When `false` we
   *  cap the displayed score at 1 so a long-but-rule-failing
   *  password (« aaaaaaaaaaaaaaa ») doesn't read as « Solide »
   *  via zxcvbn alone. */
  rulesOk: boolean;
}

/**
 * Five-band zxcvbn strength bar surfaced under every password
 * input on Register / Recover / ChangePassword. Bands fill from
 * left to right ; the colour ramp goes low → low-soft →
 * accent-soft → accent as the score rises, and the trailing
 * label (« Trop faible » / « Moyen » / « Solide » / « Très
 * solide ») reads the same value.
 *
 * The score is gated on `rulesOk` : a password that doesn't
 * pass the five rules reads as « Trop faible » regardless of
 * what zxcvbn computed, because the rules list is what the
 * server actually enforces.
 *
 * Lived in triple before the dedup — same JSX in
 * `Register.tsx`, `Recover.tsx`, `ChangePassword.tsx`
 * (byte-for-byte identical). Promoted here so the colour ramp
 * stays consistent with `PasswordRulesList` everywhere it's
 * surfaced.
 */
export default function StrengthBar({
  score: rawScore,
  warning,
  rulesOk,
}: StrengthBarProps) {
  const score: 0 | 1 | 2 | 3 | 4 = rulesOk
    ? rawScore
    : rawScore > 1
      ? 1
      : rawScore;

  const bandTone = (i: number): string => {
    if (i > score) return 'bg-hair';
    if (score <= 1) return 'bg-low';
    if (score === 2) return 'bg-low-soft';
    if (score === 3) return 'bg-accent-soft';
    return 'bg-accent';
  };
  const label =
    score <= 1
      ? 'Trop faible'
      : score === 2
        ? 'Moyen'
        : score === 3
          ? 'Solide'
          : 'Très solide';

  return (
    <div className="-mt-2 mb-3">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn('h-1 flex-1 rounded-full transition-colors', bandTone(i))}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Force&nbsp;: <span className="font-medium text-ink-soft">{label}</span>
        {warning ? <span className="text-low-deep"> — {warning}</span> : null}
      </p>
    </div>
  );
}
