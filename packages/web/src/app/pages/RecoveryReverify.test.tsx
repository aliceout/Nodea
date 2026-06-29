// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ navigate: vi.fn(), reverify: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock('@/i18n/I18nProvider.jsx', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/core/auth/use-session', () => ({
  useSession: () => ({ reverifyRecoveryCode: h.reverify }),
}));

import { MemoryRouter } from 'react-router-dom';

import { useNodeaStore } from '@/core/store/nodea-store';
import type { SessionUser } from '@/core/store/slices/auth';

import RecoveryReverify from './RecoveryReverify';

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'a@b.co',
    username: null,
    role: 'user',
    onboardingStatus: 'complete',
    onboardingVersion: '1',
    recoveryCodeSet: true,
    recoveryReverifyDue: true,
    passkeysCount: 1,
    passkeysPrfCount: 1,
    totpEnabled: true,
    totpBackupCodesRemaining: 10,
    securityMode: 'password_or_passkey',
    ...overrides,
  };
}

function renderPage(overrides: Partial<SessionUser> = {}) {
  useNodeaStore.getState().setAuth(user(overrides));
  render(
    <MemoryRouter>
      <RecoveryReverify />
    </MemoryRouter>,
  );
}

const TWELVE = 'a b c d e f g h i j k l';
const textarea = () =>
  screen.getByLabelText('auth.recoveryReverify.mnemonicLabel') as HTMLTextAreaElement;
const submit = () =>
  screen.getByRole('button', { name: 'auth.recoveryReverify.submit' }) as HTMLButtonElement;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  useNodeaStore.getState().setAuth(null);
});

describe('RecoveryReverify page', () => {
  it('redirects to /recovery-code when no code is set (nothing to re-verify)', () => {
    renderPage({ recoveryCodeSet: false });
    expect(h.navigate).toHaveBeenCalledWith('/recovery-code', { replace: true });
  });

  it('gates the submit on exactly 12 words', () => {
    renderPage();
    fireEvent.change(textarea(), { target: { value: 'a b c d e f g h i j k' } }); // 11
    expect(submit().disabled).toBe(true);
    fireEvent.change(textarea(), { target: { value: TWELVE } }); // 12
    expect(submit().disabled).toBe(false);
  });

  it('a bad-checksum phrase (client throw) surfaces « code invalide » + the regenerate escalation', async () => {
    h.reverify.mockRejectedValue(new Error('invalid_recovery_code'));
    renderPage();
    fireEvent.change(textarea(), { target: { value: TWELVE } });
    fireEvent.click(submit());

    expect(await screen.findByText('errors.recovery.invalidCode')).toBeTruthy();
    // The calm escalation link only appears after a failure.
    expect(screen.getByText('auth.recoveryReverify.regenerate.cta')).toBeTruthy();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('a server 401 surfaces the SAME message (no oracle on which leg failed)', async () => {
    h.reverify.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { status: 401, error: 'invalid_credentials' }),
    );
    renderPage();
    fireEvent.change(textarea(), { target: { value: TWELVE } });
    fireEvent.click(submit());

    expect(await screen.findByText('errors.recovery.invalidCode')).toBeTruthy();
  });

  it('on success navigates back to /flow', async () => {
    h.reverify.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(textarea(), { target: { value: TWELVE } });
    fireEvent.click(submit());

    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith('/flow', { replace: true }),
    );
    expect(h.reverify).toHaveBeenCalledWith(TWELVE);
  });
});
