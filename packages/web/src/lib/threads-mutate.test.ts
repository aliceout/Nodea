/**
 * Unit tests for the pure thread mutation helpers (issue #57).
 * Cover the cases the action callbacks rely on : no-op when the
 * target isn't present, dedup after rename, multi-source merge,
 * delete leaving an empty string when the target was alone.
 */
import { describe, expect, it } from 'vitest';
import {
  mergeThreadsInString,
  removeThreadFromString,
  renameThreadInString,
} from './threads-mutate';

describe('renameThreadInString', () => {
  it('renames a single thread to a new name', () => {
    expect(renameThreadInString('#perso, #work', '#perso', '#personnel')).toBe(
      '#personnel, #work',
    );
  });

  it('returns the input unchanged when the source thread is absent', () => {
    const input = '#perso, #work';
    expect(renameThreadInString(input, '#missing', '#anything')).toBe(input);
  });

  it('dedups when renaming into an existing name (de facto merge)', () => {
    expect(renameThreadInString('#voyages, #voyage', '#voyages', '#voyage')).toBe(
      '#voyage',
    );
  });

  it('handles whitespace and stray commas in the input gracefully', () => {
    expect(renameThreadInString(' #a , , #b ', '#a', '#alpha')).toBe(
      '#alpha, #b',
    );
  });

  it('handles an empty thread string', () => {
    expect(renameThreadInString('', '#a', '#b')).toBe('');
  });
});

describe('mergeThreadsInString', () => {
  it('merges multiple sources into a single target name', () => {
    expect(
      mergeThreadsInString(
        '#voyages, #voyage, #trip, #work',
        ['#voyages', '#trip'],
        '#voyage',
      ),
    ).toBe('#voyage, #work');
  });

  it('returns the input unchanged when none of the sources appear', () => {
    const input = '#perso, #work';
    expect(mergeThreadsInString(input, ['#missing'], '#target')).toBe(input);
  });

  it('allows the target to be one of the sources (self-merge collapses dupes)', () => {
    expect(
      mergeThreadsInString('#a, #b, #a', ['#a', '#b'], '#a'),
    ).toBe('#a');
  });

  it('handles an empty source list (idempotent no-op)', () => {
    const input = '#a, #b';
    expect(mergeThreadsInString(input, [], '#target')).toBe(input);
  });
});

describe('removeThreadFromString', () => {
  it('drops the target from a multi-thread string', () => {
    expect(removeThreadFromString('#perso, #work, #therapy', '#work')).toBe(
      '#perso, #therapy',
    );
  });

  it('returns an empty string when the target was the only thread', () => {
    expect(removeThreadFromString('#alone', '#alone')).toBe('');
  });

  it('returns the input unchanged when the target is absent', () => {
    const input = '#perso, #work';
    expect(removeThreadFromString(input, '#missing')).toBe(input);
  });

  it('handles an already-empty thread', () => {
    expect(removeThreadFromString('', '#anything')).toBe('');
  });
});
