import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { copyWithExpiry } from './clipboard';

/**
 * Locks the auto-clear behaviour of the sensitive-clipboard helper
 * (issue #137). The subtle parts : clear only when the clipboard still
 * holds our value, and still clear when `readText` is unavailable.
 */

function mockClipboard(readImpl: () => Promise<string>) {
  const writeText = vi.fn(async () => undefined);
  const readText = vi.fn(readImpl);
  // jsdom-free node env : install a minimal navigator.clipboard.
  vi.stubGlobal('navigator', { clipboard: { writeText, readText } });
  return { writeText, readText };
}

describe('copyWithExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('writes the value immediately', async () => {
    const { writeText } = mockClipboard(async () => 'secret');
    await copyWithExpiry('secret', 30_000);
    expect(writeText).toHaveBeenCalledWith('secret');
  });

  it('clears the clipboard after the TTL when it still holds our value', async () => {
    const { writeText } = mockClipboard(async () => 'secret');
    await copyWithExpiry('secret', 30_000);
    writeText.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(writeText).toHaveBeenCalledWith(''); // cleared
  });

  it('does NOT clear when the user copied something else since', async () => {
    const { writeText } = mockClipboard(async () => 'something-else');
    await copyWithExpiry('secret', 30_000);
    writeText.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(writeText).not.toHaveBeenCalled();
  });

  it('clears unconditionally when readText is unavailable (e.g. Firefox)', async () => {
    const { writeText } = mockClipboard(async () => {
      throw new Error('readText not allowed');
    });
    await copyWithExpiry('secret', 30_000);
    writeText.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(writeText).toHaveBeenCalledWith(''); // security-first fallback
  });

  it('does not clear before the TTL elapses', async () => {
    const { writeText } = mockClipboard(async () => 'secret');
    await copyWithExpiry('secret', 30_000);
    writeText.mockClear();

    await vi.advanceTimersByTimeAsync(29_000);

    expect(writeText).not.toHaveBeenCalled();
  });
});
