/**
 * French email strings — canonical locale (DEFAULT_LANGUAGE in
 * `i18n.ts`). The shape exported here defines `EmailLocaleShape`,
 * which `en.ts` imports and conforms to — so a missing key on the
 * EN side is a TS error.
 *
 * Granular keys, one per text slot — HTML markup stays inside the
 * template (it doesn't change between languages, only the prose
 * does). Where the plain-text and HTML variants of a slot diverge
 * semantically (« clique sur ce lien » vs a CTA button label),
 * both keys live side by side.
 *
 * `{token}` placeholders are interpolated by `emailT`.
 *
 * Note : we deliberately do NOT use `as const` — the goal is to
 * capture the *shape* of a locale, not the literal FR strings, so
 * EN can plug different values without TS narrowing each leaf to
 * `'Tu es invité·e…'` and rejecting `'You're invited…'`.
 */
export interface EmailLocaleShape {
  layout: {
    footerSignature: string;
    footerAutoLine: string;
    footerIgnoreLine: string;
  };
  invite: {
    subject: string;
    preheader: string;
    heading: string;
    instructionText: string;
    instructionHtml: string;
    cta: string;
    validity: string;
    description: string;
    ignoreNote: string;
  };
  passwordReset: {
    subject: string;
    preheader: string;
    heading: string;
    requestText: string;
    requestHtml: string;
    instructionText: string;
    cta: string;
    validity: string;
    warningText: string;
    warningHtmlPrefix: string;
    warningHtmlBody: string;
    ignoreNote: string;
  };
  registerActivate: {
    subject: string;
    preheader: string;
    heading: string;
    instructionText: string;
    instructionHtml: string;
    cta: string;
    validity: string;
    ignoreNote: string;
  };
  registerAlreadyExists: {
    subject: string;
    preheader: string;
    heading: string;
    introText: string;
    introHtml: string;
    ctaLogin: string;
    resetText: string;
    resetHtml: string;
    ifNotYouText: string;
    ifNotYouHtml: string;
  };
  mfaBypass: {
    subject: string;
    preheader: string;
    heading: string;
    factorLabelTotp: string;
    factorLabelPasskey: string;
    factorVerboseTotp: string;
    factorVerbosePasskey: string;
    sideEffectTotp: string;
    sideEffectPasskey: string;
    requestText: string;
    requestHtml: string;
    legitLine: string;
    confirmHere: string;
    cta: string;
    delayLine: string;
    delayLineHtml: string;
    notYouTextHeader: string;
    notYouTextBody: string;
    notYouHtmlLabel: string;
    notYouHtmlBody: string;
    compromiseNoteText: string;
    compromiseNoteHtml: string;
  };
  mfaBypassApplied: {
    subject: string;
    preheader: string;
    heading: string;
    factorPluralTotp: string;
    factorPluralPasskey: string;
    summary: string;
    removedTotp: string;
    removedPasskey: string;
    downgradedText: string;
    downgradedHtml: string;
    reactivate: string;
    reactivateHtml: string;
    notYouTextLine1: string;
    notYouTextLine2: string;
    notYouTextLine3: string;
    notYouHtmlLabel: string;
    notYouHtmlBody: string;
  };
  recoveryApplied: {
    subject: string;
    preheader: string;
    heading: string;
    summaryText: string;
    summaryHtml: string;
    sessionsRevoked: string;
    legitText: string;
    legitHtml: string;
    notYouTextHeader: string;
    notYouTextIntro: string;
    notYouHtmlLabel: string;
    notYouHtmlIntro: string;
    step1: string;
    step2Text: string;
    step2Html: string;
    step3: string;
  };
  securityModeDowngraded: {
    subject: string;
    preheader: string;
    heading: string;
    triggerTotpDisabled: string;
    triggerLastPrfPasskey: string;
    triggerLastPasskey: string;
    previousLabelAlways2fa: string;
    previousLabelMaximum: string;
    standardLabel: string;
    summaryTextLine1: string;
    summaryTextLine2: string;
    summaryHtml: string;
    behaviorText: string;
    behaviorHtml: string;
    upgradeIntroText: string;
    upgradeIntroHtml: string;
    upgradeStep1: string;
    upgradeStep2: string;
    upgradeStep3: string;
    notYouText: string;
    notYouHtmlLabel: string;
    notYouHtmlBody: string;
  };
}

