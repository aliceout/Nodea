// @vitest-environment jsdom
import { type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Identity `t` → assert on i18n KEYS, locale-independent. Replaces the module
// for every consumer in the tree (AuthPanelHeader, Field, Button, LostFlow…).
vi.mock('@/i18n/I18nProvider.jsx', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

import ChooseFactorStep from './ChooseFactorStep';

afterEach(cleanup);

type Props = ComponentProps<typeof ChooseFactorStep>;

function renderStep(overrides: Partial<Props> = {}) {
  const props: Props = {
    totpMode: 'code',
    code: '',
    submitting: false,
    pendingFactor: null,
    canSubmit: true,
    error: null,
    lost: { kind: 'idle' },
    onCodeChange: vi.fn(),
    onSwitchToBackup: vi.fn(),
    onSubmitTotp: vi.fn((e) => e.preventDefault()),
    onPasskey: vi.fn(),
    onStartLostTotp: vi.fn(),
    onStartLostPasskey: vi.fn(),
    onCancelLost: vi.fn(),
    onConfirmLost: vi.fn(),
    onRestartLogin: vi.fn(),
    ...overrides,
  };
  render(<ChooseFactorStep {...props} />);
  return props;
}

const submitBtn = () => screen.getByRole('button', { name: 'common.actions.verify' });
const passkeyBtn = () =>
  screen.getByRole('button', { name: 'auth.mfa.combined.passkeyCta' });

describe('ChooseFactorStep (merged 2FA screen)', () => {
  it('shows BOTH entry points on one screen: the TOTP field and the passkey button', () => {
    renderStep();
    expect(screen.getByLabelText('auth.mfa.totp.codeLabel')).toBeTruthy();
    expect(passkeyBtn()).toBeTruthy();
  });

  it('submitting the form calls onSubmitTotp only (not onPasskey)', () => {
    const props = renderStep();
    fireEvent.click(submitBtn());
    expect(props.onSubmitTotp).toHaveBeenCalledTimes(1);
    expect(props.onPasskey).not.toHaveBeenCalled();
  });

  it('clicking the passkey button calls onPasskey only (not onSubmitTotp)', () => {
    const props = renderStep();
    fireEvent.click(passkeyBtn());
    expect(props.onPasskey).toHaveBeenCalledTimes(1);
    expect(props.onSubmitTotp).not.toHaveBeenCalled();
  });

  it('disables the TOTP submit when canSubmit is false', () => {
    renderStep({ canSubmit: false });
    expect((submitBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  it('pendingFactor="totp": only the submit reads busy — no cross-talk to the passkey button', () => {
    renderStep({ pendingFactor: 'totp', submitting: true, canSubmit: false });
    // Submit shows the busy label…
    expect(screen.getByRole('button', { name: 'common.states.verifying' })).toBeTruthy();
    // …while the passkey button keeps its own idle CTA.
    expect(passkeyBtn()).toBeTruthy();
  });

  it('pendingFactor="passkey": only the passkey button reads busy', () => {
    renderStep({ pendingFactor: 'passkey', submitting: true, canSubmit: false });
    // The busy label is the passkey button; the submit keeps its idle label.
    expect(screen.getByRole('button', { name: 'common.states.verifying' })).toBeTruthy();
    expect(submitBtn()).toBeTruthy();
  });

  it('submitting=true disables every control so a pending ceremony cannot be swapped out', () => {
    renderStep({ submitting: true, canSubmit: false });
    expect((passkeyBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'auth.mfa.totp.switchToBackup' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'auth.mfa.passkey.lostPasskey' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'auth.mfa.restartLogin' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('renders the error in a live region (role=alert)', () => {
    renderStep({ error: 'auth.mfa.errors.wrongCode' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('auth.mfa.errors.wrongCode');
  });

  it('backup mode: shows the backup field + the danger email-recovery button, not the switch link', () => {
    renderStep({ totpMode: 'backup' });
    expect(screen.getByLabelText('auth.mfa.totp.backupLabel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'auth.mfa.requestEmailRecovery' })).toBeTruthy();
    expect(screen.queryByText('auth.mfa.totp.switchToBackup')).toBeNull();
  });

  it('a recovery flow in progress takes over the panel (idle controls hidden)', () => {
    renderStep({ lost: { kind: 'confirm', factor: 'totp', submitting: false } });
    expect(screen.queryByLabelText('auth.mfa.totp.codeLabel')).toBeNull();
    expect(screen.queryByRole('button', { name: 'auth.mfa.combined.passkeyCta' })).toBeNull();
  });
});
