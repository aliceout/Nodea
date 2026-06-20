/**
 * Documentation drift guard (CI).
 *
 * What: fails the build when the docs reference a repo path that no
 * longer exists, or when a count the docs state (store slices, i18n
 * namespaces, entry tables) drifts from what the code actually has.
 *
 * Where it sits: a standalone Node script (no deps) run by CI and via
 * `pnpm check:docs`. It exists because doc↔code drift is invisible to
 * tsc/eslint — the audit of 2026-06 found four dead `docs/…` pointers
 * and several stale counts that no tool would have caught.
 *
 * Assumptions: path references are checked only when they are
 * unambiguous — backticked paths rooted at `packages/`, `docs/`,
 * `.github/` or `scripts/`, and Markdown links resolved relative to
 * their file. Tokens carrying glob/placeholder chars (`* < > { } |`)
 * are skipped on purpose (e.g. `schema/<domain>.ts`). The count checks
 * compute the truth from the filesystem, then assert the doc states it.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

/* ---- helpers -------------------------------------------------------- */

/** Recursively list files under `dir` matching `ext`. */
function walk(dir, ext, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      walk(full, ext, acc);
    } else if (full.endsWith(ext)) {
      acc.push(full);
    }
  }
  return acc;
}

const PLACEHOLDER = /[*<>{}|()\s]/;

/* ---- part A: dead repo-path references ------------------------------ */

// Markdown files that get the full path audit.
const docFiles = [
  // ADRs are point-in-time records and may legitimately reference code
  // that was later removed (the whole point of a "superseded" decision),
  // so they are excluded from the dead-path check.
  ...walk(join(ROOT, 'docs'), '.md').filter((f) => !f.includes(`${join('docs', 'adr')}`)),
  join(ROOT, 'README.md'),
  join(ROOT, 'CLAUDE.md'),
  ...walk(join(ROOT, '.github'), '.md'),
  ...walk(join(ROOT, 'packages/web/src/app/pages/docs/content'), '.md'),
];

const ROOTED = /`((?:packages|docs|scripts|\.github)\/[^`]+)`/g;
const MD_LINK = /\]\(([^)]+)\)/g;

for (const file of docFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  // backticked, repo-root-relative paths
  for (const m of text.matchAll(ROOTED)) {
    const token = m[1].replace(/#.*$/, '');
    if (PLACEHOLDER.test(token)) continue;
    if (!existsSync(join(ROOT, token))) {
      errors.push(`${rel}: dead path reference \`${token}\``);
    }
  }

  // Markdown links resolved relative to the file (only checkable targets)
  for (const m of text.matchAll(MD_LINK)) {
    let target = m[1].trim().replace(/#.*$/, '').replace(/\s+".*"$/, '');
    if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
    if (PLACEHOLDER.test(target)) continue;
    if (!/\.(md|ts|tsx|mjs|json|sh|ya?ml)$/.test(target) && !target.endsWith('/')) continue;
    const abs = resolve(dirname(file), target);
    if (!existsSync(abs)) {
      errors.push(`${rel}: dead link target \`${target}\``);
    }
  }
}

/* ---- part B: count parity (filesystem truth -> doc must state it) --- */

function countParity(label, actual, docPath, regex) {
  const text = readFileSync(join(ROOT, docPath), 'utf8');
  const m = text.match(regex);
  if (!m) {
    errors.push(`${docPath}: cannot find the ${label} count claim (expected ${actual})`);
    return;
  }
  if (Number(m[1]) !== actual) {
    errors.push(`${docPath}: states ${label} = ${m[1]}, code has ${actual}`);
  }
}

const slices = readdirSync(join(ROOT, 'packages/web/src/core/store/slices')).filter((f) =>
  f.endsWith('.ts'),
).length;
countParity('store slices', slices, 'docs/Architecture.md', /Slices \((\d+)\)/);

const namespaces = readdirSync(join(ROOT, 'packages/web/src/i18n/locales/fr')).filter((f) =>
  f.endsWith('.json'),
).length;
countParity('i18n namespaces', namespaces, 'docs/Internationalisation.md', /(\d+)\s+namespaces/);

const entryTables = (
  readFileSync(join(ROOT, 'packages/api/src/db/schema/entries.ts'), 'utf8').match(
    /=\s*createEntryTable\(/g,
  ) ?? []
).length;
countParity('entry tables', entryTables, 'docs/Database.md', /All (\d+) entry tables/);

/* ---- report -------------------------------------------------------- */

if (errors.length) {
  console.error(`✗ check-docs found ${errors.length} issue(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nFix the doc (or the code) so they agree — see CLAUDE.md single-source rule.');
  process.exit(1);
}
console.log('✓ check-docs: all referenced paths exist and counts match code.');
