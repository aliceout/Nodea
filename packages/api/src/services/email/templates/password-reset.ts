import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — password reset request (legacy flow, Security.md §2.5).
 *
 * The reset destroys all encrypted data — the email body warns about
 * this explicitly so the user doesn't click on autopilot. Worded so a
 * malicious request looks distinguishable from a legitimate one
 * (someone trying to steal the user's account by triggering reset on
 * their email won't accidentally land them in a "your data is gone"
 * scenario without warning).
 *
 * Pure function. Caller fills in `to` and `tag` on `EmailService.send()`.
 */
export function renderPasswordResetEmail(params: {
  language: SupportedEmailLanguage;
  /** Absolute or relative URL to the reset page including the token
   *  query param. The template doesn't append anything. */
  link: string;
}): RenderedEmailContent {
  const { language } = params;
  const subject = emailT(language, 'passwordReset.subject');
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    emailT(language, 'passwordReset.requestText'),
    ``,
    emailT(language, 'passwordReset.instructionText'),
    params.link,
    ``,
    emailT(language, 'passwordReset.warningText'),
    ``,
    emailT(language, 'passwordReset.ignoreNote'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'passwordReset.heading'))}</h2>`,
    `<p style="margin:0 0 16px 0;">${emailT(language, 'passwordReset.requestHtml')}</p>`,
    `<p style="margin:0 0 24px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px;">${escapeHtml(emailT(language, 'passwordReset.cta'))}</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'passwordReset.validity'))}</p>`,
    `<div style="margin:24px 0 16px 0;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#78350f;"><strong>${escapeHtml(emailT(language, 'passwordReset.warningHtmlPrefix'))}</strong> ${emailT(language, 'passwordReset.warningHtmlBody')}</p>`,
    `</div>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'passwordReset.ignoreNote'))}</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'passwordReset.preheader'),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
