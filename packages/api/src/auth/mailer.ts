import nodemailer, { type Transporter } from 'nodemailer';
import { getConfig } from '../config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Lazily-built mailer. When SMTP_HOST is unset (dev / test), we
 * fall back to a console transport that prints the email to stderr
 * and resolves — this keeps the flow end-to-end testable without a
 * real SMTP server. Tests hook into `__setMailerInspector` below to
 * capture outgoing messages.
 */
type Inspector = (mail: Mail) => void;
let inspector: Inspector | null = null;

/** Test-only: observe outgoing mail without sending anything. */
export function __setMailerInspector(next: Inspector | null): void {
  inspector = next;
}

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const cfg = getConfig();
  if (!cfg.SMTP_HOST) {
    transport = null;
    return null;
  }
  transport = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT ?? 587,
    secure: cfg.SMTP_SECURE,
    auth:
      cfg.SMTP_USER && cfg.SMTP_PASS
        ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
        : undefined,
  });
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  inspector?.(mail);
  const cfg = getConfig();
  const t = getTransport();
  if (!t) {
    // Dev / test fallback — do not block the handler. Print the
    // message instead so the developer can copy the link from logs.
    console.info('[mailer] SMTP unconfigured, logging mail instead:');
    console.info(`  To:      ${mail.to}`);
    console.info(`  Subject: ${mail.subject}`);
    console.info(`  Body:\n${mail.text}`);
    return;
  }
  await t.sendMail({
    from: cfg.SMTP_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
