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
 */
export function renderInviteEmail(params: {
  /** Absolute URL to /register including the invite token query param. */
  link: string;
  /** Days until the invite link expires. Defaults to 7. */
  ttlDays?: number;
}): RenderedEmailContent {
  const ttl = params.ttlDays ?? 7;
  const subject = "Tu es invité·e à créer ton espace Nodea";
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    `Tu es invité·e à créer ton espace Nodea.`,
    ``,
    `Pour créer ton compte, clique sur ce lien :`,
    params.link,
    ``,
    `Le lien est valable ${ttl} jours.`,
    ``,
    `Nodea est un espace privé, chiffré bout en bout — tes données ne`,
    `quittent pas ta machine sans être chiffrées avec une clé que tu`,
    `contrôles seul·e.`,
    ``,
    `Si ce message ne te concerne pas, ignore-le simplement.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Tu es invité·e à créer ton espace Nodea.</h2>`,
    `<p style="margin:0 0 24px 0;">Pour créer ton compte, clique sur le bouton ci-dessous&nbsp;:</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Créer mon compte</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">Le lien est valable ${ttl} jours.</p>`,
    `<p style="margin:24px 0 0 0;color:#374151;font-size:13px;line-height:1.6;">Nodea est un espace privé, chiffré bout en bout — tes données ne quittent pas ta machine sans être chiffrées avec une clé que tu contrôles seul·e.</p>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">Si ce message ne te concerne pas, ignore-le simplement.</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Crée ton espace Nodea — lien valable ${ttl} jours.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
