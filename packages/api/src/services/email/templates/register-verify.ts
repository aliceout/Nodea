import type { SendMailParams } from '../types.ts';

/**
 * Template for the inscription email verification code (Auth-Spec.md
 * §7.1 step 1). Localised in French — UTF-8 throughout, accents
 * preserved per CLAUDE.md.
 *
 * Returns a partially-built `SendMailParams` object with subject + bodies
 * filled. The caller adds `to` and `tag`. Kept pure (no I/O) so tests
 * can assert on the rendered output without mocking the transport.
 */
export function renderRegisterVerifyEmail(params: {
  code: string;
  /** Minutes until the code expires. Default 10. */
  ttlMinutes?: number;
}): Pick<SendMailParams, 'subject' | 'text' | 'html'> {
  const ttl = params.ttlMinutes ?? 10;
  const code = params.code;

  const text = [
    `Bienvenue sur Nodea !`,
    ``,
    `Pour finaliser ton inscription, saisis ce code dans la page d'inscription :`,
    ``,
    `    ${code}`,
    ``,
    `Le code expire dans ${ttl} minutes. Si tu ne te reconnais pas dans cette demande,`,
    `tu peux ignorer ce message — aucun compte ne sera créé sans ce code.`,
    ``,
    `— L'équipe Nodea`,
  ].join('\n');

  const html = [
    `<p>Bienvenue sur Nodea !</p>`,
    `<p>Pour finaliser ton inscription, saisis ce code dans la page d'inscription :</p>`,
    `<p style="font-family: ui-monospace, monospace; font-size: 1.4em; letter-spacing: 0.2em; padding: 0.5em 1em; background: #f3f4f6; border-radius: 6px; display: inline-block;">${code}</p>`,
    `<p>Le code expire dans ${ttl} minutes. Si tu ne te reconnais pas dans cette demande, tu peux ignorer ce message — aucun compte ne sera créé sans ce code.</p>`,
    `<p>— L'équipe Nodea</p>`,
  ].join('\n');

  return {
    subject: `Ton code d'inscription Nodea : ${code}`,
    text,
    html,
  };
}
