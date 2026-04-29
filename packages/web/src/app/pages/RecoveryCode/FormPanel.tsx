import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';

interface FormPanelProps {
  isRegenerate: boolean;
  password: string;
  setPassword: (next: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Password-prompt panel for the recovery-code KEK setup. Two
 * almost-identical surfaces : « Configurer un code » when the
 * user hasn't set one yet, « Régénérer le code » when they have.
 * Differs only in eyebrow / heading / submit label / subtitle —
 * everything else (the password field, the « ← Retour » link,
 * the submit gating) stays the same.
 */
export default function FormPanel({
  isRegenerate,
  password,
  setPassword,
  error,
  submitting,
  onSubmit,
}: FormPanelProps) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Sécurité"
        title={
          isRegenerate
            ? 'Régénérer le code de récupération'
            : 'Configurer un code de récupération'
        }
        subtitle={
          isRegenerate
            ? 'Génère un nouveau code de 12 mots. L’ancien sera invalidé immédiatement — assure-toi de pouvoir noter le nouveau avant de continuer.'
            : 'On va générer 12 mots à noter. Tape ton mot de passe pour autoriser la génération.'
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || !password}
          className="mt-2 w-full"
        >
          {submitting ? 'Génération…' : isRegenerate ? 'Régénérer' : 'Générer mes 12 mots'}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link
            to="/flow"
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Retour
          </Link>
        </div>
      </form>
    </>
  );
}
