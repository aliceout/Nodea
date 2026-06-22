import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';

/**
 * Shared « confirm with your password » form — the single re-auth UI
 * across the app's sensitive-action tunnels (data export, encrypted
 * backup, account deletion, security-mode change). Mechanically these
 * already shared the same back-end proof (`freshenPasswordReauth` /
 * `changeSecurityMode`, Auth-Spec §5.3/§6) ; this unifies the
 * presentation so every re-verification looks and behaves the same.
 *
 * Built on the shared `Field` atom (same input chrome + inline,
 * aria-wired error as every other auth page) — never roll a bespoke
 * password input.
 *
 * **UI only — never calls the network itself.** The parent owns the
 * actual proof + error message in `onConfirm` / `error`, because the
 * call differs per surface. Contract: `onConfirm` resolves on handled
 * outcomes (it sets its own `error`) ; the password field is cleared
 * once it resolves.
 *
 * Flexible « simple vs. double » : pass `children` to render extra
 * fields above the password (e.g. DeleteAccount's « retype your
 * email ») and `canConfirm` for the parent's extra gate (e.g. email
 * matches), AND-ed with the built-in « password non-empty » check.
 */
interface PasswordReauthFormProps {
  /** Optional instruction text above the fields. */
  prompt?: ReactNode;
  /** Extra fields rendered above the password (the « double » form). */
  children?: ReactNode;
  /** Parent gate AND-ed with « password non-empty ». Defaults to `true`. */
  canConfirm?: boolean;
  /** Visible label for the password field. */
  passwordLabel: string;
  /** Re-auth error surfaced inline under the field (role=alert, aria
   *  wired by `Field`). */
  error?: string | undefined;
  confirmLabel: string;
  /** Shown on the confirm button while `submitting` (falls back to
   *  `confirmLabel`). */
  submittingLabel?: string;
  /** When provided, a cancel button is rendered. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** Confirm button tone — `danger` for destructive actions. */
  tone?: 'primary' | 'danger';
  submitting?: boolean;
  /** Focus the password field on mount. Pass `false` when an extra
   *  field above should take focus first. Works inside a Headless UI
   *  `<Modal>` too: focus is set via a ref one frame after mount,
   *  because the Dialog focus trap claims initial focus and ignores the
   *  native `autofocus` attribute (it only honours `[data-autofocus]`). */
  autoFocus?: boolean;
  /** `'sm'` (default) for compact inline use ; `'lg'` for a full-width
   *  prominent button on a dedicated auth-panel page (the tunnels). */
  size?: 'sm' | 'lg';
  onConfirm: (password: string) => Promise<void> | void;
}

export default function PasswordReauthForm({
  prompt,
  children,
  canConfirm = true,
  passwordLabel,
  error,
  confirmLabel,
  submittingLabel,
  cancelLabel,
  onCancel,
  tone = 'primary',
  submitting = false,
  autoFocus = true,
  size = 'sm',
  onConfirm,
}: PasswordReauthFormProps) {
  const [password, setPassword] = useState('');
  const allowed = !submitting && password.length > 0 && canConfirm;
  const large = size === 'lg';

  // Focus the field via a ref + rAF rather than the native `autoFocus`
  // attribute. When this form is mounted inside a Headless UI `<Modal>`
  // (the SessionsCard re-auth gate) the Dialog focus trap grabs initial
  // focus and only honours `[data-autofocus]`, so native autofocus is
  // silently dropped. Deferring one frame runs after the trap and after
  // the panel's enter transition, landing focus on the password field in
  // both the modal and the inline auth-panel tunnels.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return undefined;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [autoFocus]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!allowed) return;
    await onConfirm(password);
    setPassword('');
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {prompt ? <p className="mb-2 text-[12.5px] text-ink-soft">{prompt}</p> : null}
      {children}
      <Field
        ref={inputRef}
        label={passwordLabel}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <div className={large ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <Button
          type="submit"
          variant={tone}
          size={large ? 'lg' : 'sm'}
          disabled={!allowed}
          className={large ? 'w-full' : ''}
        >
          {submitting ? (submittingLabel ?? confirmLabel) : confirmLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="neutral"
            size={large ? 'lg' : 'sm'}
            onClick={onCancel}
            disabled={submitting}
            className={large ? 'w-full' : ''}
          >
            {cancelLabel ?? ''}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
