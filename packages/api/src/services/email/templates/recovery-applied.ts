import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — password reset via recovery code (Auth-Spec
 * §7.7). Pure notification, sent right after `/auth/recover-kek/finish`
 * succeeds. The user's password has been replaced via OPAQUE
 * registration with the typed mnemonic, every credential blob
 * rotated, every other session revoked, every pending MFA bypass
 * cancelled.
 *
 * Wording is alarming on purpose: if the legit user did this, they
 * already know what happened (they just typed their 12 words). The
 * email exists for the case where it WASN'T them — typed mnemonic
 * means the attacker had access to the recovery code at some point,
 * and the user has to know immediately so they can react.
 */
export function renderRecoveryAppliedEmail(params: {
  language: SupportedEmailLanguage;
}): RenderedEmailContent {
  const { language } = params;
  const subject = emailT(language, 'recoveryApplied.subject');

  const bodyText = [
    emailT(language, 'recoveryApplied.summaryText'),
    ``,
    emailT(language, 'recoveryApplied.sessionsRevoked'),
    ``,
    emailT(language, 'recoveryApplied.legitText'),
    ``,
    emailT(language, 'recoveryApplied.notYouTextHeader'),
    emailT(language, 'recoveryApplied.notYouTextIntro'),
    `  1. ${emailT(language, 'recoveryApplied.step1')}`,
    `  2. ${emailT(language, 'recoveryApplied.step2Text')}`,
    `  3. ${emailT(language, 'recoveryApplied.step3')}`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${emailT(language, 'recoveryApplied.heading')}</h2>`,
    `<p style="margin:0 0 12px 0;">${emailT(language, 'recoveryApplied.summaryHtml')}</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">${emailT(language, 'recoveryApplied.sessionsRevoked')}</p>`,
    `<p style="margin:0 0 24px 0;">${emailT(language, 'recoveryApplied.legitHtml')}</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0 0 8px 0;font-size:14px;color:#7f1d1d;font-weight:600;">${emailT(language, 'recoveryApplied.notYouHtmlLabel')}</p>`,
    `  <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">${emailT(language, 'recoveryApplied.notYouHtmlIntro')}</p>`,
    `  <ol style="margin:0;padding-left:20px;font-size:14px;color:#7f1d1d;line-height:1.6;">`,
    `    <li>${emailT(language, 'recoveryApplied.step1')}</li>`,
    `    <li>${emailT(language, 'recoveryApplied.step2Html')}</li>`,
    `    <li>${emailT(language, 'recoveryApplied.step3')}</li>`,
    `  </ol>`,
    `</div>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'recoveryApplied.preheader'),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
