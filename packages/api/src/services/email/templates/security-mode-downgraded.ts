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
  /** Which factor's removal triggered the downgrade. */
  trigger: 'totp_disabled' | 'last_prf_passkey_removed';
  /** What the user was on before the auto-downgrade. */
  previousMode: 'always_totp' | 'maximum';
}): RenderedEmailContent {
  const triggerLabel =
    params.trigger === 'totp_disabled'
      ? 'la désactivation de ton TOTP'
      : 'la suppression de ta dernière passkey compatible PRF';
  const previousLabel =
    params.previousMode === 'always_totp' ? 'TOTP obligatoire' : 'Maximum';

  const subject = 'Mode de sécurité abaissé à Standard';

  const bodyText = [
    `Suite à ${triggerLabel}, ton mode de sécurité Nodea est repassé`,
    `de "${previousLabel}" à "Standard" (mot de passe ou passkey).`,
    ``,
    `Concrètement : la prochaine connexion ne demandera que ton mot de`,
    `passe (ou une passkey) — plus de second facteur obligatoire.`,
    ``,
    `Si tu veux remonter le niveau de sécurité, depuis Compte → Sécurité :`,
    `  - Réactive le TOTP, OU`,
    `  - Enregistre une passkey compatible PRF (Touch ID, Face ID, Yubikey),`,
    `  - puis change le mode dans la même page.`,
    ``,
    `Si ce n'est PAS toi qui as déclenché cette opération, ton compte`,
    `est peut-être compromis : change ton mot de passe immédiatement`,
    `depuis Compte → Sécurité — toutes les sessions actives seront`,
    `invalidées.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Mode de sécurité abaissé à Standard</h2>`,
    `<p style="margin:0 0 12px 0;">Suite à <strong>${triggerLabel}</strong>, ton mode de sécurité Nodea est repassé de <strong>«&nbsp;${previousLabel}&nbsp;»</strong> à <strong>«&nbsp;Standard&nbsp;»</strong> (mot de passe ou passkey).</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Concrètement&nbsp;: la prochaine connexion ne demandera que ton mot de passe (ou une passkey) — plus de second facteur obligatoire.</p>`,
    `<p style="margin:0 0 8px 0;font-weight:600;">Pour remonter le niveau de sécurité (depuis Compte &rarr; Sécurité) :</p>`,
    `<ul style="margin:0 0 24px 0;padding-left:20px;line-height:1.6;">`,
    `  <li>Réactive le TOTP, ou</li>`,
    `  <li>Enregistre une passkey compatible PRF (Touch ID, Face ID, Yubikey),</li>`,
    `  <li>puis change le mode dans la même page.</li>`,
    `</ul>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#7f1d1d;"><strong>Si ce n'est PAS toi&nbsp;:</strong> ton compte est peut-être compromis. <strong>Change ton mot de passe immédiatement</strong> depuis Compte &rarr; Sécurité — toutes les sessions actives seront invalidées.</p>`,
    `</div>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Mode de sécurité Nodea repassé à Standard suite à ${triggerLabel}.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
