import type { EmailService, SendMailParams } from './types.ts';

export interface RecordedMail extends SendMailParams {
  /** Server time at which `send()` was called. Useful for ordering
   *  asserts in tests that fire multiple emails. */
  sentAt: Date;
}

/**
 * In-memory email service for Vitest fixtures.
 *
 * Tests that exercise email-bearing flows (register verify, password
 * reset, totp bypass, change-email…) use this impl to assert on
 * outgoing mail without ever touching a network. Set
 * `EMAIL_SERVICE_IMPL=recording` in the test env, then read
 * `recording.sent` to inspect what would have been sent.
 *
 * The factory in `index.ts` exposes a singleton so tests can grab the
 * same instance the application code uses.
 */
export class RecordingEmailService implements EmailService {
  /** Append-only buffer of every mail submitted via `send()`. Tests
   *  read this directly; reset between tests via `reset()`. */
  readonly sent: RecordedMail[] = [];

  /** Test hook : when > 0, the next N `send()` calls reject (simulating
   *  a transient SMTP failure) instead of recording. Lets tests cover
   *  the « email failed » branches — e.g. the invite phantom-cleanup
   *  (audit 2026-06 passe 2, 3.10) — without mocking the module. */
  failNext = 0;

  async send(params: SendMailParams): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('recording-email: simulated send failure');
    }
    this.sent.push({ ...params, sentAt: new Date() });
  }

  /** Drop all recorded mails (and clear any pending failure). Call
   *  from `beforeEach` or `afterEach`. */
  reset(): void {
    this.sent.length = 0;
    this.failNext = 0;
  }

  /**
   * Return the most recent mail matching the given tag, or undefined
   * if none. Convenience for tests that fire one mail per assertion.
   */
  latestByTag(tag: string): RecordedMail | undefined {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      if (this.sent[i]!.tag === tag) return this.sent[i];
    }
    return undefined;
  }
}
