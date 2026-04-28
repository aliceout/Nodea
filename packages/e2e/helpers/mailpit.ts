/**
 * Mailpit HTTP API helper — Mailpit listens on :1025 for SMTP and
 * exposes a REST API on :8025 for inspecting captured messages.
 *
 * The api's email service is configured to point at the SMTP port
 * via env (`SMTP_HOST=localhost`, `SMTP_PORT=1025`), so any email
 * the api would send in dev / e2e ends up here, never leaving the
 * machine.
 */

const MAILPIT_BASE = process.env['MAILPIT_BASE_URL'] ?? 'http://localhost:8025';

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
  Text: string;
  HTML: string;
  Created: string;
}

interface MailpitListResponse {
  messages: { ID: string; To: { Address: string }[]; Subject: string; Created: string }[];
  total: number;
}

/** Poll until an email matching the predicate lands, or throw on
 *  timeout. The default 30s window is enough for the api's send +
 *  Mailpit's ingest ; bump in CI if flaky. */
export async function waitForEmail(
  predicate: (msg: MailpitMessage) => boolean,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<MailpitMessage> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const pollMs = opts.pollMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await listMessages();
    for (const summary of list.messages) {
      const full = await getMessage(summary.ID);
      if (predicate(full)) return full;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `[mailpit] no message matched the predicate within ${timeoutMs}ms`,
  );
}

export async function listMessages(): Promise<MailpitListResponse> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages?limit=50`);
  if (!res.ok) {
    throw new Error(`Mailpit /api/v1/messages → ${res.status}`);
  }
  return (await res.json()) as MailpitListResponse;
}

async function getMessage(id: string): Promise<MailpitMessage> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/message/${id}`);
  if (!res.ok) throw new Error(`Mailpit /api/v1/message/${id} → ${res.status}`);
  return (await res.json()) as MailpitMessage;
}

/** Empty the Mailpit inbox — call between tests so a search by
 *  subject doesn't pick up a stale message from earlier. */
export async function clearInbox(): Promise<void> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Mailpit DELETE → ${res.status}`);
}

/* ============================================================================
 * Convenience extractors for the auth flows
 * ========================================================================== */

/** Find the activation link in a register-activate email for the
 *  given recipient. The template puts the link in a stand-alone
 *  paragraph — match the `?token=…` query string. */
export async function waitForActivationLink(
  recipient: string,
): Promise<string> {
  const msg = await waitForEmail(
    (m) =>
      m.To.some((t) => t.Address.toLowerCase() === recipient.toLowerCase()) &&
      /Active ton compte|Activate your account|activate/i.test(m.Subject),
  );
  const m = msg.Text.match(/https?:\/\/[^\s]+\/activate\?token=[^\s)\]<>]+/);
  if (!m) {
    throw new Error(
      `[mailpit] activation email matched but no /activate?token=… link found in body`,
    );
  }
  return m[0];
}

/** Find the bypass-confirm link in an MFA bypass email for the
 *  given recipient. The link points at the SPA's
 *  `/auth/bypass/confirm?t=…` route. */
export async function waitForBypassConfirmLink(
  recipient: string,
): Promise<string> {
  const msg = await waitForEmail(
    (m) =>
      m.To.some((t) => t.Address.toLowerCase() === recipient.toLowerCase()) &&
      /Récupération|Recovery|bypass/i.test(m.Subject),
  );
  const m = msg.Text.match(/https?:\/\/[^\s]+\/auth\/bypass\/confirm\?t=[^\s)\]<>]+/);
  if (!m) {
    throw new Error(
      `[mailpit] bypass email matched but no /auth/bypass/confirm?t=… link found in body`,
    );
  }
  return m[0];
}
