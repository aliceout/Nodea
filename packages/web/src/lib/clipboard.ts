/**
 * Clipboard helper for SENSITIVE values (audit 2026-06, issue #137).
 *
 * `copyWithExpiry` copies a secret (TOTP seed, recovery code, backup
 * codes) and then clears the clipboard after `ttlMs`, so the secret
 * doesn't sit there indefinitely waiting to be pasted somewhere — or
 * read by the next thing that inspects the clipboard.
 *
 * Best-effort clear :
 *   - If the clipboard can be read back (Chromium exposes `readText`
 *     to focused secure pages), we only clear when it STILL holds our
 *     value — so we never wipe something the user copied in between.
 *   - If it can't be read (Firefox blocks page-side `readText`, or the
 *     tab lost focus), we clear unconditionally : for a secret, bounding
 *     the exposure window beats the rare chance of clobbering unrelated
 *     clipboard content 30 s later.
 *
 * **Limitation (documented, accepted).** This only bounds the *live*
 * clipboard. It cannot purge OS clipboard *history* (Windows Win+V,
 * macOS clipboard managers) — that already captured the value at copy
 * time. The realistic, addressable threat is the secret lingering in
 * the active clipboard ; that's what this shortens.
 *
 * Mirrors the native `clipboard.writeText` contract : it rejects when
 * the initial copy fails (no permission / insecure context), so callers
 * keep their existing « copied! » success / catch branches unchanged.
 */

/** Default time a copied secret is allowed to live in the clipboard.
 *  Long enough to paste into an authenticator / password manager,
 *  short enough to bound exposure. */
const SENSITIVE_CLIPBOARD_TTL_MS = 30_000;

export async function copyWithExpiry(
  value: string,
  ttlMs: number = SENSITIVE_CLIPBOARD_TTL_MS,
): Promise<void> {
  await navigator.clipboard.writeText(value);
  setTimeout(() => {
    void clearClipboardIfHolds(value);
  }, ttlMs);
}

async function clearClipboardIfHolds(value: string): Promise<void> {
  try {
    const current = await navigator.clipboard.readText();
    // The user copied something else since — leave their clipboard be.
    if (current !== value) return;
  } catch {
    // `readText` unavailable / denied (Firefox, unfocused tab) — fall
    // through and clear : for a secret, security wins over the small
    // chance of wiping unrelated content.
  }
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Clear denied (tab unfocused, permission revoked) — best-effort,
    // nothing more we can safely do.
  }
}
