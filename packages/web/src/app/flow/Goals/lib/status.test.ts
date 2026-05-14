import { describe, it, expect } from 'vitest';

import { nextStatus } from './status';

describe('nextStatus', () => {
  it('cycles open → wip → done → open', () => {
    expect(nextStatus('open')).toBe('wip');
    expect(nextStatus('wip')).toBe('done');
    expect(nextStatus('done')).toBe('open');
  });

  it('round-trips after three cycles', () => {
    expect(nextStatus(nextStatus(nextStatus('open')))).toBe('open');
    expect(nextStatus(nextStatus(nextStatus('wip')))).toBe('wip');
    expect(nextStatus(nextStatus(nextStatus('done')))).toBe('done');
  });
});
