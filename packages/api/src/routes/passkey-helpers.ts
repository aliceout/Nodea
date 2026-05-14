import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

import { rateLimit } from '../middleware/rate-limit.ts';

/**
 * Loose stand-in for `AuthenticationExtensionsClientInputs`.
 * The `@simplewebauthn/server` lib's type doesn't include the
 * `prf` field yet, so we widen via this alias rather than
 * `any`.
 */
export type AuthenticationExtensionsClientInputsLike = Record<string, unknown>;

/** Enrollment rate limiter — 10 requests / 15 min / IP. */
export const enrollLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-enroll',
});

/** Passkey-first login rate limiter — 20 requests / 15 min /
 *  IP (matches the password login limiter's tolerance). */
export const loginLimiter = rateLimit({
  max: 20,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-login',
});

/** Manage rate limiter — list / rename / remove. Higher cap
 *  (30 / 15 min) since these can fire several times in a row
 *  while the user grooms their passkey list. */
export const manageLimiter = rateLimit({
  max: 30,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-manage',
});

/**
 * `userID` for `generateRegistrationOptions` must be a
 * `Uint8Array<ArrayBuffer>` (the lib's `Uint8Array_` alias
 * narrows to `ArrayBuffer`, not `ArrayBufferLike`). We
 * allocate a fresh `ArrayBuffer`, view it with `Uint8Array`,
 * and let TS infer the narrowed return type — declaring
 * `: Uint8Array` would widen it back to `<ArrayBufferLike>`.
 */
export function userIdToHandle(userId: string) {
  // UTF-8 of a UUID string is the same byte length as the
  // string (ASCII), so `userId.length` is a safe
  // pre-allocation.
  const buf = new ArrayBuffer(userId.length);
  const view = new Uint8Array(buf);
  new TextEncoder().encodeInto(userId, view);
  return view;
}

/**
 * Encode raw bytes as base64url (URL-safe, no padding).
 * Mirror of the web-side helper but inlined to keep the api
 * package free of a web-side import.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Decode base64url → fresh `Uint8Array` backed by its own
 * `ArrayBuffer`. `Buffer.from(value, 'base64url')` returns a
 * `Buffer` whose backing buffer is a Node-internal slab,
 * which TS widens to `ArrayBufferLike` —
 * `@simplewebauthn/server` wants the narrower
 * `Uint8Array<ArrayBuffer>` form (its `Uint8Array_` alias),
 * so we rebuild into a freshly-allocated typed array. The
 * return type is left to inference so the narrow
 * `<ArrayBuffer>` parameter survives at call sites.
 */
export function base64UrlToBytes(value: string) {
  const src = Buffer.from(value, 'base64url');
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}

/**
 * Decode the `transports` CSV stored on `auth_factors.transports`
 * back into the lib's enum-ish array. Browsers / authenticators
 * report a wider transport set than what
 * `AuthenticatorTransportFuture` enumerates today ; we trust
 * the round-tripped values without filtering since storage was
 * already controlled by us at enrollment.
 */
export function parseTransports(
  csv: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  const parts = csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  return parts as AuthenticatorTransportFuture[];
}
