/**
 * Shared HTTP helpers for the typed API client. The public surface
 * lives in `client.ts` (barrel re-export) and the per-domain modules
 * (`auth.ts`, `passkeys.ts`, `library.ts`, …) — this file is the
 * internal plumbing they all share.
 *
 * Note: we deliberately do not use `hono/client`'s `hc<AppType>`
 * inference here. The Hono app is assembled via `app.route(...)`
 * mounts which break through-typing without refactor; doing that
 * refactor is not in Phase 5's scope. Shared Zod schemas give us the
 * same guarantees at the payload level.
 */

/**
 * Base URL for the API. Defaults to the same-origin `/api` prefix so
 * cookies flow without any cross-origin dance:
 *   - dev : the Vite proxy (see `packages/web/vite.config.js`) routes
 *     `/api/*` to the Hono dev server on :3000.
 *   - prod: nginx reverse-proxies `/api/*` to the api container.
 * Override via `VITE_API_URL` if you really need to hit a different
 * origin — but beware `SameSite=Lax` will reject the session cookie.
 * Resolved per call so tests can stub `import.meta.env`.
 */
export function apiBase(): string {
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api'
  );
}

import type { ApiErrorCode } from '@nodea/shared';

export interface ApiError {
  status: number;
  /** Machine code from the canonical list in
   *  [`@nodea/shared`](../../../shared/src/error-codes.ts).
   *  Permissive alias `KnownApiErrorCode | (string & {})` —
   *  autocomplete works on known codes, unknowns still type-check
   *  with the « unknown » i18n fallback. */
  error: ApiErrorCode;
  /** Optional human-readable reason — typically reserved for
   *  invariants we can't usefully translate (Zod path, etc.). */
  reason?: string;
}

/**
 * Structural shape of a Zod schema's `.parse()` method. We don't
 * import `ZodType` directly here because we want callers from any
 * Zod-compatible schema lib (and to keep the `internal.ts` import
 * graph minimal). Any `{ parse(data: unknown): T }` works.
 */
export interface ResponseParser<T> {
  parse(data: unknown): T;
}

/**
 * Validate a payload against a response schema in dev/test only.
 * In prod we trust the server contract — running Zod on every
 * response would add ms per call for no payoff (the server is the
 * only writer, and api/web ship together so a real contract drift
 * is caught by tsc + integration tests before deploy).
 *
 * In dev (`import.meta.env.DEV` true) and in tests (`MODE === 'test'`),
 * we run the schema and let `ZodError` bubble — that surfaces drift
 * loudly during development. Per CLAUDE.md « Fail loud on developer
 * errors » : an unvalidated response that parses through a stale
 * schema is a developer error, never a user one.
 */
function shouldValidateResponses(): boolean {
  const env = import.meta.env as { DEV?: boolean; MODE?: string };
  return env.DEV === true || env.MODE === 'test';
}

export async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  path: string,
  body?: unknown,
  responseSchema?: ResponseParser<T>,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(`${apiBase()}${path}`, init);
  const text = await res.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      error:
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : res.statusText,
    };
    if (isRecord(payload) && typeof payload.reason === 'string') {
      err.reason = payload.reason;
    }
    throw err;
  }
  if (responseSchema && shouldValidateResponses()) {
    // `.parse()` throws ZodError on mismatch — let it propagate so
    // the dev sees the exact path that drifted. The caller keeps
    // its `<T>` type guarantee in both modes (cast in prod, validated
    // in dev).
    return responseSchema.parse(payload);
  }
  return payload as T;
}

export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.status === 'number' && typeof value.error === 'string';
}
