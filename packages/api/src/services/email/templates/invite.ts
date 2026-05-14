import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — admin-issued invite (Bitwarden-style).
 *
 * Sent when an admin enters an email in `/admin/invites`. The link
 * lands on `/register?invite=<token>` where the recipient sees their
 * email pre-filled (read-only) and just needs to choose a password.
 * The email click acts as proof of email control — invited accounts
 * are activated immediately at register-submit, no separate
 * activation email is sent.
 *
 * Wording is intentionally neutral: Nodea is a personal / self-hosted
 * tool, the inviter is just opening the door, not branding their
 * instance. We don't surface the inviter's name to keep the focus on
 * "you have a new space" rather than "X is sharing with you".
 *
 * Localisation : admin invites have no authenticated request to
 * derive `Accept-Language` from, so the caller falls back to
 * `DEFAULT_LANGUAGE` (FR) — see `i18n.ts` decision note.
 */
export function renderInviteEmail(params: {
  language: SupportedEmailLanguage;
  /** Absolute URL to /register including the invite token query param. */
  link: string;
  /** Days until the invite link expires. Defaults to 7. */
  ttlDays?: number;
}): RenderedEmailContent {
  const { language } = params;
  const ttl = params.ttlDays ?? 7;
  const subject = emailT(language, 'invite.subject');
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    emailT(language, 'invite.heading'),
    ``,
    emailT(language, 'invite.instructionText'),
    params.link,
    ``,
    emailT(language, 'invite.validity', { values: { ttl } }),
    ``,
    emailT(language, 'invite.description'),
    ``,
    emailT(language, 'invite.ignoreNote'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'invite.heading'))}</h2>`,
    `<p style="margin:0 0 24px 0;">${escapeHtml(emailT(language, 'invite.instructionHtml'))}&nbsp;</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(emailT(language, 'invite.cta'))}</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'invite.validity', { values: { ttl } }))}</p>`,
    `<p style="margin:24px 0 0 0;color:#374151;font-size:13px;line-height:1.6;">${escapeHtml(emailT(language, 'invite.description'))}</p>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">${escapeHtml(emailT(language, 'invite.ignoreNote'))}</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'invite.preheader', { values: { ttl } }),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
