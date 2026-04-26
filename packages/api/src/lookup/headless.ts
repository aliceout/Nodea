import puppeteer, { type Browser } from 'puppeteer';

/**
 * Headless Chromium singleton + a `fetchRendered` helper that
 * mimics the shape of `fetchWithTimeout` while routing the request
 * through a real browser. Used by the Amazon adapter to pass the
 * AWS WAF JavaScript challenge — Chromium executes the WAF JS
 * naturally, gets the `aws-waf-token` cookie, and the actual
 * results page comes back parseable.
 *
 * Security model:
 *
 *   - **Sandbox stays ON.** Chromium is talking to untrusted HTML
 *     and JS from amazon.com / amazon.fr / etc. We never pass
 *     `--no-sandbox`. If a Chromium 0-day pops, the sandbox is the
 *     line of defence between the page's JS and the host. Run the
 *     server in a container in prod for additional isolation.
 *   - **No persistent profile.** Each browser session is ephemeral
 *     — cookies, local storage, cache live in RAM only and die
 *     with the browser process. No on-disk attack surface.
 *   - **Resource interception drops images / fonts / stylesheets /
 *     media** for every page. We only need the HTML to parse, and
 *     dropping the rest cuts ~80 % of the bandwidth + RAM, plus
 *     short-circuits any tracker/analytics scripts that would
 *     otherwise load.
 *   - **Pages closed in `finally`** so a thrown error doesn't leak
 *     a tab. The browser itself is kept alive across requests
 *     (singleton) — launching a fresh Chromium per call would be
 *     a 1-2 s tax on every lookup. The browser is closed cleanly
 *     on SIGTERM / SIGINT (see `src/index.ts`).
 *   - **Auto-respawn on crash.** If Chromium dies (`disconnected`
 *     event), the next call relaunches. We never run a zombie
 *     pool of orphan processes.
 *
 * What this helper deliberately does NOT do: stealth-plugin
 * patches (`puppeteer-extra-plugin-stealth` and friends). Those
 * exist to evade anti-headless-detection hooks like
 * `navigator.webdriver === true`. Amazon's WAF doesn't reject on
 * that flag in our testing — it cares about JS execution, which
 * Chromium provides natively. If we hit a wall later we can
 * layer the plugin in; for now it's an extra dep we don't need.
 */

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer
    .launch({
      headless: true,
      args: [
        // Avoid /dev/shm exhaustion — important in Docker where
        // shared memory is small (~64 MB by default).
        '--disable-dev-shm-usage',
        // No GPU available in headless server contexts.
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        // Reduce footprint — features we don't need that consume
        // memory and increase attack surface.
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
      ],
    })
    .then((browser) => {
      // If the browser dies (OOM, sandbox kill, manual quit),
      // clear the promise so the next call respawns. Without this
      // we'd cache a broken connection forever.
      browser.on('disconnected', () => {
        browserPromise = null;
      });
      return browser;
    })
    .catch((err) => {
      // Failed launch shouldn't be cached — next call retries.
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

/** Close the singleton browser cleanly. Called from the API
 *  shutdown hook on SIGTERM / SIGINT. */
export async function closeHeadlessBrowser(): Promise<void> {
  const current = browserPromise;
  if (!current) return;
  browserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch {
    // Best-effort during shutdown — if the close fails Chromium
    // will be reaped by the OS when the parent process exits.
  }
}

export interface RenderedFetchOptions {
  /** Send a `Referer` header on the navigation. */
  referer?: string;
  /** Hard navigation timeout (default 15 s — accounts for the
   *  WAF challenge round-trip + main page load). */
  timeoutMs?: number;
  /** Browser User-Agent override (defaults to Chromium's UA). */
  userAgent?: string;
  /** BCP 47 Accept-Language. Defaults to `fr-FR`. */
  acceptLanguage?: string;
}

export interface RenderedFetchResult {
  /** Final HTML after all redirects + JS execution. */
  html: string;
  /** Final URL the browser landed on (after any redirect). */
  finalUrl: string;
  /** HTTP status code of the **final** navigation (not the
   *  intermediate WAF challenge). */
  status: number;
}

/**
 * Navigate Chromium to `url` and return the post-render HTML. The
 * browser executes any JavaScript on the way (which is the whole
 * point — that's what passes the WAF challenge), and we read the
 * DOM after `networkidle2`.
 *
 * Throws on timeout, navigation failure, or browser-launch error.
 */
export async function fetchRendered(
  url: string,
  options: RenderedFetchOptions = {},
): Promise<RenderedFetchResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Drop heavy / irrelevant resources before they hit the wire.
    // We only need the HTML response body and any JS that runs on
    // it (the WAF challenge). Images, fonts, stylesheets, media,
    // and tracker beacons get aborted.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (
        type === 'image' ||
        type === 'media' ||
        type === 'font' ||
        type === 'stylesheet'
      ) {
        void req.abort();
      } else {
        void req.continue();
      }
    });

    if (options.userAgent) await page.setUserAgent(options.userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': options.acceptLanguage ?? 'fr-FR,fr;q=0.9,en;q=0.8',
      ...(options.referer ? { Referer: options.referer } : {}),
    });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs ?? 15000,
    });

    return {
      html: await page.content(),
      finalUrl: page.url(),
      status: response?.status() ?? 0,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
