import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { fetchWithTimeout } from './fetch-with-timeout.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';

/**
 * Amazon adapter — scraping-based, **not** the Product Advertising
 * API. We fetch the search results page HTML and pull out title,
 * author, year, ISBN/ASIN and cover URL with regex.
 *
 * Why scraping instead of PA-API:
 *   - PA-API requires an Amazon Associates account active enough to
 *     generate clicks/sales, which doesn't fit a private journaling
 *     app at all.
 *   - PA-API mandates "Buy on Amazon" affiliate links on every
 *     surface — also a non-starter.
 *   - Calibre-Web does the exact same thing on home servers and
 *     it works fine for individual usage.
 *
 * Trade-offs to know:
 *   - Amazon's HTML structure changes regularly. The selectors here
 *     will need periodic updates when they break. Look for the
 *     `s-search-result` data-component-type and the `productTitle`
 *     ids — those are the usual stable anchors.
 *   - Amazon detects bot-shaped traffic and serves a "Sorry, robots"
 *     page on a different layout. A realistic browser User-Agent
 *     header is mandatory; without it the response is unparseable.
 *   - Aggressive use from a single IP can get rate-limited or
 *     temporarily IP-banned. The dispatcher cache (30 min TTL)
 *     keeps the volume manageable for a personal home-server
 *     instance.
 */
