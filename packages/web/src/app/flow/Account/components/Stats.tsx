import { cn } from '@/lib/utils';

interface StatRowProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}

function StatRow({ label, value, mono, accent }: StatRowProps) {
  return (
    <div className="flex items-center justify-between border-t border-hair py-2.5">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span
        className={cn(
          'text-[13px] font-semibold',
          mono ? 'tabular-nums' : '',
          accent ? 'animate-streak-pulse text-accent' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** « En chiffres » sidebar block on the Identity tab. The values
 *  are still mocked while the matching back-end queries aren't
 *  wired through — once they are, this becomes a real-data block
 *  that pulls from the auth + module-config slices. */
export default function Stats() {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
        En chiffres
      </div>
      <StatRow label="Entrées chiffrées" value="428" mono />
      <StatRow label="Série habits" value="12 j" mono accent />
      <StatRow label="Membre depuis" value="mars 2024" />
    </div>
  );
}
