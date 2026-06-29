// @vitest-environment jsdom
import { type ReactNode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Orchestrator tests for the stepped-MFA page (`LoginMfa/index.tsx`). The
 * visual surfaces (ChooseFactorStep / TotpStep / PasskeyStep / LostFlow) have
 * their own tests; this covers the bits ONLY the orchestrator owns:
 *   - initial step selection from the navigation state (picker vs TOTP, and
 *     the reload fallback);
 *   - verify wiring (finalized → /flow, not-finalized → applyMissing step hop);
 *   - centralized API-error mapping (401 unauth → sessionExpired + delayed
 *     /login, 429 → tooManyAttempts, WebAuthn cancel → passkeyCancelled);
 *   - the lost-factor escalation (bypass request → sent / 409 walls / 401).
 *
 * `useNavigate` is spied; `useLocation` stays real so the MemoryRouter entry's
 * `state` flows through exactly as in prod. `useI18n` is the identity so we
 * assert on keys, locale-independent.
 */
const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  session: {
    verifyMfaTotp: vi.fn(),
    verifyMfaPasskey: vi.fn(),
    verifyMfaPassword: vi.fn(),
    requestMfaBypass: vi.fn(),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock('@/i18n/I18nProvider.jsx', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/core/auth/use-session', () => ({ useSession: () => h.session }));
// The orchestrator's job isn't the marketing chrome — render-through the
// layout so the test stays focused on step/verify/error logic (and immune to
// AuthMarketingPanel's build-time globals).
vi.mock('@/ui/dirk/auth/AuthLayout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

import { MemoryRouter } from 'react-router-dom';

import LoginMfaPage from './index';

type NavState = {
  factorsNeeded?: ReadonlyArray<'totp' | 'passkey' | 'password'>;
  secondFactorChoice?: boolean;
} | null;

function renderMfa(state: NavState = null) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login/mfa', state }]}>
      <LoginMfaPage />
    </MemoryRouter>,
  );
}

const PICKER_STATE: NavState = {
  factorsNeeded: ['totp', 'passkey'],
  secondFactorChoice: true,
};

const totpField = () =>
  screen.getByLabelText('auth.mfa.totp.codeLabel') as HTMLInputElement;
const verifyBtn = () =>
  screen.getByRole('button', { name: 'common.actions.verify' }) as HTMLButtonElement;
const passkeyBtn = () =>
  screen.getByRole('button', { name: 'auth.mfa.combined.passkeyCta' }) as HTMLButtonElement;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginMfa — step selection', () => {
  it('shows the merged picker when secondFactorChoice + both factors are needed', () => {
    renderMfa(PICKER_STATE);
    expect(screen.getByText('auth.mfa.combined.title')).toBeTruthy();
    expect(totpField()).toBeTruthy();
    expect(passkeyBtn()).toBeTruthy();
  });

  it('falls back to the TOTP step when only one factor is listed (AND-guard on both)', () => {
    renderMfa({ factorsNeeded: ['totp'], secondFactorChoice: true });
    expect(screen.getByText('auth.mfa.totp.titleCode')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'auth.mfa.combined.passkeyCta' })).toBeNull();
  });

  it('falls back to the TOTP step when secondFactorChoice is false even with both factors', () => {
    renderMfa({ factorsNeeded: ['totp', 'passkey'], secondFactorChoice: false });
    expect(screen.getByText('auth.mfa.totp.titleCode')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'auth.mfa.combined.passkeyCta' })).toBeNull();
  });

  it('falls back to the TOTP step on reload (navState null), not a crash', () => {
    renderMfa(null);
    expect(screen.getByText('auth.mfa.totp.titleCode')).toBeTruthy();
  });
});

