import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { useDocumentTitle } from '@/lib/use-document-title';

import { MarkdownTier } from '../docs/primitives';
import source from './content.md?raw';

/**
 * `/changelog` — public page that renders the auto-generated
 * release history (issue #91).
 *
 * Content lives in `./content.md`, regenerated from `git log`
 * between `v*` tags via `scripts/generate-changelog.ts`. Same
 * `MarkdownTier` renderer as Docs / Terms so the typography
 * stays in lockstep across the public surfaces.
 *
 * Why a standalone route rather than a `/docs/changelog` tier :
 * the changelog isn't « how Nodea works » material, it's release
 * notes — a separate audience (existing users curious about what
 * changed) and a separate URL nature (often linked from outside
 * docs). The `/changelog` route reads more naturally in emails
 * and tweets than a `/docs/...` nesting.
 *
 * Route is public (no `ProtectedRoute`). Linked from the Login
 * page footer alongside `/terms`. A future « À propos » in the
 * authenticated surface can link here too (cf. issue #28).
 */
export default function ChangelogPage() {
  useDocumentTitle('Changelog');

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
          <MarkdownTier source={source} />
        </article>
      </div>
    </div>
  );
}
