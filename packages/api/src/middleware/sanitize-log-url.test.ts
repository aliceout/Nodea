import { describe, expect, it, vi } from 'vitest';
import {
  redactQueryParams,
  redactingPrintFunc,
} from './sanitize-log-url.ts';

describe('redactQueryParams', () => {
  it('redacts the `d=` (guard) query param', () => {
    expect(
      redactQueryParams('PATCH /mood/records/abc?sid=m_x&d=g_a3b4c5d6e7'),
    ).toBe('PATCH /mood/records/abc?sid=m_x&d=__redacted__');
  });

  it('redacts when `d=` is the first query param', () => {
    expect(redactQueryParams('GET /x?d=g_secret&sid=m_x')).toBe(
      'GET /x?d=__redacted__&sid=m_x',
    );
  });

  it('redacts the `token=` param (magic links / reset tokens)', () => {
    expect(redactQueryParams('GET /auth/activate?token=abc123def')).toBe(
      'GET /auth/activate?token=__redacted__',
    );
  });

  it('redacts both `d=` and `token=` when both are present', () => {
    expect(redactQueryParams('GET /x?d=g_xxx&token=tok_yyy&sid=m_z')).toBe(
      'GET /x?d=__redacted__&token=__redacted__&sid=m_z',
    );
  });

  it('leaves non-secret params untouched', () => {
    const input = 'GET /mood?sid=m_x&page=2&order=desc';
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
