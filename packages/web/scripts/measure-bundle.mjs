#!/usr/bin/env node
/**
 * Bundle size measurement — pose une baseline et la compare au
 * budget figé dans `PERF-BASELINE.md`.
 *
 * Lance `vite build` (sauf si `--skip-build` est passé), liste
 * tous les `.js` / `.css` du `dist/`, compte leur taille brute et
 * leur taille gzippée, agrège par buckets, imprime un tableau et
 * sort en non-zéro si le total dépasse le budget.
 *
 * Usage :
 *   node scripts/measure-bundle.mjs              # build + mesure + assert
 *   node scripts/measure-bundle.mjs --skip-build # mesure le dist/ existant
 *   node scripts/measure-bundle.mjs --json       # sortie JSON pour CI / scripting
 *
 * Le budget vit en dur dans ce fichier — pas dans un JSON séparé,
 * pour que la modification du seuil passe toujours par une revue
 * de code (et pas par une simple édition de config qu'un dérapage
 * silencieux pourrait pousser).
 */
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(WEB_ROOT, 'dist');

/* ============================================================================
 * Budget — total gzipped JS+CSS shipped to the browser. Update with care
 * (and a commit message that explains why). Last increase: 2026-05, baseline.
 * ========================================================================== */
const BUDGET_GZIP_TOTAL_KB = 1500;

/** Buckets — used to surface trends per category in the report. */
const BUCKET_PATTERNS = [
  { name: 'crypto',     pattern: /crypto-|opaque|argon2|hash-wasm|bip39/i },
  { name: 'docs page',  pattern: /Docs-|markdown-/ },
  { name: 'react',      pattern: /react-vendor/ },
  { name: 'ui kit',     pattern: /headlessui|heroicons/ },
  { name: 'sentry',     pattern: /sentry|index\.esm/ },
  { name: 'app',        pattern: /index-/ },
  { name: 'modules',    pattern: /^(mood|goals|journal|library|review)/ },
];

/* ========================================================================== */

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function gzipSize(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf, { level: 9 }).length;
}

function listAssets() {
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!statSync(assetsDir, { throwIfNoEntry: false })) {
    throw new Error(`No dist/ found. Run "pnpm build" first or omit --skip-build.`);
  }
  const files = readdirSync(assetsDir);
  return files
    .filter((f) => /\.(js|css)$/i.test(f))
    .map((f) => {
      const full = path.join(assetsDir, f);
      const raw = statSync(full).size;
      const gz = gzipSize(full);
      const ext = f.endsWith('.css') ? 'css' : 'js';
      return { name: f, ext, raw, gz };
    })
    .sort((a, b) => b.gz - a.gz);
}

function bucketize(assets) {
  const buckets = new Map(BUCKET_PATTERNS.map((b) => [b.name, { gz: 0, raw: 0, files: 0 }]));
  buckets.set('other', { gz: 0, raw: 0, files: 0 });
  for (const a of assets) {
    const match = BUCKET_PATTERNS.find((b) => b.pattern.test(a.name));
    const bucket = match ? buckets.get(match.name) : buckets.get('other');
    bucket.gz += a.gz;
    bucket.raw += a.raw;
    bucket.files += 1;
  }
  return buckets;
}

function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const asJson = args.includes('--json');

  if (!skipBuild) {
    console.log('Building web…');
    execSync('pnpm exec vite build', { cwd: WEB_ROOT, stdio: 'inherit' });
  }

  const assets = listAssets();
  const totalRaw = assets.reduce((s, a) => s + a.raw, 0);
  const totalGz = assets.reduce((s, a) => s + a.gz, 0);
  const buckets = bucketize(assets);

  if (asJson) {
    console.log(JSON.stringify({
      totalRawBytes: totalRaw,
      totalGzipBytes: totalGz,
      budgetGzipKb: BUDGET_GZIP_TOTAL_KB,
      buckets: Object.fromEntries(buckets),
      assets: assets.map((a) => ({ ...a })),
    }, null, 2));
  } else {
    console.log('\n=== Bundle assets (gzipped, sorted desc) ===');
    for (const a of assets.slice(0, 20)) {
      console.log(`  ${a.name.padEnd(50)} ${fmtKb(a.gz).padStart(10)} (raw ${fmtKb(a.raw)})`);
    }
    if (assets.length > 20) {
      console.log(`  …+${assets.length - 20} smaller files`);
    }

    console.log('\n=== Buckets ===');
    for (const [name, b] of buckets) {
      if (b.files === 0) continue;
      console.log(`  ${name.padEnd(15)} ${fmtKb(b.gz).padStart(10)}  (${b.files} files)`);
    }

    console.log('\n=== Totals ===');
    console.log(`  Raw   : ${fmtKb(totalRaw)}`);
    console.log(`  Gzip  : ${fmtKb(totalGz)}`);
    console.log(`  Budget (gzip) : ${BUDGET_GZIP_TOTAL_KB} KB`);
  }

  const totalGzKb = totalGz / 1024;
  if (totalGzKb > BUDGET_GZIP_TOTAL_KB) {
    console.error(`\n✖ Bundle exceeds budget : ${fmtKb(totalGz)} > ${BUDGET_GZIP_TOTAL_KB} KB`);
    console.error('  Increase BUDGET_GZIP_TOTAL_KB in scripts/measure-bundle.mjs');
    console.error('  ONLY when the increase is justified (new feature, lib swap)');
    console.error('  and the diff is reviewed.');
    process.exit(1);
  }
  if (!asJson) {
    console.log(`\n✓ Within budget (${(BUDGET_GZIP_TOTAL_KB - totalGzKb).toFixed(1)} KB headroom)\n`);
  }
}

main();
