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
export function renderRecoveryAppliedEmail(): RenderedEmailContent {
  const subject = 'Mot de passe réinitialisé via code de récupération';

  const bodyText = [
    `Quelqu'un (toi ?) vient de réinitialiser le mot de passe de ton compte`,
    `Nodea via le code de récupération à 12 mots.`,
    ``,
    `Toutes tes sessions actives ont été révoquées et un nouveau code de`,
    `récupération a été généré (l'ancien ne fonctionne plus).`,
    ``,
    `Si c'est bien toi : tout est en ordre, tu peux te reconnecter avec`,
    `ton nouveau mot de passe.`,
    ``,
    `Si ce n'est PAS toi : ton code de récupération a été compromis.`,
    `Reprends le contrôle MAINTENANT depuis Compte → Sécurité :`,
    `  1. Change ton mot de passe (révoque toutes les sessions à nouveau).`,
    `  2. Régénère un nouveau code de récupération (et garde-le hors-ligne).`,
    `  3. Vérifie tes facteurs MFA (TOTP, passkeys) — supprime tout ce que`,
    `     tu ne reconnais pas.`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Mot de passe réinitialisé via code de récupération</h2>`,
    `<p style="margin:0 0 12px 0;">Quelqu'un (toi&nbsp;?) vient de <strong>réinitialiser le mot de passe</strong> de ton compte Nodea via le code de récupération à 12 mots.</p>`,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Toutes tes sessions actives ont été révoquées et un nouveau code de récupération a été généré (l'ancien ne fonctionne plus).</p>`,
    `<p style="margin:0 0 24px 0;">Si c'est bien toi&nbsp;: tout est en ordre, tu peux te reconnecter avec ton nouveau mot de passe.</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0 0 8px 0;font-size:14px;color:#7f1d1d;font-weight:600;">Si ce n'est PAS toi :</p>`,
    `  <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">Ton code de récupération a été compromis. Reprends le contrôle <strong>maintenant</strong> depuis Compte &rarr; Sécurité :</p>`,
    `  <ol style="margin:0;padding-left:20px;font-size:14px;color:#7f1d1d;line-height:1.6;">`,
    `    <li>Change ton mot de passe (révoque toutes les sessions à nouveau).</li>`,
    `    <li>Régénère un nouveau code de récupération (garde-le hors-ligne).</li>`,
    `    <li>Vérifie tes facteurs MFA (TOTP, passkeys) — supprime tout ce que tu ne reconnais pas.</li>`,
    `  </ol>`,
    `</div>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Réinitialisation par code de récupération sur Nodea — vérifie que c'est bien toi.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
