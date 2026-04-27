import { escapeHtml, renderLayout, type RenderedEmailContent } from './layout.ts';

/**
 * Email template — MFA bypass request (Auth-Roadmap Phase 6,
 * Auth-Spec §7.8). Sent when a user requests to skip a single MFA
 * factor (TOTP or passkey) at the next login because they lost
 * access to it.
 *
 * Two links in the body:
 *   - **Confirm** — starts the 48h delay. After it elapses, the
 *     bypassed factor is removed from the user's required set at
 *     the next login.
 *   - **Cancel** — invalidates the request. Always available to
 *     defang an attacker-triggered bypass.
 *
 * Wording is deliberately specific about which factor will be
 * dropped + when — a malicious request reads as alarming so the
 * legit user clicks `cancel` rather than ignoring.
 *
 * Generic enough to render TOTP + passkey variants — caller passes
 * the `factor` and we tweak labels.
 */
export function renderMfaBypassEmail(params: {
  factor: 'totp' | 'passkey';
  confirmLink: string;
  cancelLink: string;
}): RenderedEmailContent {
  const factorLabel = params.factor === 'totp' ? 'TOTP' : 'passkey';
  const factorVerbose =
    params.factor === 'totp'
      ? 'la 2FA TOTP (codes à 6 chiffres)'
      : 'la passkey (Touch ID / Face ID / Yubikey)';
  const sideEffect =
    params.factor === 'totp'
      ? 'Ton TOTP sera désactivé et tes codes de secours invalidés.'
      : 'Toutes tes passkeys seront supprimées — tu pourras en réenrôler de nouvelles après le login.';

  const subject = `Récupération de ${factorLabel} — confirme par email`;
  const confirmSafe = escapeHtml(params.confirmLink);
  const cancelSafe = escapeHtml(params.cancelLink);

  const bodyText = [
    `Quelqu'un (toi ?) a demandé à se connecter à Nodea sans ${factorVerbose}.`,
    ``,
    `Si c'est bien toi (tu as perdu ton appareil / ta clé) :`,
    `  Confirme ici : ${params.confirmLink}`,
    ``,
    `  Tu pourras alors te reconnecter sans ${factorLabel} 48h après cette`,
    `  confirmation. ${sideEffect}`,
    ``,
    `Si ce n'est PAS toi : annule la demande tout de suite.`,
    `  Annuler : ${params.cancelLink}`,
    ``,
    `Si tu suspectes une compromission de ton compte, va sur la page de`,
    `connexion et utilise « Mot de passe oublié → reset destructif » — c'est`,
    `le seul recours qui invalide tout l'accès au compte (au prix de tes`,
    `données chiffrées).`,
  ].join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Récupération de ${factorLabel}</h2>`,
    `<p style="margin:0 0 16px 0;">Quelqu'un (toi&nbsp;?) a demandé à se connecter à Nodea <strong>sans ${factorVerbose}</strong>.</p>`,
    `<p style="margin:0 0 12px 0;font-weight:600;">Si c'est bien toi (tu as perdu ton appareil / ta clé) :</p>`,
    `<p style="margin:0 0 8px 0;text-align:center;">`,
    `  <a href="${confirmSafe}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px;">Confirmer la récupération</a>`,
    `</p>`,
    `<p style="margin:0 0 24px 0;color:#6b7280;font-size:13px;text-align:center;">Délai de 48h après confirmation. ${escapeHtml(sideEffect)}</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">`,
    `  <p style="margin:0 0 8px 0;font-size:14px;color:#78350f;font-weight:600;">Si ce n'est PAS toi :</p>`,
    `  <p style="margin:0 0 8px 0;font-size:14px;color:#78350f;">Annule la demande tout de suite.</p>`,
    `  <p style="margin:0;text-align:left;">`,
    `    <a href="${cancelSafe}" style="display:inline-block;background:#ffffff;color:#78350f;text-decoration:none;padding:8px 16px;border:1px solid #f59e0b;border-radius:6px;font-weight:500;font-size:14px;">Annuler la demande</a>`,
    `  </p>`,
    `</div>`,
    `<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">Si tu suspectes une compromission de ton compte, va sur la page de connexion et utilise « Mot de passe oublié → reset destructif » — c'est le seul recours qui invalide tout l'accès au compte (au prix de tes données chiffrées).</p>`,
  ].join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Demande de récupération ${factorLabel} sur Nodea — délai 48h après confirmation.`,
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
  factor: 'totp' | 'passkey';
  /** True when `security_mode` was downgraded from `always_totp` /
   *  `maximum` to `password_or_passkey` as a side-effect. */
  downgraded: boolean;
}): RenderedEmailContent {
  const factorLabel = params.factor === 'totp' ? 'TOTP' : 'passkeys';
  const removedLine =
    params.factor === 'totp'
      ? 'Ton TOTP est désactivé et tes 10 codes de secours sont invalidés.'
      : 'Toutes tes passkeys ont été supprimées.';
  const subject = `Récupération ${factorLabel} appliquée`;

  const bodyText = [
    `Ta demande de récupération ${factorLabel} sur Nodea vient d'être appliquée.`,
    ``,
    removedLine,
    params.downgraded
      ? `Ton mode de sécurité est repassé à "Standard" (mot de passe ou passkey).`
      : ``,
    ``,
    `Re-active ${factorLabel} dès que possible depuis Settings → Sécurité.`,
    ``,
    `Si ce n'est pas toi qui as déclenché cette opération : ton compte est`,
    `compromis. Va sur la page de connexion et utilise « reset destructif »`,
    `pour invalider l'accès.`,
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = [
    `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#111827;">Récupération ${factorLabel} appliquée</h2>`,
    `<p style="margin:0 0 12px 0;">${escapeHtml(removedLine)}</p>`,
    params.downgraded
      ? `<p style="margin:0 0 12px 0;">Ton mode de sécurité est repassé à <strong>Standard</strong> (mot de passe ou passkey).</p>`
      : ``,
    `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Re-active ${factorLabel} dès que possible depuis Settings &rarr; Sécurité.</p>`,
    `<div style="margin:24px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">`,
    `  <p style="margin:0;font-size:14px;color:#7f1d1d;"><strong>Si ce n'est PAS toi&nbsp;:</strong> ton compte est compromis. Va sur la page de connexion et utilise <strong>« reset destructif »</strong> pour invalider l'accès.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n');

  const layout = renderLayout({
    subject,
    preheader: `Récupération ${factorLabel} appliquée sur Nodea.`,
    bodyText,
    bodyHtml,
  });

  return { subject, text: layout.text, html: layout.html };
}
