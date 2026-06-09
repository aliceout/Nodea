import { getConfig } from '../../config.ts';
import { ConsoleEmailService } from './console.ts';
import { RecordingEmailService } from './recording.ts';
import { SmtpEmailService } from './smtp.ts';
import type { EmailService } from './types.ts';

export type { EmailService, SendMailParams } from './types.ts';
export { RecordingEmailService } from './recording.ts';
export type { RecordedMail } from './recording.ts';

/**
 * Process-wide singletons. We instantiate one per impl regardless of
 * which is active, then `getEmailService()` returns the active one.
 *
 * The recording impl is exposed as a stable singleton (rather than
 * being rebuilt per call) so test harnesses can grab it once and
 * inspect `.sent` after the application code has run.
 */
const recordingInstance = new RecordingEmailService();
const consoleInstance = new ConsoleEmailService();
const smtpInstance = new SmtpEmailService();

let cached: EmailService | null = null;

/**
 * Pick the active email impl based on `EMAIL_SERVICE_IMPL`.
 *
 * The choice is made on first call and cached. Tests that flip env
 * vars between cases need to call `__resetEmailServiceCache()` to
 * pick up the new impl.
 */
export function getEmailService(): EmailService {
  if (cached) return cached;
  const cfg = getConfig();
  switch (cfg.EMAIL_SERVICE_IMPL) {
    case 'smtp':
      // Dev/test fallback : when `smtp` is selected but SMTP_HOST is
      // unset, degrade gracefully to the console transport so a local
      // `pnpm dev:api` boots without a real SMTP server. In production
      // this combination is rejected at config-validation time
      // (`config.ts` superRefine) — magic-link tokens, password reset
      // URLs and MFA-bypass confirmations would otherwise land in
      // stderr logs, which CLAUDE.md forbids for any secret. So by the
      // time we reach this fallback, NODE_ENV is guaranteed not to be
      // `production`.
      cached = cfg.SMTP_HOST ? smtpInstance : consoleInstance;
      break;
    case 'recording':
      cached = recordingInstance;
      break;
    case 'console':
      cached = consoleInstance;
      break;
  }
  return cached;
}

/**
 * Test-only: drop the cached active impl so the next `getEmailService()`
 * call re-reads `EMAIL_SERVICE_IMPL`. Use this in `beforeEach` if you
 * mutate the env var between cases.
 */
export function __resetEmailServiceCache(): void {
  cached = null;
}

/**
 * Test-only: hand back the recording singleton so tests can read
 * `.sent` and `.reset()` without going through `getEmailService()`
 * (which would only return it when `EMAIL_SERVICE_IMPL=recording`).
 */
export function __getRecordingEmailService(): RecordingEmailService {
  return recordingInstance;
}
