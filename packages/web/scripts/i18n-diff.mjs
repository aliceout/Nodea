#!/usr/bin/env node
/**
 * `pnpm i18n:diff` — print every key that exists in one locale
 * but not the other, namespace by namespace.
 *
 * Mirrors the contract enforced by `parity.test.ts` :
 *   - reads JSON files under `src/i18n/locales/{fr,en}/`
 *   - flattens nested keys into dotted paths
 *   - reports `FR-only` / `EN-only` per namespace
 *
 * Exit code is 0 when both locales line up (silent), 1 when a
 * drift is found. CI can wire it into a `pnpm -r run i18n:diff`
 * step alongside the existing parity test ; the test catches
 * regressions in PRs, the CLI lets a translator audit a tree
 * locally without firing up vitest.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'src', 'i18n', 'locales');
const FR_DIR = join(ROOT, 'fr');
const EN_DIR = join(ROOT, 'en');

function flatten(bag, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(bag)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flatten(value, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function readNamespace(dir, file) {
  const raw = readFileSync(join(dir, file), 'utf8');
  return JSON.parse(raw);
}

const frFiles = new Set(readdirSync(FR_DIR).filter((f) => f.endsWith('.json')));
const enFiles = new Set(readdirSync(EN_DIR).filter((f) => f.endsWith('.json')));
const all = new Set([...frFiles, ...enFiles]);

let drift = 0;
const lines = [];

for (const file of [...all].sort()) {
  const namespace = file.replace(/\.json$/, '');
  if (!frFiles.has(file)) {
    lines.push(`✗ ${namespace} : missing FR file`);
    drift += 1;
    continue;
  }
  if (!enFiles.has(file)) {
    lines.push(`✗ ${namespace} : missing EN file`);
    drift += 1;
    continue;
  }
  const fr = new Set(flatten(readNamespace(FR_DIR, file)));
  const en = new Set(flatten(readNamespace(EN_DIR, file)));
  const onlyFr = [...fr].filter((k) => !en.has(k)).sort();
  const onlyEn = [...en].filter((k) => !fr.has(k)).sort();
  if (onlyFr.length === 0 && onlyEn.length === 0) {
    lines.push(`✓ ${namespace} : ${fr.size} keys`);
    continue;
  }
  drift += 1;
  lines.push(`✗ ${namespace} :`);
  if (onlyFr.length) lines.push(`    FR-only : ${onlyFr.join(', ')}`);
  if (onlyEn.length) lines.push(`    EN-only : ${onlyEn.join(', ')}`);
}

console.log(lines.join('\n'));
if (drift > 0) {
  console.error(`\n${drift} namespace(s) out of sync.`);
  process.exit(1);
}
