import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { useDocumentTitle } from '@/lib/use-document-title';

import { MarkdownTier } from '../docs/primitives';
import source from './content.md?raw';

/**
 * Terms — page publique « Conditions générales d'utilisation ».
 *
 * Statut V1 : brouillon. Le contenu vit dans `./content.md` (déplacé
 * depuis `docs/Terms.md` lors du chantier de centralisation des
 * sources de vérité in-app), rendu ici via le même `MarkdownTier`
 * que les pages Docs — même typographie, même rythme. Pas de TOC :
 * la CGU est courte, on scrolle.
 *
 * Route publique (`/terms`) — pas derrière `ProtectedRoute`. Lien
 * depuis le footer du panneau marketing partagé (`AuthMarketingPanel`,
 * affiché sur toutes les pages d'auth, desktop seulement) — et
 * register le jour où on voudra exiger l'accept à la création de
 * compte ; pas le cas en V1 brouillon.
 */
export default function TermsPage() {
  useDocumentTitle("Conditions générales d'utilisation");

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

        <header className="mb-10">
          <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">
            Légal
          </p>
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            Conditions générales d'utilisation
          </h1>
        </header>

        <article className="animate-fade-up">
          <MarkdownTier source={source} />
        </article>
      </div>
    </div>
  );
}
