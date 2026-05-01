import { describe, expect, it } from 'vitest';

import { errorMessageOf, isReady, type LoadState } from './load-state';

describe('LoadState helpers', () => {
  it('isReady narrows to the ready variant', () => {
    const idle: LoadState = { status: 'idle' };
    const loading: LoadState = { status: 'loading' };
    const ready: LoadState = { status: 'ready' };
    const error: LoadState = { status: 'error', message: 'boom' };

    expect(isReady(idle)).toBe(false);
    expect(isReady(loading)).toBe(false);
    expect(isReady(ready)).toBe(true);
    expect(isReady(error)).toBe(false);
  });

  it('errorMessageOf returns the message only for the error variant', () => {
    expect(errorMessageOf({ status: 'idle' })).toBeNull();
    expect(errorMessageOf({ status: 'loading' })).toBeNull();
    expect(errorMessageOf({ status: 'ready' })).toBeNull();
    expect(errorMessageOf({ status: 'error', message: 'kaboom' })).toBe(
      'kaboom',
    );
  });
});
