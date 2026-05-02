/**
 * Tiny in-memory LRU-ish cache for lookup responses.
 *
 * Keyed on the normalised query (ISBN or `q::lang`), values are the
 * full lookup response (results + queried providers). Entries expire
 * after `ttlMs` and the map is capped at `max` entries to keep
 * memory predictable on a long-running self-hosted server.
 *
 * Not a real LRU — eviction order is insertion order (`Map`'s natural
 * iteration). Good enough for a workload where cache misses are
 * rare and the hot set is small (a personal library, maybe a few
 * hundred unique queries per user over months).
 */

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class LookupCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Re-insert to bump the entry to "most recently used" in
    // insertion order — `Map` iterates in insertion order, so the
    // first key is the one that gets evicted when we hit `max`.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }
}
