import type { EmailService, SendMailParams } from './types.ts';

/**
 * Stdout fallback for when no real SMTP is reachable.
 *
 * Use this when:
 *   - You run `pnpm dev` on bare metal without the docker compose
 *     `dev` profile (so Mailpit is not running).
 *   - You're in a constrained environment that explicitly forbids
 *     network egress (CI without SMTP, restricted prod sandbox).
 *
 * Output goes to **stdout** (not stderr) so you can grep it cleanly
 * via standard log pipelines. Each email is logged as a single
 * structured block prefixed with `[email-console]` for grep-ability.
 *
 * Production warning: shipping this in prod means verification codes
 * and reset tokens land in your application logs. That's typically a
 * compliance / leak concern. The factory in `index.ts` does NOT pick
 * this impl by default — you have to set `EMAIL_SERVICE_IMPL=console`
 * explicitly.
 */
export class ConsoleEmailService implements EmailService {
  async send(params: SendMailParams): Promise<void> {
    const tag = params.tag ?? 'email';
    // We deliberately use console.log (not the structured logger) so
    // the dev output stays readable without reaching for a JSON parser.
    // The tag goes through the logger below for ops visibility.
    /* eslint-disable no-console */
    console.log(`\n[email-console] ── ${tag} ──`);
    console.log(`To:      ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Body:`);
    console.log(params.text);
    if (params.html) console.log(`\n(HTML body present, ${params.html.length} chars)`);
    console.log(`[email-console] ── /${tag} ──\n`);
    /* eslint-enable no-console */
  }
}
