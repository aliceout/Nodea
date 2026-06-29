import { request } from './internal';

/**
 * Instance public config — the handful of values the pre-auth pages need
 * (currently just the optional helpdesk/support link). Served by the API's
 * public `GET /config`, which reads it from the runtime env (Infisical), so
 * it's per-instance and needs no rebuild of the static bundle.
 */
export interface PublicConfig {
  /** Helpdesk/support URL, or `null` when the operator didn't set one. */
  helpdeskUrl: string | null;
}

let cache: Promise<PublicConfig> | null = null;

/**
 * Fetch the instance public config, cached for the page lifetime: it's
 * static per deploy and every auth page (login / register / reset…) reads
 * it. Fails soft — a transport error resolves to "no helpdesk link" rather
 * than throwing into a logged-out surface.
 */
export function fetchPublicConfig(): Promise<PublicConfig> {
  if (!cache) {
    cache = request<PublicConfig>('GET', '/config').catch(
      (): PublicConfig => ({ helpdeskUrl: null }),
    );
  }
  return cache;
}
