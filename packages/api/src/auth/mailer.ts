import { getEmailService, type SendMailParams } from '../services/email/index.ts';

/**
 * Legacy mailer surface — kept as a thin shim over `EmailService` for
 * back-compat with existing call sites and tests.
 *
 * New code (Phase 1+ of Auth-Roadmap) should call `getEmailService()`
 * directly from `services/email`. This shim stays so we don't have
 * to touch `routes/auth.ts` and `test/reset-password.test.ts` in the
 * same PR that introduces the abstraction. They migrate when their
 * own routes get touched (password-reset will be revisited in Phase
 * 2 alongside the new register/recover-kek flows).
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Test hook: a callback invoked synchronously **before** the active
 * `EmailService` actually sends, so tests can assert on outgoing mail
 * regardless of which impl is configured.
 *
 * Most new tests should prefer `__getRecordingEmailService()` from
 * `services/email` and set `EMAIL_SERVICE_IMPL=recording` — that's
 * the supported way to inspect outgoing mail. This inspector remains
 * for the existing `reset-password.test.ts` suite which predates the
 * abstraction.
 */
type Inspector = (mail: Mail) => void;
let inspector: Inspector | null = null;

export function __setMailerInspector(next: Inspector | null): void {
  inspector = next;
}

/**
 * Send a mail. Delegates to the active `EmailService`.
 *
 * Errors from the underlying transport bubble up; callers that want
 * fire-and-forget semantics must wrap their own try/catch (the
 * password-reset route already does, see `routes/auth.ts`).
 */
export async function sendMail(mail: Mail): Promise<void> {
  inspector?.(mail);
  const params: SendMailParams = {
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    tag: 'legacy-sendmail',
  };
  await getEmailService().send(params);
}
