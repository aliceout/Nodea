import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — security_mode auto-downgrade (Auth-Spec §6.1).
 *
 * Sent when removing a factor (TOTP disable, last PRF passkey
 * removed) brings the user's `security_mode` back down to
 * `password_or_passkey` because the prerequisite of the previous
 * mode is no longer met. Pure notification — the action just
 * succeeded server-side, this email is a heads-up that the
 * security level dropped as a side-effect.
 *
 * The user explicitly initiated the trigger (TOTP disable or
 * passkey removal both go through `requireFreshPassword`), so the
 * email is informational, not alarming. The "if this wasn't you"
 * branch covers the case where the password was compromised and
 * the attacker walked the security level down.
 */
export function renderSecurityModeDowngradedEmail(params: {
  language: SupportedEmailLanguage;
  /** Which factor's removal triggered the downgrade. */
  trigger: 'totp_disabled' | 'last_prf_passkey_removed';
  /** What the user was on before the auto-downgrade. */
  previousMode: 'always_2fa' | 'maximum';
}): RenderedEmailContent {
  const { language } = params;
  const trigger =
    params.trigger === 'totp_disabled'
      ? emailT(language, 'securityModeDowngraded.triggerTotpDisabled')
      : emailT(language, 'securityModeDowngraded.triggerLastPrfPasskey');
  const previous =
    params.previousMode === 'always_2fa'
      ? emailT(language, 'securityModeDowngraded.previousLabelAlways2fa')
      : emailT(language, 'securityModeDowngraded.previousLabelMaximum');

  const subject = emailT(language, 'securityModeDowngraded.subject');

  const bodyText = [
    emailT(language, 'securityModeDowngraded.summaryTextLine1', { values: { trigger } }),
    emailT(language, 'securityModeDowngraded.summaryTextLine2', { values: { previous } }),
    ``,
    emailT(language, 'securityModeDowngraded.behaviorText'),
    ``,
    emailT(language, 'securityModeDowngraded.upgradeIntroText'),
    `  - ${emailT(language, 'securityModeDowngraded.upgradeStep1')}`,
    `  - ${emailT(language, 'securityModeDowngraded.upgradeStep2')}`,
    `  - ${emailT(language, 'securityModeDowngraded.upgradeStep3')}`,
    ``,
    emailT(language, 'securityModeDowngraded.notYouText'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${emailT(language, 'securityModeDowngraded.heading')}</h2>`,
    `<p style="margin:0 0 12px 0;">${emailT(language, 'securityModeDowngraded.summaryHtml', { values: { trigger, previous } })}</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">${emailT(language, 'securityModeDowngraded.behaviorHtml')}</p>`,
    `<p style="margin:0 0 8px 0;font-weight:600;">${emailT(language, 'securityModeDowngraded.upgradeIntroHtml')}</p>`,
    `<ul style="margin:0 0 24px 0;padding-left:20px;line-height:1.6;">`,
    `  <li>${emailT(language, 'securityModeDowngraded.upgradeStep1')}</li>`,
    `  <li>${emailT(language, 'securityModeDowngraded.upgradeStep2')}</li>`,
    `  <li>${emailT(language, 'securityModeDowngraded.upgradeStep3')}</li>`,
    `</ul>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#7f1d1d;"><strong>${emailT(language, 'securityModeDowngraded.notYouHtmlLabel')}</strong> ${emailT(language, 'securityModeDowngraded.notYouHtmlBody')}</p>`,
    `</div>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'securityModeDowngraded.preheader', { values: { trigger } }),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
