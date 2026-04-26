import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { getConfig } from '../config.ts';
import { fetchRendered } from './headless.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';

/**
 * Amazon adapter — runs through a headless Chromium (`./headless.ts`).
 *
 * Background: Amazon's edge serves an AWS WAF JavaScript challenge
 * on `/s?k=` (the search surface) for any request that doesn't
 * execute JS, regardless of headers / cookies / TLS fingerprint.
 * The challenge ships an encrypted puzzle (`window.gokuProps`)
 * that's solved by the browser's V8 engine to obtain an
 * `aws-waf-token` cookie. Direct fetch can't pass it. So we use
 * Puppeteer to navigate as a real browser would: the challenge
 * page loads, its JS runs, the cookie gets set, the actual
 * results page renders, we read the DOM.
 *
 * Cost paid for that bypass: ~200 MB Chromium binary on disk,
 * ~120 MB RAM idle, +2-5 s per lookup vs the direct providers.
 * Toggleable via `LIBRARY_AMAZON_ENABLED=false` in `.env` if the
 * operator decides the trade isn't worth it.
 *
 * Why not Puppeteer for ALL providers: overkill. OL / GB / BNF /
 * Wikidata / BNE return clean JSON / SPARQL results to direct
 * fetch — no JS challenge, no need for a full browser. Only
 * Amazon needs the heavy machinery, and we keep the rest fast.
 */
export const amazonAdapter: ProviderAdapter = {
  name: 'amazon',
  label: 'Amazon',
  needsKey: false,
  // Disabled when the operator turns it off. The browser is then
  // never launched — saves the ~120 MB RAM and Chromium startup.
  get enabled() {
    return getConfig().LIBRARY_AMAZON_ENABLED;
  },
  // Scraped HTML — if the universal probe ISBN finds 0 books, the
  // parser is almost certainly broken (selectors stale, layout
  // changed, or bot detection). Surface as a hard failure in the
  // admin "Sources" tab instead of letting it pass for green.
  strictProbe: true,

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped } = normaliseIsbn(isbn);
    return search(stripped, pickTld('fr'), 1);
  },

  async byQuery(query, lang): Promise<NormalisedBook[]> {
    return search(query, pickTld(lang), 5);
  },
};

function pickTld(lang?: string): 'fr' | 'es' | 'com' {
  if (lang?.startsWith('fr')) return 'fr';
  if (lang?.startsWith('es')) return 'es';
  return 'com';
}

async function search(query: string, tld: string, limit: number): Promise<NormalisedBook[]> {
  // `i=stripbooks` restricts the search to printed books;
  // `&ref=nb_sb_noss` mimics the "submit search" navigation path.
  const url = `https://www.amazon.${tld}/s?k=${encodeURIComponent(query)}&i=stripbooks&ref=nb_sb_noss`;

  const { html, finalUrl } = await fetchRendered(url, {
    referer: `https://www.amazon.${tld}/`,
    acceptLanguage:
      tld === 'fr'
        ? 'fr-FR,fr;q=0.9,en;q=0.8'
        : tld === 'es'
          ? 'es-ES,es;q=0.9,en;q=0.8'
          : 'en-US,en;q=0.9',
    timeoutMs: 20000,
  });

  // Amazon sometimes redirects unauthenticated/foreign-locale
  // visitors to a regional landing or a captcha interstitial.
  // The headless browser passes the JS challenge automatically,
  // but a redirect to an unrelated path means our parser will
  // see no search-result tiles — surface that distinctly.
  if (!finalUrl.includes('/s?')) {
    throw new Error(
      `amazon — la navigation a quitté la page de recherche (final URL: ${finalUrl})`,
    );
  }

  // Belt-and-braces: the static bot-detection markers from the
  // pre-Puppeteer version. With the headless browser these almost
  // never trigger (Chromium passes the challenge), but they catch
  // edge cases where the WAF serves an unsolvable variant.
  if (
    /api-services-support@amazon\.com/i.test(html) ||
    /Type the characters you see in this image/i.test(html) ||
    /\bRobot Check\b/i.test(html)
  ) {
    throw new Error('amazon — captcha non-JS (variation WAF rare, réessaie plus tard)');
  }

  const results = parseSearchHtml(html, limit);
  if (results.length === 0 && process.env.NODE_ENV !== 'production') {
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
    console.warn(
      `[library-lookup] amazon parser yielded 0 hits for "${query}" on amazon.${tld}.\n` +
        `  page <title>: ${titleMatch?.[1] ?? '(none)'}\n` +
        `  final URL: ${finalUrl}`,
    );
  }
  return results;
}

/* ---- HTML parsing (unchanged from the direct-fetch version) -- */

function parseSearchHtml(html: string, limit: number): NormalisedBook[] {
  const out: NormalisedBook[] = [];
  const tileRegex =
    /<div[^>]*\bdata-component-type="s-search-result"[^>]*>([\s\S]*?)(?=<div[^>]*\bdata-component-type="s-search-result"|<\/div>\s*<\/div>\s*<\/span>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div[^>]*\bclass="[^"]*s-pagination|$)/g;
  let match: RegExpExecArray | null;
  while ((match = tileRegex.exec(html)) !== null && out.length < limit) {
    const tile = match[0];
    const block = match[1];
    if (!tile || !block) continue;
    const asinMatch = /\bdata-asin="([^"]+)"/.exec(tile);
    const asin = asinMatch?.[1];
    if (!asin) continue;

    const title = extractTitle(block);
    if (!title) continue;
    const author = extractAuthor(block);
    const cover = extractCover(block);
    const year = extractYear(extractYearString(block));
    const looksLikeIsbn10 = /^\d{9}[\dX]$/i.test(asin);

    out.push({
      title,
      creators: author
        ? [{ name: normaliseAuthorName(author), role: 'author' }]
        : [],
      year,
      language: null,
      original_language: null,
      page_count: null,
      publisher: null,
      collection: null,
      summary: null,
      isbn13: null,
      isbn10: looksLikeIsbn10 ? asin.toUpperCase() : null,
      format: null,
      series: null,
      cover_url: cover,
      providers: { amazon: asin },
      source: 'amazon',
    });
  }
  return out;
}

function extractTitle(block: string): string | null {
  const m = /<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/.exec(block);
  if (!m || !m[1]) return null;
  const stripped = m[1].replace(/<[^>]+>/g, '').trim();
  return decodeHtml(stripped) || null;
}

function extractAuthor(block: string): string | null {
  const m =
    /<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/a>/.exec(
      block,
    );
  if (!m || !m[1]) return null;
  const candidate = decodeHtml(m[1].trim());
  if (!candidate || candidate.length > 80) return null;
  return candidate;
}

function extractCover(block: string): string | null {
  const m = /<img[^>]*\bsrc="(https:\/\/[^"]*?\/I\/[^"]+\.(?:jpg|jpeg|png|webp))"/i.exec(block);
  return m?.[1] ?? null;
}

function extractYearString(block: string): string | null {
  const m = /\b(\d{4})\b/.exec(block);
  return m?.[0] ?? null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