export const fr: EmailLocaleShape = {
  layout: {
    footerSignature: "L'équipe Nodea",
    footerAutoLine: 'Cet email a été envoyé automatiquement.',
    footerIgnoreLine:
      "Si tu n'attendais rien de notre part, ignore-le simplement — aucune action ne sera prise sur ton compte.",
  },

  invite: {
    subject: 'Tu es invité·e à créer ton espace Nodea',
    preheader: 'Crée ton espace Nodea — lien valable {ttl} jours.',
    heading: 'Tu es invité·e à créer ton espace Nodea.',
    instructionText: 'Pour créer ton compte, clique sur ce lien :',
    instructionHtml: 'Pour créer ton compte, clique sur le bouton ci-dessous :',
    cta: 'Créer mon compte',
    validity: 'Le lien est valable {ttl} jours.',
    description:
      'Nodea est un espace privé, chiffré bout en bout — tes données ne quittent pas ta machine sans être chiffrées avec une clé que tu contrôles seul·e.',
    ignoreNote: 'Si ce message ne te concerne pas, ignore-le simplement.',
  },

  passwordReset: {
    subject: 'Réinitialisation de ton mot de passe Nodea',
    preheader:
      'Demande de réinitialisation de ton mot de passe Nodea. Lien valable 1 heure.',
    heading: 'Réinitialisation du mot de passe',
    requestText: "Quelqu'un (toi ?) a demandé la réinitialisation de ton mot de passe Nodea.",
    requestHtml:
      "Quelqu'un (toi ?) a demandé la réinitialisation de ton mot de passe Nodea.",
    instructionText: "Ouvre ce lien dans l'heure pour continuer :",
    cta: 'Réinitialiser mon mot de passe',
    validity: 'Lien valable 1 heure.',
    warningText:
      '⚠ Attention : tes données sont chiffrées avec une clé dérivée de ton mot de passe. Réinitialiser le mot de passe entraîne la perte définitive de toutes tes entrées déjà enregistrées.',
    warningHtmlPrefix: '⚠ Attention :',
    warningHtmlBody:
      'tes données sont chiffrées avec une clé dérivée de ton mot de passe. Réinitialiser le mot de passe entraîne la <strong>perte définitive</strong> de toutes tes entrées déjà enregistrées.',
    ignoreNote:
      "Si tu n'es pas à l'origine de la demande, ignore ce message — ton compte et tes données restent intacts.",
  },

  registerActivate: {
    subject: 'Active ton compte Nodea',
    preheader: 'Active ton compte Nodea — lien valable {ttl} jours.',
    heading: 'Bienvenue sur Nodea !',
    instructionText:
      'Pour activer ton compte et pouvoir te connecter, clique sur ce lien :',
    instructionHtml:
      'Pour activer ton compte et pouvoir te connecter, clique sur le bouton ci-dessous :',
    cta: 'Activer mon compte',
    validity: 'Le lien expire dans {ttl} jours.',
    ignoreNote:
      "Si tu n'es pas à l'origine de cette inscription, ignore ce message — aucun compte ne sera activé sans ce clic.",
  },

  registerAlreadyExists: {
    subject: 'Tentative de création de compte sur Nodea',
    preheader:
      "Quelqu'un a tenté de créer un compte avec cette adresse — tu as déjà un compte chez nous.",
    heading: "Tu as déjà un compte chez nous.",
    introText:
      "Quelqu'un (toi ?) vient de tenter de créer un nouveau compte Nodea avec cette adresse e-mail. Aucun nouveau compte n'a été créé : tu en as déjà un.",
    introHtml:
      "Quelqu'un (toi ?) vient de tenter de créer un nouveau compte Nodea avec cette adresse e-mail. Aucun nouveau compte n'a été créé : tu en as déjà un.",
    ctaLogin: 'Me connecter',
    resetText:
      'Mot de passe oublié ? Tu peux le réinitialiser ici :',
    resetHtml:
      'Mot de passe oublié ? Tu peux le réinitialiser ici :',
    ifNotYouText:
      "Si ce n'est pas toi qui a tenté cette inscription, ignore simplement ce message — aucune action n'a été prise sur ton compte.",
    ifNotYouHtml:
      "Si ce n'est pas toi qui a tenté cette inscription, ignore simplement ce message — aucune action n'a été prise sur ton compte.",
  },

  mfaBypass: {
    subject: 'Récupération de {factor} — confirme par email',
    preheader:
      'Demande de récupération {factor} sur Nodea — délai 7 jours après confirmation.',
    heading: 'Récupération de {factor}',
    factorLabelTotp: 'TOTP',
    factorLabelPasskey: 'passkey',
    factorVerboseTotp: 'la 2FA TOTP (codes à 6 chiffres)',
    factorVerbosePasskey: 'la passkey (Touch ID / Face ID / Yubikey)',
    sideEffectTotp: 'Ton TOTP sera désactivé et tes codes de secours invalidés.',
    sideEffectPasskey:
      'Toutes tes passkeys seront supprimées — tu pourras en réenrôler de nouvelles après le login.',
    requestText:
      "Quelqu'un (toi ?) a demandé à se connecter à Nodea sans {factorVerbose}.",
    requestHtml:
      "Quelqu'un (toi ?) a demandé à se connecter à Nodea <strong>sans {factorVerbose}</strong>.",
    legitLine: "Si c'est bien toi (tu as perdu ton appareil / ta clé) :",
    confirmHere: 'Confirme ici : {link}',
    cta: 'Confirmer la récupération',
    delayLine:
      'Tu pourras alors te reconnecter sans {factor} 7 jours après cette confirmation. {sideEffect}',
    delayLineHtml: 'Délai de 7 jours après confirmation. {sideEffect}',
    notYouTextHeader: "Si ce n'est PAS toi : il suffit de te reconnecter normalement à Nodea.",
    notYouTextBody: 'Une connexion réussie annule automatiquement la demande.',
    notYouHtmlLabel: "Si ce n'est PAS toi :",
    notYouHtmlBody:
      'Il suffit de te <strong>reconnecter normalement</strong> à Nodea — une connexion réussie annule automatiquement la demande, pas besoin de cliquer ici.',
    compromiseNoteText:
      'Si tu suspectes que ton compte est compromis, change ton mot de passe depuis Compte → Sécurité — toutes les sessions actives seront invalidées et la demande sera annulée par la même occasion.',
    compromiseNoteHtml:
      'Si tu suspectes que ton compte est compromis, change ton mot de passe depuis <strong>Compte &rarr; Sécurité</strong> — toutes les sessions actives seront invalidées et la demande sera annulée par la même occasion.',
  },

  mfaBypassApplied: {
    subject: 'Récupération {factorPlural} appliquée',
    preheader: 'Récupération {factorPlural} appliquée sur Nodea.',
    heading: 'Récupération {factorPlural} appliquée',
    factorPluralTotp: 'TOTP',
    factorPluralPasskey: 'passkeys',
    summary:
      "Ta demande de récupération {factorPlural} sur Nodea vient d'être appliquée.",
    removedTotp: 'Ton TOTP est désactivé et tes 10 codes de secours sont invalidés.',
    removedPasskey: 'Toutes tes passkeys ont été supprimées.',
    downgradedText: 'Ton mode de sécurité est repassé à "Standard" (mot de passe ou passkey).',
    downgradedHtml:
      'Ton mode de sécurité est repassé à <strong>Standard</strong> (mot de passe ou passkey).',
    reactivate: 'Re-active {factorPlural} dès que possible depuis Compte → Sécurité.',
    reactivateHtml:
      'Re-active {factorPlural} dès que possible depuis Compte &rarr; Sécurité.',
    notYouTextLine1:
      "Si ce n'est pas toi qui as déclenché cette opération, ton compte est",
    notYouTextLine2:
      'peut-être compromis : change ton mot de passe immédiatement depuis',
    notYouTextLine3:
      'Compte → Sécurité — toutes les sessions actives seront invalidées.',
    notYouHtmlLabel: "Si ce n'est PAS toi :",
    notYouHtmlBody:
      'ton compte est peut-être compromis. <strong>Change ton mot de passe immédiatement</strong> depuis Compte &rarr; Sécurité — toutes les sessions actives seront invalidées.',
  },

  recoveryApplied: {
    subject: 'Mot de passe réinitialisé via code de récupération',
    preheader:
      "Réinitialisation par code de récupération sur Nodea — vérifie que c'est bien toi.",
    heading: 'Mot de passe réinitialisé via code de récupération',
    summaryText:
      "Quelqu'un (toi ?) vient de réinitialiser le mot de passe de ton compte Nodea via le code de récupération à 12 mots.",
    summaryHtml:
      "Quelqu'un (toi ?) vient de <strong>réinitialiser le mot de passe</strong> de ton compte Nodea via le code de récupération à 12 mots.",
    sessionsRevoked:
      "Toutes tes sessions actives ont été révoquées. Le code de récupération que tu viens d'utiliser est désormais invalide — pense à en configurer un nouveau dans tes réglages, sans quoi tu n'auras plus de filet en cas d'oubli du mot de passe.",
    legitText:
      "Si c'est bien toi : tout est en ordre, tu peux te reconnecter avec ton nouveau mot de passe.",
    legitHtml:
      "Si c'est bien toi : tout est en ordre, tu peux te reconnecter avec ton nouveau mot de passe.",
    notYouTextHeader: "Si ce n'est PAS toi : ton code de récupération a été compromis.",
    notYouTextIntro: 'Reprends le contrôle MAINTENANT depuis Compte → Sécurité :',
    notYouHtmlLabel: "Si ce n'est PAS toi :",
    notYouHtmlIntro:
      'Ton code de récupération a été compromis. Reprends le contrôle <strong>maintenant</strong> depuis Compte &rarr; Sécurité :',
    step1: 'Change ton mot de passe (révoque toutes les sessions à nouveau).',
    step2Text: 'Régénère un nouveau code de récupération (et garde-le hors-ligne).',
    step2Html: 'Régénère un nouveau code de récupération (garde-le hors-ligne).',
    step3:
      'Vérifie tes facteurs MFA (TOTP, passkeys) — supprime tout ce que tu ne reconnais pas.',
  },

  securityModeDowngraded: {
    subject: 'Mode de sécurité abaissé à Standard',
    preheader: 'Mode de sécurité Nodea repassé à Standard suite à {trigger}.',
    heading: 'Mode de sécurité abaissé à Standard',
    triggerTotpDisabled: 'la désactivation de ton TOTP',
    triggerLastPrfPasskey: 'la suppression de ta dernière passkey compatible PRF',
    triggerLastPasskey: 'la suppression de ta dernière passkey',
    previousLabelAlways2fa: 'TOTP obligatoire',
    previousLabelMaximum: 'Maximum',
    standardLabel: 'Standard',
    summaryTextLine1: 'Suite à {trigger}, ton mode de sécurité Nodea est repassé',
    summaryTextLine2: 'de "{previous}" à "Standard" (mot de passe ou passkey).',
    summaryHtml:
      'Suite à <strong>{trigger}</strong>, ton mode de sécurité Nodea est repassé de <strong>« {previous} »</strong> à <strong>« Standard »</strong> (mot de passe ou passkey).',
    behaviorText:
      'Concrètement : la prochaine connexion ne demandera que ton mot de passe (ou une passkey) — plus de second facteur obligatoire.',
    behaviorHtml:
      'Concrètement : la prochaine connexion ne demandera que ton mot de passe (ou une passkey) — plus de second facteur obligatoire.',
    upgradeIntroText: 'Si tu veux remonter le niveau de sécurité, depuis Compte → Sécurité :',
    upgradeIntroHtml: 'Pour remonter le niveau de sécurité (depuis Compte &rarr; Sécurité) :',
    upgradeStep1: 'Réactive le TOTP, ou',
    upgradeStep2: 'Enregistre une passkey compatible PRF (Touch ID, Face ID, Yubikey),',
    upgradeStep3: 'puis change le mode dans la même page.',
    notYouText:
      "Si ce n'est PAS toi qui as déclenché cette opération, ton compte est peut-être compromis : change ton mot de passe immédiatement depuis Compte → Sécurité — toutes les sessions actives seront invalidées.",
    notYouHtmlLabel: "Si ce n'est PAS toi :",
    notYouHtmlBody:
      'ton compte est peut-être compromis. <strong>Change ton mot de passe immédiatement</strong> depuis Compte &rarr; Sécurité — toutes les sessions actives seront invalidées.',
  },
};
