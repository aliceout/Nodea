import { Link } from 'react-router-dom';

/** Confirmation screen after a successful reset. The server has
 *  purged the old encrypted data, the new credentials are in
 *  place, the only path forward is `/login` with the new
 *  password — no auto-login from this surface (the local
 *  session was never authenticated to begin with, the user
 *  arrived at `/reset` from an email link). */
export default function DonePanel() {
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
