import { useState } from 'react';

import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/AuthLayout';

import DestroyForm from './DestroyForm';
import ForkPanel from './ForkPanel';
import SentPanel from './SentPanel';

/**
 * Request-reset — Direction K · Sauge.
 *
 * Three-stage page :
 *
 *   1. **Fork** — entry point from `/login`'s « mot de passe oublié »
 *      link. Two big choices : « j'ai un code de récupération » vs
 *      « j'ai pas de code ». Most users with a code shouldn't even
 *      see the destructive form ; the fork keeps the colourful
 *      destructive warning out of the default layout.
 *   2. **Destroy** — the email-input form, reached when the user
 *      clicks « j'ai pas de code ». This is where the data-loss
 *      warning lives.
 *   3. **Sent** — confirmation view after a successful POST.
 *
 * The server always returns 200 to avoid enumeration (see the
 * `request-reset` handler), so the success view is identical
 * whether or not the email is in the database.
 *
 * Split (REFACTO-12 + REFACTO-06) : each stage is its own file
 * (`ForkPanel`, `DestroyForm`, `SentPanel`) ; this index just
 * orchestrates the stage state machine + the AuthLayout wrap. The
 * `DestroyForm` was migrated to React Hook Form + Zod resolver as
 * part of REFACTO-06.
 */
type Stage =
  | { kind: 'fork' }
  | { kind: 'destroy' }
  | { kind: 'sent'; email: string };

export default function RequestResetPage() {
  useDocumentTitle('Demander une réinitialisation');
  const [stage, setStage] = useState<Stage>({ kind: 'fork' });

  return (
    <AuthLayout
      headline="Récupère l’accès."
      marketing={
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le mot de passe est aussi la clé qui chiffre tes entrées. Le
          réinitialiser efface les données existantes.
        </p>
      }
    >
      {stage.kind === 'fork' ? (
        <ForkPanel onNoCode={() => setStage({ kind: 'destroy' })} />
      ) : null}
      {stage.kind === 'destroy' ? (
        <DestroyForm
          onSent={(email) => setStage({ kind: 'sent', email })}
          onBack={() => setStage({ kind: 'fork' })}
        />
      ) : null}
      {stage.kind === 'sent' ? <SentPanel email={stage.email} /> : null}
    </AuthLayout>
  );
}
