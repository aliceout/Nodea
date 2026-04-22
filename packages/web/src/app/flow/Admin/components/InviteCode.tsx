import Button from '@/ui/atoms/base/Button';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard';
import type { AdminInviteRow } from '@/core/api/client';

/** A minted invite kept in component state after creation; the `code`
 *  field is only known client-side at mint time (the server only stores
 *  the hash). */
export interface MintedInvite extends AdminInviteRow {
  code: string;
}

export interface InviteCodeManagerProps {
  /** Fresh codes minted during this session (clear code still visible). */
  mintedCodes: MintedInvite[];
  /** Server-known invites (no clear code, only metadata). */
  unusedInvites: AdminInviteRow[];
  generating: boolean;
  copySuccess: string | null;
  onGenerate(): void;
  onCopy(code: string): void;
  onDelete(id: string): void;
}

export default function InviteCodeManager({
  mintedCodes,
  unusedInvites,
  generating,
  copySuccess,
  onGenerate,
  onCopy,
  onDelete,
}: InviteCodeManagerProps) {
  return (
    <SurfaceCard className="border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-start gap-3">
          <Button onClick={onGenerate} variant="info" disabled={generating}>
            {generating ? 'Génération…' : 'Générer un code'}
          </Button>
        </div>
        {copySuccess ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-300">{copySuccess}</span>
        ) : null}
      </div>

      {mintedCodes.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
            Codes générés pendant cette session (à copier maintenant, perdus au rafraîchissement) :
          </div>
          <ul className="flex flex-wrap gap-3">
            {mintedCodes.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-1.5 rounded border border-gray-200 bg-gray-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60"
              >
                <button
                  type="button"
                  onClick={() => onCopy(c.code)}
                  title="Copier le code"
                  className="rounded px-1 py-1 hover:bg-sky-100 focus:outline-none dark:hover:bg-slate-700/80"
                >
                  📋
                </button>
                <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{c.code}</span>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  title="Supprimer ce code"
                  className="rounded px-1 py-1 text-red-600 hover:bg-red-100 focus:outline-none dark:hover:bg-red-500/20"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unusedInvites.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
            Invitations en attente côté serveur :
          </div>
          <ul className="text-xs text-slate-600 dark:text-slate-300">
            {unusedInvites.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-1">
                <span className="font-mono">{i.id.slice(0, 8)}…</span>
                <span>créée {new Date(i.createdAt).toLocaleString()}</span>
                {i.expiresAt ? (
                  <span>· expire {new Date(i.expiresAt).toLocaleString()}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(i.id)}
                  title="Supprimer cette invitation"
                  className="ml-2 rounded px-1 py-0.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
