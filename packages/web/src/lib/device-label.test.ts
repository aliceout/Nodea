import { describe, expect, it } from 'vitest';

import { parseDeviceLabel } from './device-label';

describe('parseDeviceLabel', () => {
  it('returns the unknown fallback for empty input', () => {
    expect(parseDeviceLabel('').kind).toBe('unknown');
    expect(parseDeviceLabel('').label).toBe('Appareil inconnu');
  });

  it('detects iPhone', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseDeviceLabel(ua)).toEqual({ kind: 'iphone', label: 'iPhone' });
  });

  it('detects iPad', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseDeviceLabel(ua)).toEqual({ kind: 'ipad', label: 'iPad' });
  });

  it('detects iPad over Mac when both markers are present (iPadOS 13+)', () => {
    // iPadOS 13+ Safari sends a Mac-like UA but keeps `iPad` in it.
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0';
    expect(parseDeviceLabel(ua).kind).toBe('ipad');
  });

  it('detects Android phone', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(parseDeviceLabel(ua)).toEqual({
      kind: 'android-phone',
      label: 'Téléphone Android',
    });
  });

  it('detects Android tablet (no Mobile marker)', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-X510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toEqual({
      kind: 'android-tablet',
      label: 'Tablette Android',
    });
  });

  it('detects Mac', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(parseDeviceLabel(ua)).toEqual({ kind: 'macbook', label: 'Mac' });
  });

  it('detects Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toEqual({
      kind: 'windows',
      label: 'Windows',
    });
  });

  it('detects ChromeOS', () => {
    const ua =
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toEqual({
      kind: 'chromeos',
      label: 'Chromebook',
    });
  });

  it('detects Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceLabel(ua)).toEqual({ kind: 'linux', label: 'Linux' });
  });

  it('does not misclassify Android as Linux', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    // Even though the UA has `Linux`, the Android branch must
    // catch it first — otherwise an Android phone would label as
    // « Linux ».
    expect(parseDeviceLabel(ua).kind).not.toBe('linux');
  });

  it('falls back to unknown for unrecognised UAs', () => {
    expect(parseDeviceLabel('curl/8.0').kind).toBe('unknown');
    expect(parseDeviceLabel('SomeBot/1.0').kind).toBe('unknown');
  });
});
