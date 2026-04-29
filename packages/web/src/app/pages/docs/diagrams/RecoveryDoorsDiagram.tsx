/**
 * Recovery code metaphor — Direction K · Sauge.
 *
 * Pedagogical visual: the password and the 12-word recovery
 * code each unwrap a separate envelope, but both envelopes
 * contain a copy of the *same* KEK. Reset via recovery rotates
 * the envelope around the key — never the key itself, so the
 * data stays readable.
 *
 * Companion to "Code de récupération : la deuxième porte" in
 * `advanced.md`. Avoids HKDF / wrapping-key jargon — see
 * `KeyHierarchyDiagram` for the technical version.
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
          highlight ? 'fill-bg stroke-accent' : 'fill-bg-2 stroke-hair'
        }
        strokeWidth={highlight ? 1.5 : 1}
      />
      <text
        x={cx}
        y={sub ? cy - 8 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className={
          highlight
            ? 'fill-ink text-[13px] font-semibold'
            : 'fill-ink text-[12.5px] font-medium'
        }
      >
        {label}
      </text>
      {sub ? (
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted text-[11px]"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Label({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="fill-muted text-[10.5px]"
    >
      {text}
    </text>
  );
}

export default function RecoveryDoorsDiagram() {
  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 760 580"
        role="img"
        aria-label="Deux portes, un seul coffre : ton mot de passe et ton code de récupération à 12 mots déverrouillent chacun une enveloppe différente, mais les deux enveloppes contiennent une copie de la même clé de coffre, qui déchiffre la même main key, qui déchiffre les mêmes données."
        className="mx-auto block w-full max-w-[760px] text-ink"
      >
        <defs>
          <marker
            id="rd-arrow"
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
          x={380}
          y={28}
          textAnchor="middle"
          className="fill-muted text-[11px] uppercase tracking-[0.08em]"
        >
          Deux portes, un seul coffre
        </text>

        {/* Factor row */}
        <Node
          x={80}
          y={70}
          width={200}
          height={56}
          label="Mot de passe"
          sub="login normal"
        />
        <Node
          x={480}
          y={70}
          width={200}
          height={56}
          label="Code 12 mots"
          sub="récupération"
        />

        {/* Arrows down to envelopes */}
        <line
          x1={180}
          y1={126}
          x2={180}
          y2={178}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#rd-arrow)"
        />
        <line
          x1={580}
          y1={126}
          x2={580}
          y2={178}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#rd-arrow)"
        />
        <Label x={180} y={150} text="déverrouille" />
        <Label x={580} y={150} text="déverrouille" />

        {/* Envelope row */}
        <Node
          x={60}
          y={180}
          width={240}
          height={70}
          label="Enveloppe chiffrée"
          sub="scellée par ton mot de passe"
        />
        <Node
          x={460}
          y={180}
          width={240}
          height={70}
          label="Enveloppe chiffrée"
          sub="scellée par tes 12 mots"
        />

        {/* Convergence into the shared key */}
        <line
          x1={180}
          y1={250}
          x2={180}
          y2={310}
          className="stroke-hair"
          strokeWidth={1}
        />
        <line
          x1={180}
          y1={310}
          x2={380}
          y2={310}
          className="stroke-hair"
          strokeWidth={1}
        />
        <line
          x1={580}
          y1={250}
          x2={580}
          y2={310}
          className="stroke-hair"
          strokeWidth={1}
        />
        <line
          x1={580}
          y1={310}
          x2={380}
          y2={310}
          className="stroke-hair"
          strokeWidth={1}
        />
        <line
          x1={380}
          y1={310}
          x2={380}
          y2={350}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#rd-arrow)"
        />
        <Label
          x={380}
          y={284}
          text="chacune contient une copie de la même clé"
        />

        {/* The shared key (KEK) */}
        <Node
          x={290}
          y={352}
          width={180}
          height={62}
          label="Clé du coffre"
          sub="la même clé"
          highlight
        />

        {/* Key → data */}
        <line
          x1={380}
          y1={414}
          x2={380}
          y2={452}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#rd-arrow)"
        />
        <Label x={380} y={433} text="déchiffre" />

        {/* Data */}
        <Node
          x={240}
          y={454}
          width={280}
          height={56}
          label="Tes données"
          sub="entrées chiffrées AES-GCM"
        />

        {/* Footer note */}
        <text
          x={380}
          y={552}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          Reset via recovery → on rotate les enveloppes ; la clé du coffre, elle, ne change pas → tes données restent lisibles.
        </text>
      </svg>
    </figure>
  );
}
