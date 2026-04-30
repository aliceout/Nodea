import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — account activation magic link (Auth-Roadmap
 * Phase 1 simplified flow).
 *
 * Sent immediately after `POST /auth/register`. The body wraps a
 * single big call-to-action button that hits the frontend's
 * `/activate?token=…` route. The link expires after 7 days; the
 * cleanup cron purges the row + its associated unactivated user
 * row when the window closes.
 *
 * Pure function. Caller fills in `to` and `tag` on
 * `EmailService.send()`.
 */
export function renderRegisterActivateEmail(params: {
  language: SupportedEmailLanguage;
  /** Absolute URL to the activation page including the token query
   *  param. Built by the route handler from `WEB_BASE_URL` + the
   *  generated token. The template doesn't append anything. */
  link: string;
  /** Days until the link expires. Defaults to 7. */
  ttlDays?: number;
}): RenderedEmailContent {
  const { language } = params;
  const ttl = params.ttlDays ?? 7;
  const subject = emailT(language, 'registerActivate.subject');
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    emailT(language, 'registerActivate.heading'),
    ``,
    emailT(language, 'registerActivate.instructionText'),
    params.link,
    ``,
    emailT(language, 'registerActivate.validity', { values: { ttl } }),
    ``,
    emailT(language, 'registerActivate.ignoreNote'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'registerActivate.heading'))}</h2>`,
    `<p style="margin:0 0 24px 0;">${escapeHtml(emailT(language, 'registerActivate.instructionHtml'))}&nbsp;</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(emailT(language, 'registerActivate.cta'))}</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'registerActivate.validity', { values: { ttl } }))}</p>`,
    `<p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'registerActivate.ignoreNote'))}</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'registerActivate.preheader', { values: { ttl } }),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
