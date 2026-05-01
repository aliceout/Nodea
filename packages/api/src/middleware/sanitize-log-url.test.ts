import { describe, expect, it, vi } from 'vitest';
import {
  redactQueryParams,
  redactingPrintFunc,
} from './sanitize-log-url.ts';

describe('redactQueryParams', () => {
  it('redacts the `d=` (guard) query param', () => {
    expect(
      redactQueryParams('PATCH /mood/records/abc?d=g_a3b4c5d6e7'),
    ).toBe('PATCH /mood/records/abc?d=__redacted__');
  });

  it('redacts the `sid=` param (post-SEC-01 belt-and-suspenders)', () => {
    expect(redactQueryParams('GET /mood/records?sid=m_xxxx')).toBe(
      'GET /mood/records?sid=__redacted__',
    );
  });

  it('redacts when `d=` is the first query param', () => {
    expect(redactQueryParams('GET /x?d=g_secret&page=2')).toBe(
      'GET /x?d=__redacted__&page=2',
    );
  });

  it('redacts the `token=` param (magic links / reset tokens)', () => {
    expect(redactQueryParams('GET /auth/activate?token=abc123def')).toBe(
      'GET /auth/activate?token=__redacted__',
    );
  });

  it('redacts the `code=` param (TOTP / activation codes)', () => {
    expect(redactQueryParams('GET /auth/totp/verify?code=123456')).toBe(
      'GET /auth/totp/verify?code=__redacted__',
    );
  });

  it('redacts the `recovery_code=` param', () => {
    expect(redactQueryParams('POST /auth/recover?recovery_code=word-word-word')).toBe(
      'POST /auth/recover?recovery_code=__redacted__',
    );
  });

  it('redacts PII params (email, username) defensively', () => {
    expect(redactQueryParams('GET /lookup?email=alice%40example.com')).toBe(
      'GET /lookup?email=__redacted__',
    );
    expect(redactQueryParams('GET /lookup?username=alice')).toBe(
      'GET /lookup?username=__redacted__',
    );
  });

  it('redacts every sensitive param when several are present', () => {
    expect(
      redactQueryParams('GET /x?d=g_xxx&token=tok_yyy&sid=m_z&page=1'),
    ).toBe('GET /x?d=__redacted__&token=__redacted__&sid=__redacted__&page=1');
  });

  it('leaves non-secret params untouched', () => {
    const input = 'GET /mood?page=2&order=desc&filter=open';
    expect(redactQueryParams(input)).toBe(input);
  });

  it('leaves URLs without query strings untouched', () => {
    expect(redactQueryParams('GET /mood/records/abc')).toBe(
      'GET /mood/records/abc',
    );
  });

  it('does not match a longer param name that happens to start with `d`', () => {
    // `delta=…` starts with `d` but isn't the redacted `d` param.
    // The regex requires `&` or `?` immediately before the literal
    // `d=` so longer names slip through unchanged.
    const input = 'GET /x?delta=42';
    expect(redactQueryParams(input)).toBe(input);
  });

  it('redacts only up to the next `&` or end of string', () => {
    expect(redactQueryParams('GET /x?d=g_value&next=2')).toBe(
      'GET /x?d=__redacted__&next=2',
    );
  });
});

describe('redactingPrintFunc', () => {
  it('forwards a sanitised message to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      redactingPrintFunc('PATCH /x?d=g_secret 200 5ms');
      expect(spy).toHaveBeenCalledWith('PATCH /x?d=__redacted__ 200 5ms');
    } finally {
      spy.mockRestore();
    }
  });

  it('sanitises additional string arguments too', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      redactingPrintFunc('msg', 'GET /x?token=abc', 'GET /y?d=g_xyz');
      expect(spy).toHaveBeenCalledWith(
        'msg',
        'GET /x?token=__redacted__',
        'GET /y?d=__redacted__',
      );
    } finally {
      spy.mockRestore();
    }
  });
});
