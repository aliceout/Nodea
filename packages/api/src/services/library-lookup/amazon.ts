import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { getConfig } from '../../config.ts';
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
    return search(stripped, 'fr', 1);
  },

  async byQuery(query, _lang): Promise<NormalisedBook[]> {
    // Always hit `amazon.fr` (see issue #38 — TLD will become
    // user-locale-driven later). 30 covers a full first results
    // page on amazon.fr (~16-24 tiles depending on layout) plus
    // any spillover. Per-tile parse is cheap (regex), the cost is
    // dominated by the Puppeteer round-trip itself which is fixed
    // regardless of how many tiles we read.
    return search(query, 'fr', 30);
  },
};

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
      // Read the language off the tile's HTML when Amazon flags
      // it explicitly via title suffixes ("(English Edition)",
      // "(French Edition)", etc.) or a `[Lang]` badge in the
      // metadata strip. Reading from the page beats hardcoding by
      // TLD: amazon.fr sells EN/ES/DE editions too, and tagging
      // every result as `fr` would mislabel them. Falls back to
      // `null` when nothing in the tile names a language — the
      // dispatcher's filter keeps `null` records on purpose.
      language: extractLanguage(tile, title),
      originalLanguage: null,
      publisher: null,
      collection: null,
      summary: null,
      isbn13: null,
      isbn10: looksLikeIsbn10 ? asin.toUpperCase() : null,
      format: null,
      series: null,
      coverUrl: cover,
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
  // a naive "first match wins" approach picks up the rating count
  // ("(9)", "(2K)") because the ratings anchor uses the same class.
  // The "par"/"by" pattern was also flaky because Amazon often
  // splits the byline across nested spans with `&nbsp;` separators
  // that don't match the simple `\s*` in the regex.
  //
  // The reliable signal is the byline link's URL: Amazon always
  // routes "more by this author" through `field-author=` (or its
  // search-refinement equivalent `rh=p_27%3A...`). Whatever else
  // changes in the markup, that URL parameter sticks around because
  // it's how the site itself navigates to author pages. We try it
  // first, then fall back to the textual markers.
  const patterns: RegExp[] = [
    // <a href="...field-author=..."> NAME </a> (the canonical byline)
    /<a[^>]*\bhref="[^"]*[?&]field-author=[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    // <a href="...rh=p_27%3A..."> NAME </a> (refinement-style author link)
    /<a[^>]*\bhref="[^"]*\brh=[^"]*p_27%3A[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    // <a href="/Author-Name/e/B0XYZ..."> NAME </a> (author entity page —
    // Amazon's "follow this author" link, encoded as `/e/B[0-9A-Z]+`).
    /<a[^>]*\bhref="\/[^"]*\/e\/[A-Z0-9]+[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    // "par"/"by" before an `<a>` link with the author name. `[\s\S]*?`
    // (not just `\s*`) tolerates the closing-span / nbsp clutter
    // Amazon stuffs between the marker and the link.
    /(?:par|by)[\s\S]{0,40}?<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i,
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
  // Dev-only diagnostic: when every pattern fails, dump the byline-ish
  // window so we can see what shape Amazon is using today and add a
  // pattern. We slice around the first `<h2>` (title block) since the
  // byline sits right after it; works whether the tile starts with a
  // wrapper div or the title block directly.
  if (process.env.NODE_ENV !== 'production') {
    const titleEnd = block.search(/<\/h2>/i);
    const start = titleEnd > 0 ? titleEnd : 0;
    const snippet = block.slice(start, start + 800).replace(/\s+/g, ' ');
    console.warn('[library-lookup] amazon: no author matched. Byline window:', snippet);
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

/**
 * Best-effort language detection for an Amazon search-result tile.
 *
 * Two signals, in order of confidence:
 *   1. The title suffix Amazon appends to non-default-locale editions:
 *      `(English Edition)`, `(French Edition)`, `(Édition française)`,
 *      `(Edición en español)`, etc. This is reliable when present —
 *      Amazon uses it consistently to disambiguate translations.
 *   2. A "Langue : XYZ" / "Language: XYZ" data line that occasionally
 *      shows up in the tile's metadata strip.
 *
 * Returns `null` when neither signal is found. The dispatcher keeps
 * `null`-language records on purpose (we don't drop on uncertainty),
 * so untagged tiles still reach the user — they just won't display
 * a language badge.
 */
function extractLanguage(tile: string, title: string): string | null {
  // 1. Suffix patterns on the title — the cleanest signal.
  const suffixMap: ReadonlyArray<readonly [RegExp, string]> = [
    [/\(\s*english\s+edition\s*\)/i, 'en'],
    [/\(\s*french\s+edition\s*\)/i, 'fr'],
    [/\(\s*[ée]dition\s+fran[çc]aise\s*\)/i, 'fr'],
    [/\(\s*version\s+fran[çc]aise\s*\)/i, 'fr'],
    [/\(\s*spanish\s+edition\s*\)/i, 'es'],
    [/\(\s*edici[óo]n\s+(?:en\s+)?espa[ñn]ol(?:a)?\s*\)/i, 'es'],
    [/\(\s*german\s+edition\s*\)/i, 'de'],
    [/\(\s*deutsche?\s+(?:ausgabe|edition)\s*\)/i, 'de'],
    [/\(\s*italian\s+edition\s*\)/i, 'it'],
    [/\(\s*edizione\s+italiana\s*\)/i, 'it'],
    [/\(\s*portuguese\s+edition\s*\)/i, 'pt'],
    [/\(\s*edi[çc][ãa]o\s+(?:em\s+)?portugu[êe]sa?\s*\)/i, 'pt'],
    [/\(\s*japanese\s+edition\s*\)/i, 'ja'],
  ];
  for (const [re, code] of suffixMap) {
    if (re.test(title)) return code;
  }

  // 2. Metadata line — looser signal, hunt only if the suffix didn't
  // match. Amazon's locale labels for the language field:
  //   FR: "Langue : Français"
  //   EN: "Language: English"
  //   ES: "Idioma: Español"
  //   DE: "Sprache: Deutsch"
  //   IT: "Lingua: Italiano"
  //   PT: "Idioma: Português"
  const metaPatterns: ReadonlyArray<readonly [RegExp, string]> = [
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*Fran[çc]ais\b/i, 'fr'],
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*English\b/i, 'en'],
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*Espa[ñn]ol\b/i, 'es'],
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*Deutsch\b/i, 'de'],
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*Italiano\b/i, 'it'],
    [/(?:Langue|Language|Idioma|Sprache|Lingua)\s*[:\s]\s*Portugu[êe]s\b/i, 'pt'],
  ];
  for (const [re, code] of metaPatterns) {
    if (re.test(tile)) return code;
  }

  return null;
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
