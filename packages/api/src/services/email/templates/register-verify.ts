import { renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — inscription verification code (Auth-Spec.md
 * §7.1 step 1).
 *
 * Renders the per-template content (greeting, code call-out, expiry
 * note) and hands it to `renderLayout()` for the standard Nodea
 * shell (header + footer). Returns the `subject` / `text` / `html`
 * trio ready for `EmailService.send()` — the caller adds `to` and
 * `tag`.
 *
 * Pure function: no I/O, no env reads. Tests assert directly on the
 * returned strings.
 */
export function renderRegisterVerifyEmail(params: {
  code: string;
  /** Minutes until the code expires. Defaults to 10. */
  ttlMinutes?: number;
}): RenderedEmailContent {
  const ttl = params.ttlMinutes ?? 10;
  const code = params.code;
  const subject = `Ton code d'inscription Nodea : ${code}`;

  const bodyText = [
    `Bienvenue sur Nodea !`,
    ``,
    `Pour finaliser ton inscription, saisis ce code dans la page d'inscription :`,
    ``,
    `    ${code}`,
    ``,
    `Le code expire dans ${ttl} minutes.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Bienvenue sur Nodea !</h2>`,
    `<p style="margin:0 0 16px 0;">Pour finaliser ton inscription, saisis ce code dans la page d'inscription&nbsp;:</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <span style="display:inline-block;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:0.3em;padding:16px 28px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;color:#111827;">${code}</span>`,
    `</p>`,
    `<p style="margin:0;color:#6b7280;font-size:13px;">Le code expire dans ${ttl} minutes.</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Ton code d'inscription : ${code}. Expire dans ${ttl} minutes.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
