import { describe, expect, it } from 'vitest';

import { scrubSentryEvent, type SentryEventLike } from './sentry-scrub';

/**
 * Pre-Sentry-install scrubber tests on the web side. Mirror of the
 * API-side suite — same contract, same outputs. The wholesale-prefix
 * list must stay in sync between the two scrubbers.
 */

function buildEvent(overrides: Partial<SentryEventLike> = {}): SentryEventLike {
  return {
    request: {
      url: 'https://nodea.app/auth/login?token=secret',
      query_string: 'token=secret',
      cookies: { __Host_nodea_session: 'abc.def' },
      headers: {
        'content-type': 'application/json',
        cookie: '__Host_nodea_session=abc.def',
        'x-sid': 'm_sid',
        'x-guard': 'g_guard',
      },
      data: { password: 'hunter2' },
    },
    user: {
      id: 'usr_xyz',
      email: 'alice@example.com',
      username: 'alice',
      ip_address: '1.2.3.4',
    },
    breadcrumbs: [
      {
        category: 'fetch',
        data: { url: '/auth/me?token=foo', method: 'GET' },
        message: 'fetch /auth/me',
      },
      {
        category: 'navigation',
        data: { from: '/x?token=A', to: '/y' },
        message: 'navigation',
      },
    ],
    extra: { someBag: 'should-be-dropped' },
    contexts: { browser: { name: 'Firefox' } },
    ...overrides,
  };
}

describe('scrubSentryEvent (web)', () => {
  it('scrubs the request URL query string', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.url).toBe('https://nodea.app/auth/login?[redacted]');
  });

  it('wipes query_string, cookies, data wholesale', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.query_string).toBe('[redacted]');
    expect(out.request?.cookies).toBe('[redacted]');
    expect(out.request?.data).toBe('[redacted]');
  });

  it('keeps only the content-type header', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.headers).toEqual({
      'content-type': 'application/json',
    });
  });

  it('keeps user.id only, drops PII', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.user).toEqual({ id: 'usr_xyz' });
  });

  it('scrubs URLs on breadcrumbs and strips http data bag', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.breadcrumbs?.[0]?.data).toEqual({
      url: '/auth/me?[redacted]',
    });
  });

  it('drops the free-form `extra` and `contexts` bags', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.extra).toBeUndefined();
    expect(out.contexts).toBeUndefined();
  });

  it('is a no-op on minimal events', () => {
    expect(scrubSentryEvent({})).toEqual({});
  });
});
