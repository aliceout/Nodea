import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import {
  apiResetPasswordFinish,
  apiResetPasswordStart,
  isApiError,
} from '@/core/api/client';
import { randomBytes } from '@/core/crypto/base64';
import {
  buildKekAAD,
  buildMainKeyAAD,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '@/core/crypto/factor-wrap';
import {
  clientRegisterFinish,
  clientRegisterStart,
  opaqueReady,
} from '@/core/auth/opaque';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthLayout from '@/ui/dirk/AuthLayout';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Consume a reset token — Direction K · Sauge.
 *
 * We generate a fresh main key client-side (32 random bytes), wrap it
 * under the user's new password (argon2id → AES-GCM), and ship the
 * envelope alongside the token + new password. The server purges all
 * old encrypted data in a single transaction before rotating the
 * credentials.
 *
 * A confirmation checkbox forces the user to acknowledge the data loss
 * before the destructive request goes out. The main key bytes are
 * zeroed in memory as soon as the wrap is done.
 *
 * Two-column shell mirrors Login / Register / RequestReset so the
 * auth surface stays one continuous design language. The marketing
 * panel here keeps a recovery-specific body — the standard
 * `<PrivacyBody />` would feel oddly upbeat next to a destructive
 * action.
 */
export default function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    token.length > 0 &&
    password.length >= 12 &&
    passwordsMatch &&
    acknowledged &&
    (strength?.score ?? 0) >= 3 &&
    !submitting;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    const kek = randomBytes(32);
    const rawMainKey = randomBytes(32);
    try {
      await opaqueReady;

      // Step 1: OPAQUE register start with the new password.
      const reg = clientRegisterStart(password);
      const start = await apiResetPasswordStart({
        token,
        registrationRequest: reg.registrationRequest,
      });

      // Step 2: finish OPAQUE registration locally to derive the
      // exportKey we'll wrap the KEK under.
      const finished = clientRegisterFinish({
        password,
        clientRegistrationState: reg.clientRegistrationState,
        registrationResponse: start.registrationResponse,
      });

      // Step 3: wrap the random main key under the random KEK, then
      // wrap the KEK under an HKDF sub-key of `exportKey`. AAD binds
      // both blobs to the user id the server returned at /start.
      const mainKeyWrap = await wrapMainKeyUnderKek(
        rawMainKey,
        kek,
        buildMainKeyAAD(start.userId),
      );
      const kekWrap = await wrapKekUnderFactor(
        kek,
        finished.exportKey,
        buildKekAAD(start.userId, 'password'),
      );

      // Step 4: ship everything to /reset/finish — server purges old
      // data, replaces every credential blob, marks the reset token
      // used.
      await apiResetPasswordFinish({
        resetToken: start.resetToken,
        registrationRecord: finished.registrationRecord,
        wrappedMainKey: mainKeyWrap.wrappedMainKey,
        wrappedMainKeyIv: mainKeyWrap.wrappedMainKeyIv,
        wrappedKekPassword: kekWrap.wrappedKek,
        wrappedKekPasswordIv: kekWrap.wrappedKekIv,
      });
      setDone(true);
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        if (err.error === 'invalid_token') {
          setError('Ce lien est invalide ou a expiré. Redemande un email de réinitialisation.');
        } else {
          setError('Requête refusée.');
        }
      } else if (isApiError(err) && err.status === 429) {
        setError('Trop de tentatives récentes. Réessaie plus tard.');
      } else {
        setError('Une erreur est survenue. Réessaie plus tard.');
        if (import.meta.env.DEV) console.warn('reset failed', err);
      }
    } finally {
      kek.fill(0);
      rawMainKey.fill(0);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline="Repars sur de bonnes bases."
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le mot de passe est aussi la clé qui chiffre tes entrées. Le réinitialiser
            remet ton compte à zéro — toutes les données existantes sont supprimées.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            C’est volontaire : sans la clé, personne ne peut récupérer le contenu —
            y compris l’équipe de Nodea.
          </p>
        </>
      }
    >
      {!token ? (
        <InvalidLinkPanel />
      ) : done ? (
        <DonePanel />
      ) : (
        <ResetForm
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          passwordsMatch={passwordsMatch}
          strength={strength}
          acknowledged={acknowledged}
          setAcknowledged={setAcknowledged}
          error={error}
          submitting={submitting}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />
      )}
    </AuthLayout>
  );
}

function InvalidLinkPanel() {
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Lien invalide</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Ce lien est incomplet.
      </h2>
      <p className="mb-6 text-[14px] text-ink-soft">
        Redemande un email depuis la page « mot de passe oublié ».
      </p>
      <Link
        to="/request-reset"
        className="inline-block rounded-md bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Redemander un lien
      </Link>
    </>
  );
}

function DonePanel() {
  return (
    <>
      <div
        aria-hidden="true"
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white"
      >
        ✓
      </div>
      <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Mot de passe réinitialisé.
      </h2>
      <p className="mb-6 text-[14px] text-ink-soft">
        Tu peux te reconnecter avec ton nouveau mot de passe. Le compte a été remis à
        zéro — les entrées précédentes ont été supprimées.
      </p>
      <Link
        to="/login"
        className="inline-block rounded-md bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Se connecter
      </Link>
    </>
  );
}

interface ResetFormProps {
  password: string;
  setPassword: (next: string) => void;
  confirm: string;
  setConfirm: (next: string) => void;
  passwordsMatch: boolean;
  strength: { score: number; warning: string | null } | null;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

function ResetForm(props: ResetFormProps) {
  const {
    password,
    setPassword,
    confirm,
    setConfirm,
    passwordsMatch,
    strength,
    acknowledged,
    setAcknowledged,
    error,
    submitting,
    canSubmit,
    onSubmit,
  } = props;

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Réinitialisation</p>
      <h2 className="mb-5 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Choisis un nouveau mot de passe.
      </h2>

      {/* The destructive warning lives here in the form column rather
          than as a body line in the marketing panel — it's
          actionable, the user needs to read it right before clicking
          submit. K · Sauge danger tone (border-l, danger/5 wash). */}
      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">Perte définitive de données</p>
        <p className="mt-1 text-ink-soft">
          La clé qui chiffre tes entrées dérive du mot de passe. Comme l’ancienne clé
          a été perdue avec l’ancien mot de passe, toutes tes entrées existantes
          seront supprimées au moment de la validation.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nouveau mot de passe (≥ 12 caractères)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
          legend={
            strength ? (
              <span
                className={cn(
                  strength.score >= 3 ? 'text-accent-deep' : 'text-muted',
                )}
              >
                Force : {strength.score} / 4
                {strength.warning ? ` — ${strength.warning}` : ''}
              </span>
            ) : undefined
          }
        />
        <Field
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          error={
            confirm && !passwordsMatch
              ? 'Les deux mots de passe ne correspondent pas.'
              : undefined
          }
        />

        <label className="mb-3.5 flex items-start gap-2 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
          />
          <span>
            Je comprends que toutes mes données existantes seront supprimées lors de
            cette réinitialisation.
          </span>
        </label>

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="danger-outline"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting ? 'Réinitialisation…' : 'Réinitialiser et effacer mes données'}
        </Button>

        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            ← Annuler
          </Link>
        </div>
      </form>
    </>
  );
}

