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

export interface ApiError {
  status: number;
  error: string;
  reason?: string;
}

export async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  path: string,
  body?: unknown,
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
