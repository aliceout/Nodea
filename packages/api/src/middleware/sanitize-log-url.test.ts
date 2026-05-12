import { describe, expect, it, vi } from 'vitest';
import {
  redactQueryParams,
  redactingPrintFunc,
} from './sanitize-log-url.ts';

/**
 * Pure-function tests for the query-string scrubber. Integration-
 * grade coverage (does the scrubber survive a real Hono request
 * round-trip?) lives in `test/log-opacity.test.ts`.
 *
 * Two distinct behaviours to assert (issue #71) :
 *   1. **Wholesale prefix redaction** on `/auth/*` and module
 *      routes (`/mood/*`, `/goals/*`, `/journal/*`, `/habits/*`,
 *      `/library/*`, `/review/*`) — the whole query string gets
 *      replaced regardless of param names.
 *   2. **Per-name denylist** outside those prefixes — only the
 *      named sensitive params get scrubbed, others pass through.
 */

describe('redactQueryParams — wholesale prefix redaction', () => {
  it('nukes the whole query string on /auth/ routes', () => {
    expect(
      redactQueryParams('POST /auth/mfa/bypass/confirm?t=secret-token-here 200'),
    ).toBe('POST /auth/mfa/bypass/confirm?__redacted__ 200');
  });

  it('nukes the `d=` (guard) on a /mood/ route', () => {
    expect(
      redactQueryParams('PATCH /mood/records/abc?d=g_a3b4c5d6e7'),
    ).toBe('PATCH /mood/records/abc?__redacted__');
  });

  it('nukes multi-param query strings on module routes', () => {
    expect(
      redactQueryParams('GET /mood/records?sid=m_xxxx&page=1'),
    ).toBe('GET /mood/records?__redacted__');
  });

  it('nukes magic-link tokens on /auth/activate', () => {
    expect(
      redactQueryParams('GET /auth/activate?token=abc123def'),
    ).toBe('GET /auth/activate?__redacted__');
  });

  it('nukes TOTP / activation codes on /auth/totp/verify', () => {
    expect(
      redactQueryParams('GET /auth/totp/verify?code=123456'),
    ).toBe('GET /auth/totp/verify?__redacted__');
  });

  it('nukes recovery codes on /auth/recover', () => {
    expect(
      redactQueryParams('POST /auth/recover?recovery_code=word-word-word'),
    ).toBe('POST /auth/recover?__redacted__');
  });

  it('preserves hash fragments after wholesale redaction', () => {
    expect(
      redactQueryParams('GET /journal/records?foo=bar#anchor 200'),
    ).toBe('GET /journal/records?__redacted__#anchor 200');
  });

  it('covers every declared wholesale prefix', () => {
    const prefixes = [
      '/auth/foo',
      '/mood/x',
      '/goals/y',
      '/journal/z',
      '/habits/a',
      '/library/b',
      '/review/c',
    ];
    for (const prefix of prefixes) {
      expect(redactQueryParams(`GET ${prefix}?secret=x 200`)).toBe(
        `GET ${prefix}?__redacted__ 200`,
      );
    }
  });

  it('does not match paths whose first segment merely starts like a prefix', () => {
    // `/library-lookup` shares a prefix substring with `/library/`
    // but lives at a different path. Our prefix list ends each
    // entry with a slash precisely to avoid this false match.
    expect(redactQueryParams('GET /library-lookup?q=hugo 200')).toBe(
      'GET /library-lookup?q=hugo 200',
    );
  });
});

describe('redactQueryParams — per-name denylist (non-wholesale routes)', () => {
  it('redacts known sensitive params on a non-wholesale path', () => {
    expect(redactQueryParams('GET /admin/health?token=abc123 200')).toBe(
      'GET /admin/health?token=__redacted__ 200',
    );
  });

  it('redacts the short `t=` MFA-bypass token even outside wholesale paths', () => {
    expect(redactQueryParams('GET /admin/health?t=mfa-bypass-token 200')).toBe(
      'GET /admin/health?t=__redacted__ 200',
    );
  });

  it('redacts PII params (email, username) defensively', () => {
    expect(redactQueryParams('GET /admin/lookup?email=alice%40example.com')).toBe(
      'GET /admin/lookup?email=__redacted__',
    );
    expect(redactQueryParams('GET /admin/lookup?username=alice')).toBe(
      'GET /admin/lookup?username=__redacted__',
    );
  });

  it('leaves non-secret params untouched', () => {
    const input = 'GET /admin/health?page=2&order=desc&filter=open';
    expect(redactQueryParams(input)).toBe(input);
  });

  it('does not match a longer param name that happens to start with `d`', () => {
    // `delta=…` starts with `d` but isn't the redacted `d` param.
    const input = 'GET /admin/x?delta=42';
    expect(redactQueryParams(input)).toBe(input);
  });

  it('redacts only up to the next `&` or end of string', () => {
    expect(redactQueryParams('GET /admin/x?d=g_value&next=2')).toBe(
      'GET /admin/x?d=__redacted__&next=2',
    );
  });
});

describe('redactQueryParams — URL shape variants', () => {
  it('works on absolute URLs (wholesale)', () => {
    expect(redactQueryParams('POST https://nodea.app/auth/login?t=blah 200')).toBe(
      'POST https://nodea.app/auth/login?__redacted__ 200',
    );
  });

  it('works on absolute URLs (per-name)', () => {
    expect(
      redactQueryParams('POST https://nodea.app/admin/x?token=blah 200'),
    ).toBe('POST https://nodea.app/admin/x?token=__redacted__ 200');
  });

  it('passes through inputs without a query string', () => {
    expect(redactQueryParams('GET /auth/me 200')).toBe('GET /auth/me 200');
  });

  it('handles mixed URLs (wholesale + per-name) in the same log line', () => {
    expect(
      redactQueryParams(
        'GET /auth/me?token=A → 302 https://nodea.app/admin/x?token=B',
      ),
    ).toBe(
      'GET /auth/me?__redacted__ → 302 https://nodea.app/admin/x?token=__redacted__',
    );
  });

  it('leaves the empty string alone', () => {
    expect(redactQueryParams('')).toBe('');
  });
});

describe('redactingPrintFunc', () => {
  it('forwards a sanitised wholesale-redacted message to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      redactingPrintFunc('PATCH /mood/records?d=g_secret 200 5ms');
      expect(spy).toHaveBeenCalledWith(
        'PATCH /mood/records?__redacted__ 200 5ms',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('sanitises additional string arguments too', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      redactingPrintFunc('msg', 'GET /auth/x?token=abc', 'GET /admin/y?token=z');
      expect(spy).toHaveBeenCalledWith(
        'msg',
        'GET /auth/x?__redacted__',
        'GET /admin/y?token=__redacted__',
      );
    } finally {
      spy.mockRestore();
    }
  });
});
