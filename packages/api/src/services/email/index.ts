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
      // Smart fallback: if `smtp` is selected but SMTP_HOST is unset,
      // gracefully degrade to console rather than crash on first send.
      // This preserves the legacy mailer UX (dev/test work without
      // configuring SMTP) and avoids surprising existing test suites.
      // Prod must set SMTP_HOST or pick console explicitly — config
      // validation flags either as a deployment misconfiguration via
      // the startup log below.
      if (!cfg.SMTP_HOST) {
        // eslint-disable-next-line no-console
        console.warn(
          '[email] EMAIL_SERVICE_IMPL=smtp but SMTP_HOST is unset — ' +
            'falling back to console transport. Set SMTP_HOST or ' +
            'EMAIL_SERVICE_IMPL=console to silence this.',
        );
        cached = consoleInstance;
      } else {
        cached = smtpInstance;
      }
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
