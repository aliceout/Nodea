import type { EmailLocale } from '../i18n.ts';

/**
 * English email strings — mirrors the FR shape exactly. The
 * `EmailLocale` annotation makes a missing key a TS error before
 * runtime — the FR side is the canonical contract, EN must match.
 *
 * Tone notes :
 *   - We use second-person singular « you » throughout (no formal
 *     « you all » splits) to match the FR « tu » register.
 *   - Inclusivity tokens like « invité·e » don't translate — EN
 *     gendered nouns are neutral by default, so the EN string is
 *     just the regular form.
 *   - Composé operators (« — ») are kept verbatim; modern EN inboxes
 *     handle them fine.
 */
export const en: EmailLocale = {
  layout: {
    footerSignature: 'The Nodea team',
    footerAutoLine: 'This email was sent automatically.',
    footerIgnoreLine:
      "If you weren't expecting anything from us, just ignore it — no action will be taken on your account.",
  },

  invite: {
    subject: "You're invited to create your Nodea space",
    preheader: 'Create your Nodea space — link valid for {ttl} days.',
    heading: "You're invited to create your Nodea space.",
    instructionText: 'To create your account, click this link:',
    instructionHtml: 'To create your account, click the button below:',
    cta: 'Create my account',
    validity: 'The link is valid for {ttl} days.',
    description:
      'Nodea is a private, end-to-end encrypted space — your data never leaves your machine without being encrypted with a key only you control.',
    ignoreNote: "If this message isn't meant for you, just ignore it.",
  },

  passwordReset: {
    subject: 'Reset your Nodea password',
    preheader: 'Password reset request for your Nodea account. Link valid for 1 hour.',
    heading: 'Password reset',
    requestText: 'Someone (you?) asked to reset your Nodea password.',
    requestHtml: 'Someone (you?) asked to reset your Nodea password.',
    instructionText: 'Open this link within the hour to continue:',
    cta: 'Reset my password',
    validity: 'Link valid for 1 hour.',
    warningText:
      '⚠ Warning: your data is encrypted with a key derived from your password. Resetting the password results in the permanent loss of every entry already stored.',
    warningHtmlPrefix: '⚠ Warning:',
    warningHtmlBody:
      'your data is encrypted with a key derived from your password. Resetting the password results in the <strong>permanent loss</strong> of every entry already stored.',
    ignoreNote:
      "If you didn't request this, just ignore the message — your account and your data remain intact.",
  },

  registerActivate: {
    subject: 'Activate your Nodea account',
    preheader: 'Activate your Nodea account — link valid for {ttl} days.',
    heading: 'Welcome to Nodea!',
    instructionText: 'To activate your account and sign in, click this link:',
    instructionHtml: 'To activate your account and sign in, click the button below:',
    cta: 'Activate my account',
    validity: 'The link expires in {ttl} days.',
    ignoreNote:
      "If you didn't sign up, just ignore the message — no account will be activated without this click.",
  },

  registerAlreadyExists: {
    subject: 'Account creation attempt on Nodea',
    preheader:
      'Someone tried to create an account with this address — you already have one with us.',
    heading: 'You already have an account with us.',
    introText:
      "Someone (you?) just tried to create a new Nodea account with this email address. No new account was created: you already have one.",
    introHtml:
      "Someone (you?) just tried to create a new Nodea account with this email address. No new account was created: you already have one.",
    ctaLogin: 'Sign in',
    resetText:
      'Forgot your password? You can reset it here:',
    resetHtml:
      'Forgot your password? You can reset it here:',
    ifNotYouText:
      "If it wasn't you who attempted this signup, just ignore this message — no action has been taken on your account.",
    ifNotYouHtml:
      "If it wasn't you who attempted this signup, just ignore this message — no action has been taken on your account.",
  },

  mfaBypass: {
    subject: '{factor} recovery — confirm by email',
    preheader: '{factor} recovery request on Nodea — 7-day delay after confirmation.',
    heading: '{factor} recovery',
    factorLabelTotp: 'TOTP',
    factorLabelPasskey: 'passkey',
    factorVerboseTotp: 'TOTP 2FA (6-digit codes)',
    factorVerbosePasskey: 'a passkey (Touch ID / Face ID / Yubikey)',
    sideEffectTotp: 'Your TOTP will be disabled and your backup codes invalidated.',
    sideEffectPasskey:
      "All your passkeys will be removed — you'll be able to enrol new ones after signing in.",
    requestText: 'Someone (you?) asked to sign in to Nodea without {factorVerbose}.',
    requestHtml:
      'Someone (you?) asked to sign in to Nodea <strong>without {factorVerbose}</strong>.',
    legitLine: "If that's you (you lost your device / your key):",
    confirmHere: 'Confirm here: {link}',
    cta: 'Confirm recovery',
    delayLine:
      "You'll then be able to sign in without {factor} 7 days after this confirmation. {sideEffect}",
    delayLineHtml: '7-day delay after confirmation. {sideEffect}',
    notYouTextHeader: "If it's NOT you: just sign in to Nodea normally.",
    notYouTextBody: 'A successful sign-in automatically cancels the request.',
    notYouHtmlLabel: "If it's NOT you:",
    notYouHtmlBody:
      "Just <strong>sign in normally</strong> to Nodea — a successful sign-in automatically cancels the request, no need to click here.",
    compromiseNoteText:
      'If you suspect your account is compromised, change your password from Account → Security — every active session will be invalidated and the request cancelled along with them.',
    compromiseNoteHtml:
      'If you suspect your account is compromised, change your password from <strong>Account &rarr; Security</strong> — every active session will be invalidated and the request cancelled along with them.',
  },

  mfaBypassApplied: {
    subject: '{factorPlural} recovery applied',
    preheader: '{factorPlural} recovery applied on Nodea.',
    heading: '{factorPlural} recovery applied',
    factorPluralTotp: 'TOTP',
    factorPluralPasskey: 'passkeys',
    summary: 'Your {factorPlural} recovery request on Nodea was just applied.',
    removedTotp: 'Your TOTP is disabled and your 10 backup codes are invalidated.',
    removedPasskey: 'All your passkeys have been removed.',
    downgradedText: 'Your security mode is back to "Standard" (password or passkey).',
    downgradedHtml:
      'Your security mode is back to <strong>Standard</strong> (password or passkey).',
    reactivate: 'Re-enable {factorPlural} as soon as possible from Account → Security.',
    reactivateHtml:
      'Re-enable {factorPlural} as soon as possible from Account &rarr; Security.',
    notYouTextLine1:
      "If you didn't trigger this operation, your account may be",
    notYouTextLine2:
      'compromised: change your password immediately from',
    notYouTextLine3:
      'Account → Security — every active session will be invalidated.',
    notYouHtmlLabel: "If it's NOT you:",
    notYouHtmlBody:
      'your account may be compromised. <strong>Change your password immediately</strong> from Account &rarr; Security — every active session will be invalidated.',
  },

  recoveryApplied: {
    subject: 'Password reset via recovery code',
    preheader: 'Recovery-code reset on Nodea — make sure it was you.',
    heading: 'Password reset via recovery code',
    summaryText:
      'Someone (you?) just reset your Nodea password using the 12-word recovery code.',
    summaryHtml:
      'Someone (you?) just <strong>reset the password</strong> on your Nodea account using the 12-word recovery code.',
    sessionsRevoked:
      "Every active session was revoked. The recovery code you just used is now invalid — please configure a new one in your settings, otherwise you'll have no fallback if you forget your password.",
    legitText:
      "If that's you: everything is in order, you can sign in again with your new password.",
    legitHtml:
      "If that's you: everything is in order, you can sign in again with your new password.",
    notYouTextHeader: "If it's NOT you: your recovery code has been compromised.",
    notYouTextIntro: 'Take back control NOW from Account → Security:',
    notYouHtmlLabel: "If it's NOT you:",
    notYouHtmlIntro:
      'Your recovery code has been compromised. Take back control <strong>now</strong> from Account &rarr; Security:',
    step1: 'Change your password (revoke every session again).',
    step2Text: 'Regenerate a new recovery code (and keep it offline).',
    step2Html: 'Regenerate a new recovery code (keep it offline).',
    step3:
      'Check your MFA factors (TOTP, passkeys) — remove anything you don\'t recognise.',
  },

  securityModeDowngraded: {
    subject: 'Security mode lowered to Standard',
    preheader: 'Nodea security mode back to Standard following {trigger}.',
    heading: 'Security mode lowered to Standard',
    triggerTotpDisabled: 'disabling your TOTP',
    triggerLastPrfPasskey: 'removing your last PRF-capable passkey',
    triggerLastPasskey: 'removing your last passkey',
    previousLabelAlways2fa: 'TOTP required',
    previousLabelMaximum: 'Maximum',
    standardLabel: 'Standard',
    summaryTextLine1: 'Following {trigger}, your Nodea security mode is back',
    summaryTextLine2: 'from "{previous}" to "Standard" (password or passkey).',
    summaryHtml:
      'Following <strong>{trigger}</strong>, your Nodea security mode is back from <strong>« {previous} »</strong> to <strong>« Standard »</strong> (password or passkey).',
    behaviorText:
      "Concretely: the next sign-in will only ask for your password (or a passkey) — no second factor required anymore.",
    behaviorHtml:
      "Concretely: the next sign-in will only ask for your password (or a passkey) — no second factor required anymore.",
    upgradeIntroText: 'To raise the security level back, from Account → Security:',
    upgradeIntroHtml: 'To raise the security level back (from Account &rarr; Security):',
    upgradeStep1: 'Re-enable TOTP, or',
    upgradeStep2: 'Register a PRF-capable passkey (Touch ID, Face ID, Yubikey),',
    upgradeStep3: 'then switch the mode on the same page.',
    notYouText:
      "If it's NOT you who triggered this, your account may be compromised: change your password immediately from Account → Security — every active session will be invalidated.",
    notYouHtmlLabel: "If it's NOT you:",
    notYouHtmlBody:
      'your account may be compromised. <strong>Change your password immediately</strong> from Account &rarr; Security — every active session will be invalidated.',
  },
};
