/**
 * Browser vs server view — Direction K · Sauge.
 *
 * Pedagogical contrast: side-by-side panels showing what the
 * navigator sees (clear text, master key in memory) and what
 * the server sees (opaque blobs, no user link). Mirrors the
 * "Ce que voit ton navigateur, ce que voit le serveur" section
 * in `advanced.md`.
 *
 * The asymmetry between the two columns is the message — the
 * server side mixes ✓ items (blob, guard, sid) with ✗ items
 * (no user_id, no timestamps, no key) that advertise what the
 * design *deliberately* withholds.
 */

interface PanelItem {
  ok: boolean;
  text: string;
}

interface PanelProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  items: ReadonlyArray<PanelItem>;
  emphasize?: boolean;
}

function Panel({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  items,
  emphasize = false,
}: PanelProps) {
  const padding = 24;
  const titleY = y + 38;
  const subtitleY = y + 60;
  const firstItemY = y + 104;
  const itemHeight = 30;
  const cx = x + width / 2;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        className={
          emphasize ? 'fill-bg stroke-accent' : 'fill-bg-2 stroke-hair'
        }
        strokeWidth={emphasize ? 1.5 : 1}
      />
      <text
        x={cx}
        y={titleY}
        textAnchor="middle"
        className="fill-ink text-[13px] font-semibold"
      >
        {title}
      </text>
      <text
        x={cx}
        y={subtitleY}
        textAnchor="middle"
        className="fill-muted text-[11px]"
      >
        {subtitle}
      </text>
      {items.map((it, i) => {
        const itemY = firstItemY + i * itemHeight;
        return (
          <g key={i}>
            <text
              x={x + padding}
              y={itemY}
              dominantBaseline="middle"
              className={
                it.ok
                  ? 'fill-accent text-[13px] font-semibold'
                  : 'fill-muted text-[13px] font-semibold'
              }
            >
              {it.ok ? '✓' : '✗'}
            </text>
            <text
              x={x + padding + 22}
              y={itemY}
              dominantBaseline="middle"
              className={
                it.ok ? 'fill-ink text-[12px]' : 'fill-muted text-[12px]'
              }
            >
              {it.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function BrowserVsServerDiagram() {
  const browserItems: ReadonlyArray<PanelItem> = [
    { ok: true, text: 'clé maîtresse en mémoire' },
    { ok: true, text: 'tes entrées en clair' },
    { ok: true, text: 'édition, lecture' },
    { ok: true, text: 'chiffrement avant envoi' },
  ];

  const serverItems: ReadonlyArray<PanelItem> = [
    { ok: true, text: 'blob chiffré AES-GCM' },
    { ok: true, text: 'guard HMAC (intégrité)' },
    { ok: true, text: 'sid opaque' },
    { ok: false, text: 'pas de user_id sur les entrées' },
    { ok: false, text: 'pas de timestamps colonnes' },
    { ok: false, text: 'jamais la clé maîtresse' },
  ];

  const panelY = 70;
  const panelHeight = 300;
  const arrowY = panelY + panelHeight / 2;

  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 800 440"
        role="img"
        aria-label="Côté navigateur vs côté serveur : le navigateur voit la clé maîtresse, les entrées en clair et peut éditer ; le serveur ne voit que des blobs AES-GCM, le guard HMAC et un sid opaque, sans user_id ni timestamps ni la clé."
        className="mx-auto block w-full max-w-[800px] text-ink"
      >
        <defs>
          <marker
            id="bvs-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-hair" />
          </marker>
        </defs>

        <text
          x={400}
          y={28}
          textAnchor="middle"
          className="fill-muted text-[11px] uppercase tracking-[0.08em]"
        >
          Le même contenu, deux vues
        </text>

        <Panel
          x={30}
          y={panelY}
          width={340}
          height={panelHeight}
          title="Navigateur (toi)"
          subtitle="ce que tu vois et manipules"
          items={browserItems}
          emphasize
        />

        <Panel
          x={430}
          y={panelY}
          width={340}
          height={panelHeight}
          title="Serveur Nodea"
          subtitle="ce qu'on lit en SQL direct"
          items={serverItems}
        />

        {/* Connecting arrow between the two panels */}
        <line
          x1={370}
          y1={arrowY}
          x2={430}
          y2={arrowY}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#bvs-arrow)"
        />
        <text
          x={400}
          y={arrowY - 12}
          textAnchor="middle"
          className="fill-muted text-[10.5px]"
        >
          chiffrement
        </text>
        <text
          x={400}
          y={arrowY + 18}
          textAnchor="middle"
          className="fill-muted text-[10.5px]"
        >
          AES-GCM
        </text>

        {/* Footer note */}
        <text
          x={400}
          y={410}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          Tout ce que le serveur stocke est inutile sans la clé maîtresse — qui ne quitte jamais ton navigateur.
        </text>
      </svg>
    </figure>
  );
}
