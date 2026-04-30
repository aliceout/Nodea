import { emailT, type SupportedEmailLanguage } from '../i18n.ts';
import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — MFA bypass request (Auth-Roadmap Phase 6,
 * Auth-Spec §7.8). Sent when a user requests to skip a single MFA
 * factor (TOTP or passkey) at the next login because they lost
 * access to it.
 *
 * Single action link: **Confirm** — starts the 7-day delay, after
 * which the bypassed factor is removed from the user's required
 * set at the next login.
 *
 * No more "Cancel" button: a successful login auto-cancels every
 * pending bypass server-side (`cancelPendingBypassesForUser`), so
 * a legitimate owner just has to sign in normally to invalidate a
 * forged request — no extra click on a link from an email (which
 * is exactly the surface phishing thrives on).
 *
 * Wording is deliberately specific about which factor will be
 * dropped + when — a malicious request reads as alarming so the
 * legit user reacts rather than ignores.
 *
 * Generic enough to render TOTP + passkey variants — caller passes
 * the `factor` and we tweak labels.
 */
export function renderMfaBypassEmail(params: {
  language: SupportedEmailLanguage;
  factor: 'totp' | 'passkey';
  confirmLink: string;
}): RenderedEmailContent {
  const { language, factor } = params;
  const factorLabel =
    factor === 'totp'
      ? emailT(language, 'mfaBypass.factorLabelTotp')
      : emailT(language, 'mfaBypass.factorLabelPasskey');
  const factorVerbose =
    factor === 'totp'
      ? emailT(language, 'mfaBypass.factorVerboseTotp')
      : emailT(language, 'mfaBypass.factorVerbosePasskey');
  const sideEffect =
    factor === 'totp'
      ? emailT(language, 'mfaBypass.sideEffectTotp')
      : emailT(language, 'mfaBypass.sideEffectPasskey');

  const subject = emailT(language, 'mfaBypass.subject', { values: { factor: factorLabel } });
  const confirmSafe = escapeHtml(params.confirmLink);

  const bodyText = [
    emailT(language, 'mfaBypass.requestText', { values: { factorVerbose } }),
    ``,
    emailT(language, 'mfaBypass.legitLine'),
    `  ${emailT(language, 'mfaBypass.confirmHere', { values: { link: params.confirmLink } })}`,
    ``,
    `  ${emailT(language, 'mfaBypass.delayLine', { values: { factor: factorLabel, sideEffect } })}`,
    ``,
    emailT(language, 'mfaBypass.notYouTextHeader'),
    emailT(language, 'mfaBypass.notYouTextBody'),
    ``,
    emailT(language, 'mfaBypass.compromiseNoteText'),
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'mfaBypass.heading', { values: { factor: factorLabel } }))}</h2>`,
    `<p style="margin:0 0 16px 0;">${emailT(language, 'mfaBypass.requestHtml', { values: { factorVerbose: escapeHtml(factorVerbose) } })}</p>`,
    `<p style="margin:0 0 12px 0;font-weight:600;">${escapeHtml(emailT(language, 'mfaBypass.legitLine'))}</p>`,
    `<p style="margin:0 0 8px 0;text-align:center;">`,
    `  <a href="${confirmSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px;">${escapeHtml(emailT(language, 'mfaBypass.cta'))}</a>`,
    `</p>`,
    `<p style="margin:0 0 24px 0;color:#6b7280;font-size:13px;text-align:center;">${escapeHtml(emailT(language, 'mfaBypass.delayLineHtml', { values: { sideEffect } }))}</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">`,
    `  <p style="margin:0 0 8px 0;font-size:14px;color:#78350f;font-weight:600;">${escapeHtml(emailT(language, 'mfaBypass.notYouHtmlLabel'))}</p>`,
    `  <p style="margin:0;font-size:14px;color:#78350f;">${emailT(language, 'mfaBypass.notYouHtmlBody')}</p>`,
    `</div>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">${emailT(language, 'mfaBypass.compromiseNoteHtml')}</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'mfaBypass.preheader', { values: { factor: factorLabel } }),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}

/**
 * Email template — MFA bypass applied (Auth-Roadmap Phase 6).
 *
 * Sent right after a confirmed bypass is consumed at login. Pure
 * notification — nothing to click. Lists what was removed + the
 * downgrade applied (if any) so the user knows the side-effects
 * landed.
 */
export function renderMfaBypassAppliedEmail(params: {
  language: SupportedEmailLanguage;
  factor: 'totp' | 'passkey';
  /** True when `security_mode` was downgraded from `always_totp` /
   *  `maximum` to `password_or_passkey` as a side-effect. */
  downgraded: boolean;
}): RenderedEmailContent {
  const { language, factor } = params;
  const factorPlural =
    factor === 'totp'
      ? emailT(language, 'mfaBypassApplied.factorPluralTotp')
      : emailT(language, 'mfaBypassApplied.factorPluralPasskey');
  const removedLine =
    factor === 'totp'
      ? emailT(language, 'mfaBypassApplied.removedTotp')
      : emailT(language, 'mfaBypassApplied.removedPasskey');
  const subject = emailT(language, 'mfaBypassApplied.subject', { values: { factorPlural } });

  const bodyText = [
    emailT(language, 'mfaBypassApplied.summary', { values: { factorPlural } }),
    ``,
    removedLine,
    params.downgraded ? emailT(language, 'mfaBypassApplied.downgradedText') : ``,
    ``,
    emailT(language, 'mfaBypassApplied.reactivate', { values: { factorPlural } }),
    ``,
    emailT(language, 'mfaBypassApplied.notYouTextLine1'),
    emailT(language, 'mfaBypassApplied.notYouTextLine2'),
    emailT(language, 'mfaBypassApplied.notYouTextLine3'),
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(emailT(language, 'mfaBypassApplied.heading', { values: { factorPlural } }))}</h2>`,
    `<p style="margin:0 0 12px 0;">${escapeHtml(removedLine)}</p>`,
    params.downgraded
      ? `<p style="margin:0 0 12px 0;">${emailT(language, 'mfaBypassApplied.downgradedHtml')}</p>`
      : ``,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">${emailT(language, 'mfaBypassApplied.reactivateHtml', { values: { factorPlural: escapeHtml(factorPlural) } })}</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#7f1d1d;"><strong>${escapeHtml(emailT(language, 'mfaBypassApplied.notYouHtmlLabel'))}</strong> ${emailT(language, 'mfaBypassApplied.notYouHtmlBody')}</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n');

  const layout = renderLayout({
    subject,
    language,
    preheader: emailT(language, 'mfaBypassApplied.preheader', { values: { factorPlural } }),
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
