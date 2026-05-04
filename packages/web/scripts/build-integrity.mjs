/**
 * Post-build integrity hook (Auth-Spec / Security follow-up).
 *
 * Runs after `vite build` and does two things:
 *
 *   1. Computes SHA-384 of every emitted asset (entry + chunks +
 *      stylesheets + static files) and writes them to
 *      `dist/INTEGRITY.txt`. The file is meant to be published with
 *      every release so users can verify, out-of-band against the
 *      GitHub Release notes, that the bundle they downloaded matches
 *      what was built from a known commit.
 *
 *   2. Injects `integrity="sha384-…" crossorigin="anonymous"` on
 *      every `<script src="…">` and `<link href="…">` tag in
 *      `dist/index.html` whose target lives under `/assets/`. The
 *      browser then refuses to execute the entry chunk if a server
 *      MITM altered it. This covers the entry script + entry CSS
 *      only — runtime-loaded chunks (route-level `React.lazy`
 *      imports) are NOT enforced by the browser, but their hashes
 *      still land in `INTEGRITY.txt` for manual verification.
 *
 * Why post-build (not a Vite plugin):
 *   - Computing the hash from the bytes Vite *wrote to disk* is the
 *     most honest source of truth; a transformIndexHtml hook would
 *     hash the in-memory bundle which can drift from the final file
 *     in pathological cases (e.g. file-system normalisation).
 *   - Zero new dependency, ~50 lines, easy to audit.
 *
 * Limitation (documented at nodea.app/docs/security/tech, « Intégrité du bundle »):
 *   The browser's Subresource Integrity check only enforces what's
 *   referenced from `index.html` directly — i.e. the entry chunk and
 *   the global stylesheet. Vite's lazy-loaded routes import other
 *   chunks at runtime via `<link rel="modulepreload">` which we'd
 *   need to inject SRI into separately; until that lands, those
 *   chunks rely on TLS for transport integrity and on the user
 *   cross-checking `INTEGRITY.txt` against the published release.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const ASSETS = path.join(DIST, 'assets');
const INDEX = path.join(DIST, 'index.html');
const MANIFEST = path.join(DIST, 'INTEGRITY.txt');

function sha384(buf) {
  return createHash('sha384').update(buf).digest('base64');
}

async function listFiles(dir, relPrefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full, rel)));
    } else if (entry.isFile()) {
      out.push({ full, rel });
    }
  }
  return out;
}

async function main() {
  // Sanity check — fail loud if `vite build` didn't run first.
  try {
    await stat(INDEX);
  } catch {
    console.error(
      `[build-integrity] ${INDEX} not found — run \`vite build\` first.`,
    );
    process.exit(1);
  }

  // 1. Hash every asset and build the integrity map keyed by the
  //    web path Vite uses inside index.html (always `/assets/<file>`).
  const assets = await listFiles(ASSETS);
  const integrities = new Map();
  for (const { full, rel } of assets) {
    const buf = await readFile(full);
    const hash = sha384(buf);
    integrities.set(`/assets/${rel}`, `sha384-${hash}`);
  }

  // 2. Inject `integrity` + `crossorigin` on script/link tags whose
  //    target is in our integrity map. We rewrite in place; subsequent
  //    runs are idempotent (the regex skips tags that already carry
  //    `integrity=`).
  let html = await readFile(INDEX, 'utf8');
  html = html.replace(/<(script|link)\b([^>]*)>/g, (match, tag, attrs) => {
    if (/\bintegrity=/.test(attrs)) return match;
    const srcMatch = attrs.match(/\b(?:src|href)="([^"]+)"/);
    if (!srcMatch) return match;
    const url = srcMatch[1];
    const integrity = integrities.get(url);
    if (!integrity) return match;
    const withCrossorigin = /\bcrossorigin\b/.test(attrs)
      ? attrs
      : `${attrs} crossorigin="anonymous"`;
    return `<${tag}${withCrossorigin} integrity="${integrity}">`;
  });
  await writeFile(INDEX, html);

  // 3. Hash the modified index.html itself so the manifest reflects
  //    exactly what's deployed. Order: header → index.html →
  //    assets/* sorted by path.
  const indexHash = sha384(Buffer.from(html));
  const lines = [
    '# Nodea bundle integrity manifest (SHA-384, base64).',
    '# Compare these hashes against the values published in the',
    '# matching GitHub Release to verify your deployed bundle has',
    '# not been tampered with by a compromised server.',
    '#',
    '# A self-hosted instance built from a known commit will produce',
    '# identical hashes; a divergence means the served files are not',
    '# what the source repo would build at that commit.',
    '#',
    `index.html\tsha384-${indexHash}`,
  ];
  const sorted = [...integrities.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [url, integrity] of sorted) {
    // Drop the leading slash for readability — the manifest is a
    // listing, not a URL map.
    lines.push(`${url.replace(/^\//, '')}\t${integrity}`);
  }
  await writeFile(MANIFEST, lines.join('\n') + '\n');

  console.log(
    `[build-integrity] ${integrities.size + 1} files hashed (SHA-384) → dist/INTEGRITY.txt`,
  );
}

main().catch((err) => {
  console.error('[build-integrity] failed:', err);
  process.exit(1);
});
