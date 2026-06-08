import { describe, it, expect } from 'vitest';
import { getDataPlugin, knownModules, hasModule } from './registry.data.ts';

/** Every collection that holds user-authored data must be exportable, or a
 *  "backup" silently drops it on restore. This list is the contract. */
const REQUIRED_KEYS = [
  'mood',
  'goals',
  'journal',
  'habits_items',
  'habits_logs',
  'library_items',
  'library_reviews',
  'review',
  'hrt_products',
  'hrt_admin_logs',
  'hrt_lab_results',
  'hrt_schedules',
] as const;

describe('import/export registry — completeness', () => {
  it('covers every user-data collection (journal + HRT included)', () => {
    const known = new Set(knownModules());
    for (const key of REQUIRED_KEYS) {
      expect(known.has(key), `missing module: ${key}`).toBe(true);
      expect(hasModule(key)).toBe(true);
    }
  });

  it.each(REQUIRED_KEYS)('resolves %s with a coherent meta', async (key) => {
    const plugin = await getDataPlugin(key);
    expect(plugin.meta.id).toBe(key);
    // runtimeKey (modules-slice key) is set wherever it differs from id.
    expect(typeof (plugin.meta.runtimeKey ?? plugin.meta.id)).toBe('string');
    expect(typeof plugin.getNaturalKey).toBe('function');
  });
});

describe('natural keys — dedup behaviour', () => {
  it('journal: same entry collapses, different content does not', async () => {
    const p = await getDataPlugin('journal');
    const a = { date: '2026-01-02', thread: 'perso', content: 'hello world' };
    expect(p.getNaturalKey(a)).toBe(p.getNaturalKey({ ...a }));
    expect(p.getNaturalKey(a)).not.toBe(
      p.getNaturalKey({ ...a, content: 'something else' }),
    );
  });

  it('journal: two same-day entries differing only in title stay distinct', async () => {
    const p = await getDataPlugin('journal');
    const base = { date: '2026-01-02', thread: '', content: 'same body text' };
    expect(p.getNaturalKey({ ...base, title: 'Morning' })).not.toBe(
      p.getNaturalKey({ ...base, title: 'Evening' }),
    );
  });

  it('journal: entries sharing a long opening but diverging later stay distinct', async () => {
    const p = await getDataPlugin('journal');
    const preamble = 'A'.repeat(200);
    const base = { date: '2026-01-02', thread: '', title: null };
    // The old 120-char-prefix key collapsed these and dropped one on restore.
    expect(p.getNaturalKey({ ...base, content: preamble + ' first ending' })).not.toBe(
      p.getNaturalKey({ ...base, content: preamble + ' second ending' }),
    );
  });

  it('library_reviews: quotes on the same book/day but different pages stay distinct', async () => {
    const p = await getDataPlugin('library_reviews');
    const base = {
      date: '2026-01-02',
      itemRid: 'book-1',
      kind: 'quote',
      content: 'Une citation marquante du début',
    };
    expect(p.getNaturalKey({ ...base, page: 12 })).not.toBe(
      p.getNaturalKey({ ...base, page: 88 }),
    );
    // Identical review still collapses (idempotent re-import).
    expect(p.getNaturalKey({ ...base, page: 12 })).toBe(
      p.getNaturalKey({ ...base, page: 12 }),
    );
  });

  it('library_reviews: two notes sharing a 40-char opening stay distinct', async () => {
    const p = await getDataPlugin('library_reviews');
    const opening = 'Passage marquant du chapitre central ';
    const base = { date: '2026-01-02', itemRid: 'book-1', kind: 'note', page: null };
    expect(p.getNaturalKey({ ...base, content: opening + 'première idée' })).not.toBe(
      p.getNaturalKey({ ...base, content: opening + 'seconde idée' }),
    );
  });

  it('hrt_products: keyed by name, ignores other fields', async () => {
    const p = await getDataPlugin('hrt_products');
    expect(p.getNaturalKey({ name: 'Estradiol gel' })).toBe(
      p.getNaturalKey({ name: 'Estradiol gel', notes: 'pharmacie X' }),
    );
  });

  it('hrt_admin_logs: same dose collapses, different time does not', async () => {
    const p = await getDataPlugin('hrt_admin_logs');
    const dose = { date: '2026-01-02', time: '08:00', product: 'Estradiol gel', dose: 2 };
    expect(p.getNaturalKey(dose)).toBe(p.getNaturalKey({ ...dose }));
    expect(p.getNaturalKey(dose)).not.toBe(p.getNaturalKey({ ...dose, time: '20:00' }));
  });

  it('hrt_lab_results: peak and trough on the same day stay distinct', async () => {
    const p = await getDataPlugin('hrt_lab_results');
    const peak = {
      date: '2026-01-02',
      marker: 'estradiol',
      value: 250,
      unit: 'pg/mL',
      context: 'peak',
    };
    expect(p.getNaturalKey(peak)).not.toBe(
      p.getNaturalKey({ ...peak, context: 'trough' }),
    );
  });
});
