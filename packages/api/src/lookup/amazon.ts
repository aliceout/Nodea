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

  // 30 s for byQuery — free-text searches go through the WAF
  // challenge AND a fully-rendered results page with many lazy-
  // loaded blocks. ISBN searches return a smaller page. The
  // network-idle wait cap is the real driver of latency here.
  const { html, finalUrl, status } = await fetchRendered(url, {
    referer: `https://www.amazon.${tld}/`,
    acceptLanguage:
      tld === 'fr'
        ? 'fr-FR,fr;q=0.9,en;q=0.8'
        : tld === 'es'
          ? 'es-ES,es;q=0.9,en;q=0.8'
          : 'en-US,en;q=0.9',
    timeoutMs: 30000,
  });

  // Amazon sometimes redirects unauthenticated visitors to a
  // regional landing or interstitial. The path can be
  // `/s?...`, `/s/...?...`, `/s/ref=...`, etc. — any URL on the
  // /s path counts as "still on search". A redirect to e.g.
  // `/gp/help/customer/display.html` means we got bounced.
  if (!/\/s(\/|\?)/.test(finalUrl)) {
    throw new Error(
      `amazon — navigation hors page de recherche (final: ${finalUrl})`,
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
    // Count any hint of search-result markup so we can tell apart
    // "page loaded fine, parser regex is wrong" from "page didn't
    // contain search results at all".
    const tilesByDataType = (
      html.match(/data-component-type="s-search-result"/g) ?? []
    ).length;
    const tilesByAsin = (html.match(/\bdata-asin="[^"]+"/g) ?? []).length;
    const snippet = html
      .slice(0, 400)
      .replace(/\s+/g, ' ');
    console.warn(
      `[library-lookup] amazon parser yielded 0 hits for "${query}" on amazon.${tld}.\n` +
        `  status: ${status}\n` +
        `  page <title>: ${titleMatch?.[1] ?? '(none)'}\n` +
        `  final URL: ${finalUrl}\n` +
        `  html length: ${html.length}\n` +
        `  tiles by data-component-type: ${tilesByDataType}\n` +
        `  tiles by data-asin: ${tilesByAsin}\n` +
        `  first 400 chars: ${snippet}`,
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
  // Amazon's tile has multiple `<a class="a-link-normal">` links —
  // the previous "first match wins" approach was picking up the
  // **rating count** ("(9)", "(2K)", "(1.4K)…") because the
  // ratings block uses the same anchor class. We now look for
  // explicit author markers:
  //
  //   - "par <AUTHOR>" (FR locale) or "by <AUTHOR>" (US/UK locale),
  //     either with the marker as a sibling text span or inline.
  //   - As a fallback, "<AUTHOR>(Auteur)" / "<AUTHOR>(Author)".
  //
  // The candidate is then run through a guard that rejects
  // anything starting with "(<digit>" or matching ratings shapes
  // like "(2K)" / "(1,234)".
  const patterns: RegExp[] = [
    // "par"/"by" before an `<a>` link with the author name
    /(?:par|by)\s*(?:<\/span>)?\s*<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    // <a>NAME</a><span>(Auteur|Author)</span>
    /<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>\s*<span[^>]*>\s*\((?:Auteur|Author)\)\s*<\/span>/i,
    // Fallback: first <a> wrapping a <span> name
    /<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/a>/,
  ];
  for (const p of patterns) {
    const m = p.exec(block);
    if (!m || !m[1]) continue;
    const candidate = decodeHtml(m[1].trim()).replace(/<[^>]+>/g, '').trim();
    if (!isPlausibleAuthor(candidate)) continue;
    return candidate;
  }
  return null;
}

/**
 * Reject obvious non-author strings: rating counts ("(9)",
 * "(2K)", "(1,234)"), bare numbers, empty/long blobs.
 */
function isPlausibleAuthor(s: string): boolean {
  if (!s || s.length > 80) return false;
  if (/^\(?\d/.test(s)) return false; // "(9)", "9", "(1,234)"
  if (/^\(\d+(?:[.,]\d+)?\s*[Kk]?\)$/.test(s)) return false; // "(2K)"
  return true;
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
