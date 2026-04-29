/**
 * MFA bypass timeline — Direction K · Sauge.
 *
 * Horizontal timeline showing the 4 main states of a bypass
 * request and the cancel branch off the 7-day delay window :
 * `request → confirmé → applicable → consommé`, with `cancelled`
 * branching off any time during the 7-day delay if the user
 * logs in normally with the still-active factor.
 *
 * Mirrors `docs/Auth-Spec.md §7.8`. The visual emphasises the
 * 7-day delay segment (where the cancel branch can fire) since
 * that's the security-relevant part of the design.
 */

interface NodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  sub?: string;
  highlight?: boolean;
}

function Node({ x, y, width, height, label, sub, highlight = false }: NodeProps) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        className={
          highlight
            ? 'fill-bg stroke-accent'
            : 'fill-bg-2 stroke-hair'
        }
        strokeWidth={highlight ? 1.5 : 1}
      />
      <text
        x={cx}
        y={sub ? cy - 6 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className={
          highlight
            ? 'fill-ink text-[12.5px] font-semibold'
            : 'fill-ink text-[12px] font-medium'
        }
      >
        {label}
      </text>
      {sub ? (
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted text-[10px]"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Label({
  x,
  y,
  text,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      className="fill-muted text-[10.5px]"
    >
      {text}
    </text>
  );
}

export default function MfaBypassDiagram() {
  // 4 horizontal nodes for the main flow + 1 below the 2nd node
  // for the cancel branch. Heights tuned so the cancel arrow has
  // room to breathe.
  const yMain = 110;
  const hMain = 64;

  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 720 380"
        role="img"
        aria-label="Timeline du bypass MFA Nodea : la requête est créée en mfa_pending, le user clique sur le lien email pour la confirmer, un délai de 7 jours s'écoule, puis le prochain login normal consomme le bypass et désactive le facteur perdu. Pendant les 7 jours, n'importe quel login full annule la requête (defang anti-phishing)."
        className="mx-auto block w-full max-w-[720px] text-ink"
      >
        <defs>
          <marker
            id="bypass-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-hair" />
          </marker>
          <marker
            id="bypass-arrow-danger"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted" />
          </marker>
        </defs>

        {/* Title baseline */}
        <text
          x={20}
          y={30}
          className="fill-muted text-[11px] uppercase tracking-[0.08em]"
        >
          Timeline d'un bypass MFA
        </text>

        {/* 1 — Request (en mfa_pending) */}
        <Node
          x={20}
          y={yMain}
          width={150}
          height={hMain}
          label="Demande"
          sub="POST /mfa-bypass/request"
        />

        {/* Arrow 1→2 */}
        <line
          x1={170}
          y1={yMain + hMain / 2}
          x2={210}
          y2={yMain + hMain / 2}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#bypass-arrow)"
        />
        <Label
          x={190}
          y={yMain + hMain / 2 - 16}
          text="email envoyé"
        />

        {/* 2 — Confirmé (clic sur email) */}
        <Node
          x={210}
          y={yMain}
          width={150}
          height={hMain}
          label="Confirmé"
          sub="confirmed_at = now"
        />

        {/* Arrow 2→3 — long, with "délai 7 jours" highlighted */}
        <line
          x1={360}
          y1={yMain + hMain / 2}
          x2={400}
          y2={yMain + hMain / 2}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#bypass-arrow)"
        />
        <Label
          x={380}
          y={yMain + hMain / 2 - 16}
          text="délai 7 jours"
        />

        {/* 3 — Applicable */}
        <Node
          x={400}
          y={yMain}
          width={150}
          height={hMain}
          label="Applicable"
          sub="t ≥ earliest_apply_at"
        />

        {/* Arrow 3→4 */}
        <line
          x1={550}
          y1={yMain + hMain / 2}
          x2={590}
          y2={yMain + hMain / 2}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#bypass-arrow)"
        />
        <Label
          x={570}
          y={yMain + hMain / 2 - 16}
          text="next login"
        />

        {/* 4 — Consommé (terminal, highlight) */}
        <Node
          x={590}
          y={yMain}
          width={120}
          height={hMain}
          label="Consommé"
          sub="facteur supprimé"
          highlight
        />

        {/* Cancel branch — drops down from the "Confirmé" box,
            sweeps right under the timeline, terminates at a
            cancelled node */}
        <line
          x1={285}
          y1={yMain + hMain}
          x2={285}
          y2={235}
          className="stroke-hair"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <line
          x1={285}
          y1={235}
          x2={400}
          y2={235}
          className="stroke-hair"
          strokeWidth={1}
          strokeDasharray="3 3"
          markerEnd="url(#bypass-arrow-danger)"
        />
        <Label
          x={343}
          y={222}
          text="tout login full pendant le délai → cancelled_at = now"
        />

        {/* Cancelled terminal */}
        <Node
          x={400}
          y={210}
          width={150}
          height={50}
          label="Annulé"
          sub="cancelPendingBypassesForUser"
        />

        {/* Footer note */}
        <text
          x={360}
          y={325}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          Pas de lien « cancel » dans l'email — un login normal annule la requête,
          ce qui évite d'exposer un bouton de désamorçage à un phisher.
        </text>
        <text
          x={360}
          y={343}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          Eligibility (§6.2) : en mode `maximum`, l'autre facteur doit être prouvé
          dans la session pending avant que /request soit accepté.
        </text>
      </svg>
    </figure>
  );
}
