import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';

import { MarkdownTier } from '../docs/primitives';
import source from './content.md?raw';

/**
 * `/changelog` — public page that renders the auto-generated release
 * history (issue #91).
 *
 * Content lives in `./content.md`, regenerated from `git log` between
 * `v*` tags via `scripts/generate-changelog.ts`. Each `## vX.Y.Z`
 * release is rendered as a collapsible accordion — the latest open, the
 * rest folded — so the page stays digestible as releases pile up. The
 * intro (everything before the first version heading) and each version
 * body still go through the same `MarkdownTier` renderer as Docs / Terms
 * so the typography stays in lockstep.
 *
 * Standalone public route (no `ProtectedRoute`), linked from the Login
 * footer; reads more naturally in emails/tweets than a `/docs/...` nest.
 */

interface ChangelogVersion {
  /** The heading text after `## ` — e.g. « v2.13.0 — 2026-06-19 ». */
  heading: string;
  /** The version's markdown body (the `###` sections + Maintenance). */
  body: string;
}

/**
 * Split the generated markdown into the intro (before the first version)
 * and one chunk per `## vX.Y.Z` release. The matcher requires exactly two
 * `#` followed by a non-`#` so the inner `###`/`####` headings of a
 * version body are never mistaken for release boundaries.
 */
function parseChangelog(md: string): { intro: string; versions: ChangelogVersion[] } {
  const introLines: string[] = [];
  const versions: { heading: string; bodyLines: string[] }[] = [];
  let current: { heading: string; bodyLines: string[] } | null = null;
  for (const line of md.split('\n')) {
    const match = /^## ([^#].*)$/.exec(line);
    if (match) {
      current = { heading: match[1] ?? '', bodyLines: [] };
      versions.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      introLines.push(line);
    }
  }
  return {
    intro: introLines.join('\n').trim(),
    versions: versions.map((v) => ({
      heading: v.heading,
      body: v.bodyLines.join('\n').trim(),
    })),
  };
}

/** Granularity filter, read as a floor: « show everything from this level
 *  up ». `all` = from patch (everything), `minor` = minor + major,
 *  `major` = only major bumps. */
type Filter = 'all' | 'minor' | 'major';

/** Left-to-right order of the 3-position slider, with the semver word each
 *  position shows *from*. `all` sits under « Patch » (show from patch up). */
const SLIDER_POSITIONS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Patch' },
  { id: 'minor', label: 'Minor' },
  { id: 'major', label: 'Major' },
];

/** Fixed px width per position — keeps the sliding thumb's translateX a
 *  plain `index * SEG_W` instead of percentage-vs-padding math. */
const SEG_W = 84;

/** Classify a « vX.Y.Z » heading by its semver bump level. Unparsable
 *  headings (e.g. a « première release » placeholder) are `other`. */
function versionLevel(heading: string): 'major' | 'minor' | 'patch' | 'other' {
  const m = /^v\d+\.(\d+)\.(\d+)/.exec(heading);
  if (!m) return 'other';
  if (m[2] !== '0') return 'patch';
  if (m[1] !== '0') return 'minor';
  return 'major';
}

function matchesFilter(level: ReturnType<typeof versionLevel>, filter: Filter): boolean {
  if (filter === 'all' || level === 'other') return true;
  if (filter === 'minor') return level !== 'patch'; // minor + major
  return level === 'major';
}

/**
 * 3-position segmented slider (a pill with a thumb that glides between the
 * three labels) acting as the granularity floor. Native `<button role=radio>`
 * so it's keyboard- and screen-reader-navigable; the visible label is wired
 * as the group's accessible name via `aria-labelledby`.
 */
function GranularitySlider({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
}) {
  const index = SLIDER_POSITIONS.findIndex((p) => p.id === value);
  return (
    <div
      role="radiogroup"
      aria-labelledby="changelog-filter-label"
      className="relative inline-flex rounded-full border border-hair bg-bg-2 p-1"
    >
      {/* Sliding thumb — sits under the labels (z-0), glides on filter change. */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-full bg-accent-soft shadow-sm transition-transform duration-200 ease-out"
        style={{ width: SEG_W, transform: `translateX(${index * SEG_W}px)` }}
      />
      {SLIDER_POSITIONS.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.id)}
            style={{ width: SEG_W }}
            className={cn(
              'relative z-10 cursor-pointer rounded-full py-1 text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              active ? 'font-semibold text-accent-deep' : 'font-medium text-muted hover:text-ink',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function VersionAccordion({
  heading,
  body,
  defaultOpen,
}: ChangelogVersion & { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-hair">
      {/* `<h2>` keeps the heading semantics the `##` carried, so screen
          readers can still navigate releases by heading. */}
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-3 py-4 text-left text-[18px] font-semibold tracking-[-0.01em] text-accent transition-colors hover:text-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span>{heading}</span>
          <ChevronDownIcon
            className={cn(
              'h-4 w-4 shrink-0 text-muted transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open ? (
        <div className="pb-5">
          <MarkdownTier source={body} />
        </div>
      ) : null}
    </section>
  );
}

export default function ChangelogPage() {
  useDocumentTitle('Changelog');
  const { intro, versions } = parseChangelog(source);
  const [filter, setFilter] = useState<Filter>('all');
  const visible = versions.filter((v) =>
    matchesFilter(versionLevel(v.heading), filter),
  );

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[680px] px-6 py-12 md:py-16">
        <Link
          to="/login"
          className="group mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeftIcon
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          Retour à la connexion
        </Link>

        <article className="animate-fade-up">
          {intro ? <MarkdownTier source={intro} /> : null}

          {/* Granularity floor — « Patch » shows everything, « Minor » hides
              patch releases, « Major » keeps only X.0.0. Keying the
              accordions by filter remounts them so the first visible release
              re-opens after a filter change. */}
          <div className="mt-4 mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span id="changelog-filter-label" className="text-[12.5px] font-medium text-muted">
              Afficher à partir de :
            </span>
            <GranularitySlider value={filter} onChange={setFilter} />
          </div>
          <div>
            {visible.map((v, i) => (
              <VersionAccordion
                key={`${filter}:${v.heading}`}
                heading={v.heading}
                body={v.body}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
