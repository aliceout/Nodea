import { PASSWORD_MIN_LENGTH, type PasswordRulesCheck } from '@nodea/shared';

import { cn } from '@/lib/utils';

interface PasswordRulesListProps {
  rules: PasswordRulesCheck;
}

const RULE_LABELS: Array<{ key: keyof PasswordRulesCheck; label: string }> = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH} caractères minimum` },
  { key: 'lowercase', label: 'une minuscule' },
  { key: 'uppercase', label: 'une majuscule' },
  { key: 'digit', label: 'un chiffre' },
  { key: 'special', label: 'un caractère spécial' },
];

/**
 * Live checklist of the five canonical password rules — surfaced
 * above every password input on Register / Recover /
 * ChangePassword. Each row toggles between « unmet » (muted, no
 * tick) and « met » (accent, tick) as the user types ; the form's
 * submit gate reads `passwordRulesPassed(rules)` from
 * `@nodea/shared`, so this list and the gate stay in lockstep.
 *
 * Lived in triple before the dedup — same JSX in
 * `Register.tsx`, `Recover.tsx`, `ChangePassword.tsx` (compared
 * with `diff`, byte-for-byte identical). Promoted here so a
 * change to the rule layout (or to `PASSWORD_MIN_LENGTH`)
 * propagates everywhere.
 */
export default function PasswordRulesList({ rules }: PasswordRulesListProps) {
  return (
    <ul className="-mt-2 mb-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px]">
      {RULE_LABELS.map(({ key, label }) => {
        const ok = rules[key];
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-1.5',
              ok ? 'text-accent-deep' : 'text-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-block h-3 w-3 shrink-0 rounded-full text-center text-[9px] leading-3 transition-colors',
                ok ? 'bg-accent text-white' : 'border border-hair bg-bg',
              )}
            >
              {ok ? '✓' : ''}
            </span>
            {label}
          </li>
        );
      })}
    </ul>
  );
}
