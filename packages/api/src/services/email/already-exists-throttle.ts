/**
 * In-memory throttle for the « already-exists » notice mail
 * (Auth-Spec §7.1, dual-mail anti-enum pattern, issue #45).
 *
 * When `POST /auth/register/finish` hits the existing-email branch
 * on the open path, we silent-200 the submitter (anti-enum) but
 * we email the rightful owner of the address to tell them what
 * happened. Without a throttle, that route becomes a notification
 * spam vector — anyone can mail-bomb a target by replaying the
 * register call. We cap at one notice per email per hour.
 *
 * The throttle is in-memory and per-process. A single-instance
 * self-host (Nodea's target deployment) has no sync issue ; a
 * multi-instance setup would let an attacker stack one notice per
 * instance, but that's still a small constant — not exploited
 * here, and the bigger concern would be the multi-instance setup's
 * own rate-limit story.
 *
 * Side-effect to know about (documented in Auth-Spec §7.1) : the
 * 2nd+ attempt within the hour returns ~50ms faster than the 1st
 * because the mailer call is short-circuited. A patient attacker
 * could probe that timing gap to distinguish « free email » from
 * « taken email ». Accepted trade-off : spam prevention matters
 * more than perfect timing parity, and the 50ms gap sits below
 * the OPAQUE handshake's own variance.
 */

import type { Context } from 'hono';

import { getConfig } from '../../config.ts';
import { globalSingleton } from '../../lib/global-singleton.ts';
import {
  extractEmailLanguage,
  type SupportedEmailLanguage,
} from './i18n.ts';
import { getEmailService } from './index.ts';
import { renderRegisterAlreadyExistsEmail } from './templates/register-already-exists.ts';

/** Window during which a second notice for the same email is
 *  suppressed. 1 hour is a sweet spot — long enough to defeat a
 *  spam flood, short enough that a real second attempt from the
 *  legitimate owner the next day re-emits the notice. */
const THROTTLE_MS = 60 * 60 * 1000;

// Stashed on globalThis so Vitest 4's per-test-file module
// re-evaluation can't fragment the storage — see [[global-singleton]].
const lastSentAt = globalSingleton(
  '__nodea_already_exists_throttle',
  () => new Map<string, number>(),
);

/** Send the « already exists » notice unless this email has
 *  already received one within the throttle window. Always
 *  resolves successfully — mailer hiccups are logged in dev and
 *  swallowed in production so the anti-enum response stays
 *  identical to the success path. */
export async function maybeSendAlreadyExistsNotice(
  c: Context,
  email: string,
): Promise<void> {
  const now = Date.now();
  const last = lastSentAt.get(email);
  if (last !== undefined && now - last < THROTTLE_MS) return;
  lastSentAt.set(email, now);

  const language: SupportedEmailLanguage = extractEmailLanguage(c);
  const cfg = getConfig();
  const base = (cfg.WEB_BASE_URL ?? '').replace(/\/$/, '');
  const loginUrl = `${base}/login`;
  const resetUrl = `${base}/request-reset`;

  try {
    const rendered = renderRegisterAlreadyExistsEmail({
      language,
      loginUrl,
      resetUrl,
    });
    await getEmailService().send({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tag: 'register-already-exists',
    });
  } catch (err) {
    // Log in every env, prod included (audit v2.8.0). The previous
    // gate hid SMTP-transport failures from production logs ; an
    // operator chasing « mail not arriving » had nothing in the
    // logs because the catch silently swallowed the error. We log
    // only the error's presence + a class hint, never the
    // recipient nor the rendered body — the user-tag identifies
    // the surface (anti-enum « already-exists » notice).
    console.warn(
      '[auth/register] already-exists notice mail failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Test-only : clear the throttle map. Called from
 *  `src/test/setup.ts` `beforeEach` so each spec starts with a
 *  pristine map regardless of what the previous one mailed. */
export function __resetAlreadyExistsThrottle(): void {
  lastSentAt.clear();
}
