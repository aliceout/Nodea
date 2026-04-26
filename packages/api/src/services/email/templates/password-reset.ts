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
  /** Absolute or relative URL to the reset page including the token
   *  query param. The template doesn't append anything. */
  link: string;
}): RenderedEmailContent {
  const subject = 'Réinitialisation de ton mot de passe Nodea';
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    `Quelqu'un (toi ?) a demandé la réinitialisation de ton mot de passe Nodea.`,
    ``,
    `Ouvre ce lien dans l'heure pour continuer :`,
    params.link,
    ``,
    `⚠ Attention : tes données sont chiffrées avec une clé dérivée de ton mot`,
    `de passe. Réinitialiser le mot de passe entraîne la perte définitive de`,
    `toutes tes entrées déjà enregistrées.`,
    ``,
    `Si tu n'es pas à l'origine de la demande, ignore ce message — ton compte`,
    `et tes données restent intacts.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Réinitialisation du mot de passe</h2>`,
    `<p style="margin:0 0 16px 0;">Quelqu'un (toi&nbsp;?) a demandé la réinitialisation de ton mot de passe Nodea.</p>`,
    `<p style="margin:0 0 24px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px;">Réinitialiser mon mot de passe</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">Lien valable 1 heure.</p>`,
    `<div style="margin:24px 0 16px 0;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#78350f;"><strong>⚠ Attention&nbsp;:</strong> tes données sont chiffrées avec une clé dérivée de ton mot de passe. Réinitialiser le mot de passe entraîne la <strong>perte définitive</strong> de toutes tes entrées déjà enregistrées.</p>`,
    `</div>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">Si tu n'es pas à l'origine de la demande, ignore ce message — ton compte et tes données restent intacts.</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: 'Demande de réinitialisation de ton mot de passe Nodea. Lien valable 1 heure.',
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
