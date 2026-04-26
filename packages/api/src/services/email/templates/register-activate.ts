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
  /** Absolute URL to the activation page including the token query
   *  param. Built by the route handler from `WEB_BASE_URL` + the
   *  generated token. The template doesn't append anything. */
  link: string;
  /** Days until the link expires. Defaults to 7. */
  ttlDays?: number;
}): RenderedEmailContent {
  const ttl = params.ttlDays ?? 7;
  const subject = "Active ton compte Nodea";
  const linkSafe = escapeHtml(params.link);

  const bodyText = [
    `Bienvenue sur Nodea !`,
    ``,
    `Pour activer ton compte et pouvoir te connecter, clique sur ce lien :`,
    params.link,
    ``,
    `Le lien expire dans ${ttl} jours.`,
    ``,
    `Si tu n'es pas à l'origine de cette inscription, ignore ce message —`,
    `aucun compte ne sera activé sans ce clic.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Bienvenue sur Nodea !</h2>`,
    `<p style="margin:0 0 24px 0;">Pour activer ton compte et pouvoir te connecter, clique sur le bouton ci-dessous&nbsp;:</p>`,
    `<p style="margin:0 0 16px 0;text-align:center;">`,
    `  <a href="${linkSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Activer mon compte</a>`,
    `</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">Le lien expire dans ${ttl} jours.</p>`,
    `<p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;">Si tu n'es pas à l'origine de cette inscription, ignore ce message — aucun compte ne sera activé sans ce clic.</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Active ton compte Nodea — lien valable ${ttl} jours.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
