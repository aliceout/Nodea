/**
 * Auto-generate the in-app changelog from `git log` between tags
 * (issue #91, Auth-Roadmap doc thread).
 *
 * Reads every annotated / lightweight tag matching `v*` on the
 * current branch, walks `git log <prev>..<tag>` for each, and
 * groups commits by Conventional-Commits prefix (`feat:`, `fix:`,
 * `docs:`, `refactor:`, `perf:`, `test:`, `chore:`, `ci:`,
 * `style:` — same set as CONTRIBUTING.md). Cosmetic / dependency
 * chores end up in a collapsed « Maintenance » section so the
 * end-user view stays readable.
 *
 * Output : a single markdown file at the path passed via
 * `--out=…` (defaults to
 * `packages/web/src/app/pages/Changelog/content.md`) that the
 * SPA renders verbatim via `MarkdownTier`. No external library
 * dependency — uses Node's built-in `child_process` + `fs`.
 *
 * **Behaviour pre-release** : with zero `v*` tag, the script emits
 * a "first release in preparation" placeholder so the page renders
 * gracefully — the route exists, the link works, the content
 * stays honest about the current state.
 *
 * Run : `pnpm changelog` (root script) or
 * `tsx scripts/generate-changelog.ts`.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const DEFAULT_OUT = resolve(
  REPO_ROOT,
  'packages/web/src/app/pages/Changelog/content.md',
);

interface Commit {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
}

interface Release {
  tag: string;
  date: string;
  commits: Commit[];
}

/** Conventional-Commits prefix → display section. Keep the order
 *  the same as in CONTRIBUTING.md so the output is predictable. */
const SECTION_LABELS: Record<string, string> = {
  feat: 'Nouveautés',
  fix: 'Corrections',
  perf: 'Performance',
  refactor: 'Refactor',
  docs: 'Documentation',
  test: 'Tests',
  ci: 'Infrastructure CI',
  chore: 'Maintenance',
  style: 'Style',
};

/** Sections that get folded into the « Maintenance » dropdown
 *  rather than top-level headings — too noisy for end-users. */
const MAINTENANCE_TYPES = new Set(['chore', 'style', 'ci', 'test']);

function sh(cmd: string): string {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/** List of `v*` tags in reverse chronological order (newest first).
 *  Empty array when the repo has no `v*` tags yet. */
function listVersionTags(): string[] {
  try {
    const raw = sh('git tag --list "v*" --sort=-creatordate');
    return raw.split('\n').filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function tagDate(tag: string): string {
  // ISO 8601 short — matches the `## v1.2.3 — 2026-05-14` heading style.
  return sh(`git log -1 --format=%cs ${tag}`);
}

function commitsBetween(from: string | null, to: string): Commit[] {
  // `\x1e` (record separator) between commits ; `\x1f` (unit
  // separator) between fields. Avoids quoting headaches over
  // shells.
  const range = from ? `${from}..${to}` : to;
  const raw = sh(
    `git log ${range} --no-merges --format="%H%x1f%h%x1f%s%x1f%b%x1e"`,
  );
  if (!raw) return [];
  return raw
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [hash, shortHash, subject, ...rest] = chunk.split('\x1f');
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        subject: subject ?? '',
        body: rest.join('\x1f').trim(),
      };
    });
}

/** Classify a commit by its Conventional-Commits prefix. Returns
 *  `null` when the subject doesn't match (e.g. legacy commits or
 *  manual messages without a prefix). */
function classify(commit: Commit): { type: string; scope: string | null; title: string } | null {
  const match = commit.subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!match) return null;
  const [, type, scope, breaking, title] = match;
  if (!type || !SECTION_LABELS[type]) return null;
  return {
    type,
    scope: scope ?? null,
    title: breaking ? `**BREAKING** — ${title}` : title ?? '',
  };
}

function renderRelease(release: Release): string {
  const lines: string[] = [];
  lines.push(`## ${release.tag} — ${release.date}`);
  lines.push('');

  // Buckets in the canonical display order.
  const buckets = new Map<string, string[]>();
  const maintenance: string[] = [];
  const unclassified: string[] = [];

  for (const commit of release.commits) {
    const classified = classify(commit);
    if (!classified) {
      unclassified.push(
        `- ${commit.subject} _(${commit.shortHash})_`,
      );
      continue;
    }
    const line = classified.scope
      ? `- **${classified.scope}** : ${classified.title} _(${commit.shortHash})_`
      : `- ${classified.title} _(${commit.shortHash})_`;
    if (MAINTENANCE_TYPES.has(classified.type)) {
      maintenance.push(line);
    } else {
      const bucket = buckets.get(classified.type) ?? [];
      bucket.push(line);
      buckets.set(classified.type, bucket);
    }
  }

  for (const type of Object.keys(SECTION_LABELS)) {
    if (MAINTENANCE_TYPES.has(type)) continue;
    const lines2 = buckets.get(type);
    if (!lines2 || lines2.length === 0) continue;
    lines.push(`### ${SECTION_LABELS[type]}`);
    lines.push('');
    for (const line of lines2) lines.push(line);
    lines.push('');
  }

  if (unclassified.length > 0) {
    lines.push('### Autres');
    lines.push('');
    for (const line of unclassified) lines.push(line);
    lines.push('');
  }

  if (maintenance.length > 0) {
    // Collapsed via `<details>` — rehype-raw passes it through in the
    // SPA renderer (cf. `pages/docs/primitives.tsx`).
    lines.push('<details>');
    lines.push(`<summary>Maintenance — ${maintenance.length} commit${maintenance.length > 1 ? 's' : ''}</summary>`);
    lines.push('');
    for (const line of maintenance) lines.push(line);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

function renderEmpty(): string {
  return [
    '## Première release en préparation',
    '',
    'Nodea n\'a pas encore de version publique taguée. Le développement',
    'continue sur la branche `refacto-design-v2` ; le premier tag',
    '`v1.0.0` ouvrira ce changelog avec les nouveautés cumulées depuis',
    'le début du projet.',
    '',
    'Pour suivre les changements en attendant : [`git log`](https://github.com/aliceout/Nodea/commits/refacto-design-v2)',
    'sur le repo public.',
    '',
  ].join('\n');
}

function buildChangelog(): string {
  const tags = listVersionTags();
  const header = [
    '# Changelog',
    '',
    'Historique des versions de Nodea, généré automatiquement depuis',
    'l\'historique git à chaque release. Les commits sont groupés par',
    'type (Conventional Commits) ; les chores de maintenance sont',
    'pliés pour ne pas noyer l\'essentiel.',
    '',
  ].join('\n');

  if (tags.length === 0) {
    return `${header}\n${renderEmpty()}`;
  }

  const releases: Release[] = [];
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i]!;
    const prev = tags[i + 1] ?? null;
    releases.push({
      tag,
      date: tagDate(tag),
      commits: commitsBetween(prev, tag),
    });
  }

  const sections = releases.map(renderRelease).join('\n');
  return `${header}\n${sections}`;
}

/* ---- CLI ---------------------------------------------------- */

function parseOutArg(): string {
  const arg = process.argv.find((a) => a.startsWith('--out='));
  if (arg) return resolve(REPO_ROOT, arg.slice('--out='.length));
  return DEFAULT_OUT;
}

const out = parseOutArg();
const md = buildChangelog();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md, 'utf8');

const tags = listVersionTags();
const summary = tags.length === 0
  ? '0 tag (placeholder rendered)'
  : `${tags.length} release${tags.length > 1 ? 's' : ''} rendered`;

console.log(`[changelog] wrote ${out} — ${summary}`);