describe('LoginMfa — TOTP verify wiring', () => {
  function renderTotpAndType() {
    renderMfa(null);
    fireEvent.change(totpField(), { target: { value: '123456' } });
  }

  it('finalized → navigates to /flow', async () => {
    h.session.verifyMfaTotp.mockResolvedValue({ finalized: true });
    renderTotpAndType();
    fireEvent.click(verifyBtn());
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/flow', { replace: true }));
    expect(h.session.verifyMfaTotp).toHaveBeenCalledWith('123456');
  });

  it('not finalized with missing passkey → hops to the passkey step', async () => {
    h.session.verifyMfaTotp.mockResolvedValue({ finalized: false, missing: ['passkey'] });
    renderTotpAndType();
    fireEvent.click(verifyBtn());
    expect(await screen.findByText('auth.mfa.passkey.title')).toBeTruthy();
    expect(screen.queryByLabelText('auth.mfa.totp.codeLabel')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('401 unauthenticated → sessionExpired message + delayed redirect to /login', async () => {
    h.session.verifyMfaTotp.mockRejectedValue({ status: 401, error: 'unauthenticated' });
    renderTotpAndType();
    fireEvent.click(verifyBtn());
    expect(await screen.findByText('auth.mfa.errors.sessionExpired')).toBeTruthy();
    await waitFor(
      () => expect(h.navigate).toHaveBeenCalledWith('/login', { replace: true }),
      { timeout: 2500 },
    );
  });

  it('429 → tooManyAttempts message, no navigation', async () => {
    h.session.verifyMfaTotp.mockRejectedValue({ status: 429, error: 'rate_limited' });
    renderTotpAndType();
    fireEvent.click(verifyBtn());
    expect(await screen.findByText('auth.mfa.errors.tooManyAttempts')).toBeTruthy();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('a failed verify re-enables the control (pendingFactor reset in finally)', async () => {
    h.session.verifyMfaTotp.mockRejectedValue({ status: 500, error: 'server_error' });
    renderTotpAndType();
    fireEvent.click(verifyBtn());
    expect(await screen.findByText('auth.mfa.errors.verifyFailed')).toBeTruthy();
    expect(verifyBtn().disabled).toBe(false);
  });
});

describe('LoginMfa — passkey verify (from the merged screen)', () => {
  it('finalized → navigates to /flow', async () => {
    h.session.verifyMfaPasskey.mockResolvedValue({ finalized: true });
    renderMfa(PICKER_STATE);
    fireEvent.click(passkeyBtn());
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/flow', { replace: true }));
  });

  it('WebAuthn cancel (NotAllowedError) → passkeyCancelled message + control re-enabled', async () => {
    h.session.verifyMfaPasskey.mockRejectedValue({ name: 'NotAllowedError' });
    renderMfa(PICKER_STATE);
    fireEvent.click(passkeyBtn());
    expect(await screen.findByText('auth.mfa.errors.passkeyCancelled')).toBeTruthy();
    expect(passkeyBtn().disabled).toBe(false);
  });
});

describe('LoginMfa — lost-factor escalation', () => {
  function openPasskeyLostConfirm() {
    renderMfa(PICKER_STATE);
    fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.passkey.lostPasskey' }));
    // LostFlow confirm panel takes over.
    return screen.getByRole('button', { name: 'auth.mfa.lost.sendEmailCta' });
  }

  it('bypass request succeeds → the "sent" confirmation screen', async () => {
    h.session.requestMfaBypass.mockResolvedValue({ earliestApplyAt: '2026-07-06T00:00:00Z' });
    fireEvent.click(openPasskeyLostConfirm());
    expect(await screen.findByText('auth.mfa.lost.sentTitle')).toBeTruthy();
    expect(h.session.requestMfaBypass).toHaveBeenCalledWith('passkey');
  });

  it('409 multi_factor_loss → redirect to /request-reset (the §6.2 wall)', async () => {
    h.session.requestMfaBypass.mockRejectedValue({ status: 409, error: 'multi_factor_loss' });
    fireEvent.click(openPasskeyLostConfirm());
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith('/request-reset', { replace: true }),
    );
  });

  it('409 bypass_already_active → error + back to the merged screen', async () => {
    h.session.requestMfaBypass.mockRejectedValue({ status: 409, error: 'bypass_already_active' });
    fireEvent.click(openPasskeyLostConfirm());
    expect(await screen.findByText('auth.mfa.errors.bypassAlreadyActive')).toBeTruthy();
    // lost reset to idle → the merged picker is back.
    expect(screen.getByText('auth.mfa.combined.title')).toBeTruthy();
  });
});
