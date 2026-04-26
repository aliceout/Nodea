/**
 * Email service interface.
 *
 * Pluggable abstraction over outgoing transactional email. Used by the
 * password-reset flow today and, from Phase 1 of Auth-Roadmap onwards,
 * by the multi-step register flow (verification codes), the change-email
 * flow, the bypass-MFA flow, and any future operational notifications.
 *
 * Three implementations ship in this directory (cf. Auth-Spec §10.2):
 *
 *   - `SmtpEmailService`      — real SMTP transport via nodemailer.
 *                               Default in dev (Mailpit) and prod (Infomaniak).
 *   - `ConsoleEmailService`   — logs to stdout. Fallback only, used when
 *                               nothing else is reachable (e.g., bare-metal
 *                               dev without Docker).
 *   - `RecordingEmailService` — in-memory store for Vitest fixtures.
 *                               Test code can read `.sent` to assert.
 *
 * The active impl is selected at startup from `EMAIL_SERVICE_IMPL` env
 * (cf. config.ts).
 */
export interface SendMailParams {
  /** Recipient address. Single address; we don't expose to/cc/bcc here. */
  to: string;
  /** Subject line, plain text. */
  subject: string;
  /** Plain-text body. Required — every email MUST have a text version
   *  for accessibility and for clients that strip HTML. */
  text: string;
  /** Optional HTML body. When omitted, recipients see `text` only. */
  html?: string;
  /** Free-form tag for logging / metrics. Examples: 'verify-register',
   *  'totp-bypass-confirm', 'password-reset'. Never logged with the
   *  body — used only as structured log key. */
  tag?: string;
}

export interface EmailService {
  /**
   * Send the email through the underlying transport. Resolves on
   * successful submission (queue accept for SMTP); rejects on
   * transport-level failure. Callers should treat email as
   * best-effort: never block a user-facing flow on send success when
   * the email is "for information only", but DO surface failures for
   * code-bearing emails (verification codes, reset tokens) since the
   * user can't progress without them.
   */
  send(params: SendMailParams): Promise<void>;
}