export const amazonAdapter: ProviderAdapter = {
  name: 'amazon',
  label: 'Amazon',
  enabled: true,
  needsKey: false,
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

const BROWSER_HEADERS: Record<string, string> = {
  // Recent Chrome on Windows — Amazon's bot detection looks at a
  // combination of UA + Accept-Language + Sec-Ch-Ua hints. A
  // generic curl-style UA gets a 503 captcha page; this browsery
  // one usually slips through.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Per-TLD session cookie cache. The Calibre-Web trick: hit Amazon's
 * homepage once at startup-time of the search, harvest the
 * Set-Cookie response (session-id / ubid-* / i18n-prefs / csm-hit),
 * then send those cookies on the actual search request together
 * with `Referer: https://www.amazon.<tld>/`. Amazon stops seeing a
 * "first visit, no state, direct hit on /s" — which is the shape
 * its anti-bot weighs heavily — and instead reads "user clicked
 * from the homepage with an established session".
 *
 * Cached for 30 min; re-seeded automatically on expiry or after
 * any anti-bot bounce.
 */
interface SessionState {
  cookies: string;
  expiresAt: number;
}
const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 30 * 60 * 1000;

async function ensureSession(tld: string): Promise<string> {
  const cached = sessions.get(tld);
  if (cached && cached.expiresAt > Date.now()) return cached.cookies;

  const res = await fetchWithTimeout(`https://www.amazon.${tld}/`, {
    headers: { ...BROWSER_HEADERS, 'Sec-Fetch-Site': 'none' },
    timeoutMs: 6000,
  });
  // `getSetCookie` returns each `Set-Cookie` header as a separate
  // entry (the only correct way to read multi-Set-Cookie since the
  // standard `get('set-cookie')` collapses them with a comma).
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = setCookies
    .map((c) => c.split(';')[0]) // keep only `name=value` from each
    .filter((c): c is string => Boolean(c))
    .join('; ');
  const session: SessionState = {
    cookies,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(tld, session);
  return cookies;
}

async function search(query: string, tld: string, limit: number): Promise<NormalisedBook[]> {
  // Seed (or reuse) a session before hitting the search endpoint.
  // The cookies + Referer make the request look like a normal
  // homepage→search navigation rather than a direct script call.
  const cookies = await ensureSession(tld);

  // `i=stripbooks` restricts the search to printed books;
  // `&ref=nb_sb_noss` mimics the "submit search" path so Amazon
  // doesn't trigger an interstitial captcha.
  const url = `https://www.amazon.${tld}/s?k=${encodeURIComponent(query)}&i=stripbooks&ref=nb_sb_noss`;
  const res = await fetchWithTimeout(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: `https://www.amazon.${tld}/`,
      'Sec-Fetch-Site': 'same-origin',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    timeoutMs: 8000,
  });
  if (!res.ok) throw new Error(`amazon ${res.status} ${res.statusText}`);
  const html = await res.text();

  // AWS WAF JavaScript challenge: HTML 200 with `awsWafCookieDomainList`
  // and `gokuProps` — these are the exact markers of the WAF bot
  // detection puzzle that requires running JS to obtain an
  // `aws-waf-token` cookie. We can't solve it from Node without a
  // headless browser. Surface it as a distinct, accurate error so
  // the operator knows it's not our parser at fault — it's Amazon
  // requiring JS execution that this server can't provide.
  if (
    /window\.awsWafCookieDomainList/.test(html) ||
    /window\.gokuProps/.test(html)
  ) {
    sessions.delete(tld);
    throw new Error(
      'amazon — challenge AWS WAF (JavaScript requis) ; ' +
        'pour passer il faudrait un navigateur headless (Puppeteer/Playwright)',
    );
  }
  // Older bot-detection layouts: CAPTCHA / "Sorry" / i18n interstitial.
  if (
    /api-services-support@amazon\.com/i.test(html) ||
    /Type the characters you see in this image/i.test(html) ||
    /\bRobot Check\b/i.test(html) ||
    /\bSorry, we just need to make sure\b/i.test(html) ||
    /To discuss automated access/i.test(html)
  ) {
    sessions.delete(tld);
    throw new Error('amazon — bot-detection / captcha (réessaie plus tard)');
  }
  const results = parseSearchHtml(html, limit);
  // When parsing yields nothing, log a snippet of the HTML in dev
  // so the operator can see what Amazon actually returned (homepage
  // bounce? new layout? interstitial we don't recognise?). Stays
  // out of prod logs — too noisy and contains user query terms.
  if (results.length === 0 && process.env.NODE_ENV !== 'production') {
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
    const snippet = html.slice(0, 800).replace(/\s+/g, ' ');
    console.warn(
      `[library-lookup] amazon parser yielded 0 hits ` +
        `for "${query}" on amazon.${tld}.\n` +
        `  page <title>: ${titleMatch?.[1] ?? '(none)'}\n` +
        `  first 800 chars: ${snippet}`,
    );
  }
  return results;
}

/**
 * Parse Amazon's search results HTML. The robust anchors are
 * `data-component-type="s-search-result"` (one per tile) and
 * `data-asin="..."` (the product id). Both attributes can appear
 * in any order on the same `<div>` — and have, depending on the
 * Amazon edge that served the response — so we extract `data-asin`
 * separately from the tile match instead of bundling them into
 * one regex.
 */
function parseSearchHtml(html: string, limit: number): NormalisedBook[] {
  const out: NormalisedBook[] = [];
  // Tile boundary: any element that carries `s-search-result`. We
  // accept `data-component-type` OR `data-cel-widget` (Amazon
  // sometimes uses the latter on the same wrapper). The look-ahead
  // closes the current tile when the next one starts.
  const tileRegex =
    /<div[^>]*\bdata-component-type="s-search-result"[^>]*>([\s\S]*?)(?=<div[^>]*\bdata-component-type="s-search-result"|<\/div>\s*<\/div>\s*<\/span>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div[^>]*\bclass="[^"]*s-pagination|$)/g;
  let match: RegExpExecArray | null;
  while ((match = tileRegex.exec(html)) !== null && out.length < limit) {
    const tile = match[0];
    const block = match[1];
    if (!tile || !block) continue;
    // Pull the ASIN from the tile's opening div — same string we
    // matched for the boundary, so it's guaranteed present.
    const asinMatch = /\bdata-asin="([^"]+)"/.exec(tile);
    const asin = asinMatch?.[1];
    if (!asin) continue;

    const title = extractTitle(block);
    if (!title) continue;
    const author = extractAuthor(block);
    const cover = extractCover(block);
    const year = extractYear(extractYearString(block));

    // Books on Amazon often have an ASIN that IS the ISBN-10
    // (10 alphanumeric, last char can be 'X').
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
  // <h2 ...><a ...><span>TITLE</span></a></h2>
  const m = /<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/.exec(block);
  if (!m || !m[1]) return null;
  const stripped = m[1].replace(/<[^>]+>/g, '').trim();
  return decodeHtml(stripped) || null;
}

function extractAuthor(block: string): string | null {
  // First `<a class="...a-link-normal..."><span>AUTHOR</span></a>` after
  // a "by" / "par" label tends to be the author. Fall back to the
  // first link with `s-link-style` if present.
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
  // Amazon search tiles sometimes show "(YYYY)" after the title.
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
