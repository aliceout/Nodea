// @vitest-environment jsdom
import { type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PasswordReauthForm from './PasswordReauthForm';

// Auto-cleanup isn't wired (vitest runs without `globals`), so unmount
// between tests — otherwise each render stacks another form in the body
// and the label queries match « multiple elements ».
afterEach(cleanup);

/**
 * Guards the shared re-auth submit gate — the single chokepoint in
 * front of three sensitive actions (data export, account deletion,
 * security-mode change). The gate is `!submitting && password.length>0
 * && canConfirm` ; a regression here (e.g. `&&`→`||` on canConfirm, or
 * clearing the field before `onConfirm` resolves) would silently weaken
 * all three. These assertions fail loudly if that happens.
 */
function renderForm(
  overrides: Partial<ComponentProps<typeof PasswordReauthForm>> = {},
) {
  const onConfirm = vi.fn(async (_password: string) => {});
  render(
    <PasswordReauthForm
      passwordLabel="Mot de passe"
      confirmLabel="Confirmer"
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  const input = screen.getByLabelText('Mot de passe') as HTMLInputElement;
  const button = screen.getByRole('button', { name: 'Confirmer' }) as HTMLButtonElement;
  return { onConfirm, input, button };
}

describe('PasswordReauthForm', () => {
  it('disables confirm while the password is empty', () => {
    const { button } = renderForm();
    expect(button.disabled).toBe(true);
  });

  it('keeps confirm disabled when canConfirm is false, even with a password', () => {
    const { input, button } = renderForm({ canConfirm: false });
    fireEvent.change(input, { target: { value: 'hunter2' } });
    expect(button.disabled).toBe(true);
  });

  it('enables confirm once a password is typed (default canConfirm)', () => {
    const { input, button } = renderForm();
    fireEvent.change(input, { target: { value: 'hunter2' } });
    expect(button.disabled).toBe(false);
  });

  it('passes the typed password to onConfirm', async () => {
    const { input, button, onConfirm } = renderForm();
    fireEvent.change(input, { target: { value: 'hunter2' } });
    fireEvent.click(button);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('hunter2'));
  });

  it('clears the field after onConfirm resolves', async () => {
    const { input, button } = renderForm();
    fireEvent.change(input, { target: { value: 'hunter2' } });
    fireEvent.click(button);
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('does not submit when submitting (no double-fire)', () => {
    const { input, button, onConfirm } = renderForm({ submitting: true });
    fireEvent.change(input, { target: { value: 'hunter2' } });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Focus is driven by a ref + rAF (not the native autoFocus attribute)
  // so it survives the Headless UI modal focus trap — see the component's
  // autoFocus doc. These guard that the field actually receives focus.
  it('focuses the password field on mount when autoFocus (default)', async () => {
    const { input } = renderForm();
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('does not focus the password field when autoFocus is false', async () => {
    const { input } = renderForm({ autoFocus: false });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(document.activeElement).not.toBe(input);
  });
});
