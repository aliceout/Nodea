import { describe, expect, it } from 'vitest';

import { scrubSentryEvent, type SentryEventLike } from './sentry-scrub.ts';

/**
 * Pre-Sentry-install scrubber tests. Asserts the contract for the
 * day the operator wires Sentry (issue #83) : a complete, ugly
 * event hitting `beforeSend` must come out with no privacy leaks.
 */

function buildEvent(overrides: Partial<SentryEventLike> = {}): SentryEventLike {
  return {
    request: {
      method: 'POST',
      url: 'https://nodea.app/auth/login?token=secret-magic-link',
      query_string: 'token=secret-magic-link',
      cookies: { __Host_nodea_session: 'abc.def' },
      headers: {
        'content-type': 'application/json',
        cookie: '__Host_nodea_session=abc.def',
        'x-sid': 'm_some_sid',
        'x-guard': 'g_some_guard',
        authorization: 'Bearer xyz',
      },
      data: { password: 'hunter2', otp: '123456' },
    },
    user: {
      id: 'usr_abc',
      email: 'alice@example.com',
      username: 'alice',
      ip_address: '1.2.3.4',
    },
    breadcrumbs: [
      {
        category: 'fetch',
        data: {
          url: '/auth/me?token=foo',
          method: 'GET',
          response_body: 'sensitive',
        },
        message: 'fetch /auth/me',
      },
      {
        category: 'navigation',
        data: { from: '/x?token=A', to: '/admin/y?email=alice@example.com' },
        message: 'navigation',
      },
    ],
    ...overrides,
  };
}

describe('scrubSentryEvent', () => {
  it('scrubs the request URL query string via the shared redactor', () => {
    const out = scrubSentryEvent(buildEvent());
    // /auth/ is a wholesale prefix — entire query gets replaced.
    expect(out.request?.url).toBe(
      'https://nodea.app/auth/login?__redacted__',
    );
  });

  it('wipes the query_string field wholesale', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.query_string).toBe('[redacted]');
  });

  it('wipes the cookies field wholesale', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.cookies).toBe('[redacted]');
  });

  it('keeps only the content-type header, drops everything else', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.headers).toEqual({
      'content-type': 'application/json',
    });
  });

  it('wipes the request body wholesale', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.request?.data).toBe('[redacted]');
  });

  it('keeps user.id, drops email / username / ip_address', () => {
    const out = scrubSentryEvent(buildEvent());
    expect(out.user).toEqual({ id: 'usr_abc' });
  });

  it('drops the user object entirely if no id is set', () => {
    const out = scrubSentryEvent(buildEvent({ user: { email: 'a@b.c' } }));
    expect(out.user).toBeUndefined();
  });

  it('scrubs URL query strings on every breadcrumb', () => {
    const out = scrubSentryEvent(buildEvent());
    const crumbs = out.breadcrumbs;
    expect(crumbs).toBeDefined();
    if (!crumbs) return;
    expect(crumbs[0]?.data?.url).toBe('/auth/me?__redacted__');
  });

  it('strips the response body / extra fields on http breadcrumbs', () => {
    const out = scrubSentryEvent(buildEvent());
    const httpCrumb = out.breadcrumbs?.[0];
    // After scrubbing, only the (scrubbed) url should remain on
    // the data bag — `response_body` and `method` are dropped.
    expect(httpCrumb?.data).toEqual({ url: '/auth/me?__redacted__' });
  });

  it('leaves non-http breadcrumbs alone except for url scrubbing', () => {
    const out = scrubSentryEvent(buildEvent());
    const navCrumb = out.breadcrumbs?.[1];
    expect(navCrumb?.data).toMatchObject({
      from: '/x?token=A', // per-name, not wholesale — but 'from' is not a 'url'
      to: '/admin/y?email=alice@example.com',
    });
  });

  it('is a no-op on events with no request/user/breadcrumbs', () => {
    const minimal: SentryEventLike = {};
    expect(scrubSentryEvent(minimal)).toEqual({});
  });
});
