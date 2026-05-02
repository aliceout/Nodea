import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { apiErrorMessage, apiRequestPasswordReset } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

import Warning from './Warning';

/**
 * Destructive password-reset form (REFACTO-12 + REFACTO-06 split).
 *
 * Reached when the user clicks « j'ai pas de code » on the fork.
 * Email-only input with the data-loss warning framed first.
 *
 * Migrated to React Hook Form + Zod resolver to align with
 * CLAUDE.md § Forms : every multi-field form uses RHF, every form
 * with non-trivial validation routes through Zod. The schema
 * lives inline because there's no shared shape on the server side
 * — `apiRequestPasswordReset` accepts a free email + the server
 * always returns 200 (anti-enum).
 */
const DestroyFormSchema = z.object({
  email: z.string().min(1).email(),
});
type DestroyFormValues = z.infer<typeof DestroyFormSchema>;

export default function DestroyForm({
  onSent,
  onBack,
}: {
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DestroyFormValues>({
    resolver: zodResolver(DestroyFormSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: DestroyFormValues): Promise<void> {
    setServerError(null);
    const email = values.email.trim().toLowerCase();
    try {
      await apiRequestPasswordReset({ email });
      onSent(email);
    } catch (err) {
      setServerError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('request-reset failed', err);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Réinitialisation"
        title="Réinitialiser sans code"
        subtitle={
          <>
            Indique ton email — on t’enverra un lien pour définir un nouveau mot
            de passe.
          </>
        }
      />

      {/* Hard data-loss warning — the user chose the destructive
          path on the fork, but we still want the consequence
          framed before the form. */}
      <Warning title="Tes données seront effacées">
        Le chiffrement n’est pas réversible sans ton mot de passe d’origine.
      </Warning>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5">
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        {serverError ? (
          <InlineAlert className="mb-3">{serverError}</InlineAlert>
        ) : null}

        <Button
          type="submit"
          variant="danger-outline"
          size="lg"
          disabled={isSubmitting}
          className="mt-2 w-full"
        >
          {isSubmitting ? 'Envoi…' : 'M’envoyer le lien'}
        </Button>

        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Retour
          </button>
        </div>
      </form>
    </>
  );
}
