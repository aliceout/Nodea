import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — informational notice sent to an email owner
 * when someone tries to register a new account with their
 * address (Auth-Spec §7.1, dual-mail anti-enum pattern, issue
 * #45).
 *
 * Unlike `register-activate.ts`, this template does NOT carry
 * any actionable token : the body explains what happened, points
 * the user at /login and /request-reset for the legitimate
 * follow-ups, and leaves an « ignore if it wasn't you » line.
 * Clicking nothing in the email grants no access — the recipient
 * already has an account (or they wouldn't be receiving this).
 *
 * Pure function. Caller fills in `to` and `tag` on
 * `EmailService.send()` ; the canonical tag is
 * `'register-already-exists'`.
 */
export function renderRegisterAlreadyExistsEmail(params: {
  language: SupportedEmailLanguage;
  /** Absolute URL to the SPA login page. Built by the route
   *  handler from `WEB_BASE_URL` ; the template doesn't append
   *  anything. */
  loginUrl: string;
  /** Absolute URL to the SPA password-reset page. */
  resetUrl: string;
}): RenderedEmailContent {
  const { language } = params;
  const subject = emailT(language, 'registerAlreadyExists.subject');
  const loginSafe = escapeHtml(params.loginUrl);
  const resetSafe = escapeHtml(params.resetUrl);

  const bodyText = [
    emailT(language, 'registerAlreadyExists.heading'),
    ``,
    emailT(language, 'registerAlreadyExists.introText'),
    ``,
    params.loginUrl,
    ``,
    emailT(language, 'registerAlreadyExists.resetText'),
    params.resetUrl,
    ``,
    emailT(language, 'registerAlreadyExists.ifNotYouText'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'registerAlreadyExists.heading'))}</h2>`,
    `<p style="margin:0 0 24px 0;">${escapeHtml(emailT(language, 'registerAlreadyExists.introHtml'))}</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <a href="${loginSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(emailT(language, 'registerAlreadyExists.ctaLogin'))}</a>`,
    `</p>`,
    `<p style="margin:24px 0 8px 0;color:#374151;font-size:14px;">${escapeHtml(emailT(language, 'registerAlreadyExists.resetHtml'))}</p>`,
    `<p style="margin:0 0 24px 0;"><a href="${resetSafe}" style="color:#111827;text-decoration:underline;">${resetSafe}</a></p>`,
    `<p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'registerAlreadyExists.ifNotYouHtml'))}</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'registerAlreadyExists.preheader'),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
