import nodemailer, { type Transporter } from 'nodemailer';
import { getConfig } from '../../config.ts';
import type { EmailService, SendMailParams } from './types.ts';

/**
 * SMTP-backed email service via nodemailer.
 *
 * Dev recipe = Mailpit (SMTP_HOST=mailpit / 127.0.0.1, SMTP_PORT=1025,
 * SMTP_SECURE=false). The captured email shows up at
 * http://localhost:8025 without ever leaving the machine.
 *
 * Prod recipe = Infomaniak (SMTP_HOST=mail.infomaniak.com, SMTP_PORT=587,
 * SMTP_SECURE=false / STARTTLS, SMTP_USER + SMTP_PASS from Infisical).
 *
 * The transport is lazy-built (first use only) so a misconfigured SMTP
 * doesn't block server startup. If construction fails we surface the
 * error on the first `send()` call instead of crashing the process —
 * tests and dev work without ever sending a real mail.
 */
export class SmtpEmailService implements EmailService {
  private transport: Transporter | null = null;
  private built = false;

  private getTransport(): Transporter {
    if (this.built && this.transport) return this.transport;
    const cfg = getConfig();
    if (!cfg.SMTP_HOST) {
      throw new Error(
        'SmtpEmailService: SMTP_HOST is not set. Either configure SMTP, ' +
          'or pick `EMAIL_SERVICE_IMPL=console` for bare-metal dev.',
      );
    }
    this.transport = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT ?? 587,
      secure: cfg.SMTP_SECURE,
      auth:
        cfg.SMTP_USER && cfg.SMTP_PASS
          ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
          : undefined,
    });
    this.built = true;
    return this.transport;
  }

  async send(params: SendMailParams): Promise<void> {
    const cfg = getConfig();
    const t = this.getTransport();
    await t.sendMail({
      from: cfg.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}
