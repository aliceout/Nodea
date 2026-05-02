import type { SourceHealth } from '@nodea/shared';
import type { ProviderAdapter, ProviderName } from './types.ts';

import { PROVIDERS } from './providers.ts';

/**
 * Test ISBNs used by the health probe. Each provider gets one we
 * expect to be in its catalogue:
 *   - OL / GB / BNF / Wikidata: Le Petit Prince (universal, present
 *     in every major catalogue, French original).
 *   - BNE: Don Quixote (canonical Spanish title, BNE patrimony).
 */
const TEST_ISBN_BY_PROVIDER: Record<ProviderName, string> = {
  openlibrary: '9782070408504',
  googlebooks: '9782070408504',
  bnf: '9782070408504',
  wikidata: '9782070408504',
  bne: '9788424915377',
  amazon: '9782070408504',
};

async function probeProvider(adapter: ProviderAdapter): Promise<SourceHealth> {
  const base = {
    name: adapter.name,
    label: adapter.label,
    module: 'library',
    needsKey: adapter.needsKey,
  };
  // Provider is keyed and the key is missing: short-circuit.
  if (!adapter.enabled) {
    return {
      ...base,
      configured: false,
      online: false,
      responseMs: null,
      testFoundResults: false,
      error: adapter.needsKey
        ? 'Clé API absente — voir LIBRARY_GOOGLE_BOOKS_API_KEY dans .env'
        : 'Adapter désactivé',
    };
  }
  const isbn = TEST_ISBN_BY_PROVIDER[adapter.name];
  const start = Date.now();
  try {
    const results = await adapter.byIsbn(isbn);
    // For scraped providers (strictProbe=true), 0 results on the
    // universal test ISBN means the HTML parser is broken or bot
    // detection has kicked in — both demand operator attention,
    // both should land as a hard failure rather than a green tick.
    if (adapter.strictProbe && results.length === 0) {
      return {
        ...base,
        configured: true,
        online: false,
        responseMs: Date.now() - start,
        testFoundResults: false,
        error:
          'Sonde négative sur l’ISBN test — parser HTML cassé ou détection bot. ' +
          'Vérifier la structure des résultats côté provider et mettre à jour les regex.',
      };
    }
    return {
      ...base,
      configured: true,
      online: true,
      responseMs: Date.now() - start,
      testFoundResults: results.length > 0,
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      configured: true,
      online: false,
      responseMs: Date.now() - start,
      testFoundResults: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the health probe across every Library provider in parallel.
 * Each probe runs independently — one timeout doesn't block the
 * others — and is bounded by the per-adapter fetch timeout
 * (`fetchWithTimeout`, currently 6–8 s).
 */
export async function probeLibraryProviders(): Promise<SourceHealth[]> {
  const results = await Promise.allSettled(PROVIDERS.map((p) => probeProvider(p)));
  const out: SourceHealth[] = [];
  for (let i = 0; i < PROVIDERS.length; i += 1) {
    const adapter = PROVIDERS[i]!;
    const result = results[i];
    if (result?.status === 'fulfilled') {
      out.push(result.value);
    } else {
      out.push({
        name: adapter.name,
        label: adapter.label,
        module: 'library',
        needsKey: adapter.needsKey,
        configured: adapter.enabled,
        online: false,
        responseMs: null,
        testFoundResults: false,
        error:
          result?.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'unknown error',
      });
    }
  }
  return out;
}
