/**
 * Key hierarchy diagram — Direction K · Sauge.
 *
 * Inline SVG illustrating the 3-layer key chain described in
 * `docs/Auth-Spec.md §3.2`: three factor sources (Password
 * OPAQUE, Passkey PRF, Recovery code) each derive a wrapping key
 * via HKDF, all three of which can decrypt the same KEK ; the
 * KEK in turn unwraps the main key, which derives the AES + HMAC
 * sub-keys for record encryption / integrity.
 *
 * Hand-coded rather than Mermaid so the visual matches the docs
 * design system exactly (`fill-bg-2`, `stroke-hair`,
 * `stroke-accent` for highlighted nodes) without a 150 KB
 * gzipped runtime dep.
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
        y={sub ? cy - 5 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className={
          highlight
            ? 'fill-ink text-[13px] font-semibold'
            : 'fill-ink text-[12px] font-medium'
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
          className="fill-muted text-[10px]"
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

export default function KeyHierarchyDiagram() {
  // Three columns of factor sources, converging on a single KEK
  // in the middle. The convergence is drawn as two L-shaped paths
  // from the outer columns + a straight drop from the centre
  // column. A single arrowhead lands on the KEK so readers see
  // "all three paths feed the same key".
  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 720 540"
        role="img"
        aria-label="Hiérarchie des clés Nodea : Password OPAQUE, Passkey PRF et code de récupération dérivent chacun une wrapping key (HKDF). Chaque wrapping key déchiffre la même KEK. La KEK déchiffre la main key, qui dérive aes_main et hmac_main."
        className="mx-auto block w-full max-w-[720px] text-ink"
      >
        <defs>
          <marker
            id="kh-arrow"
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

        {/* Row 1 — three factor sources */}
        <Node x={20} y={20} width={200} height={50} label="Password OPAQUE" sub="export_key" />
        <Node x={260} y={20} width={200} height={50} label="Passkey PRF" sub="prf_output (par credential)" />
        <Node x={500} y={20} width={200} height={50} label="Code de récupération" sub="HKDF(BIP39 entropy)" />

        {/* HKDF arrows down to wrapping keys */}
        <line x1={120} y1={70} x2={120} y2={108} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <line x1={360} y1={70} x2={360} y2={108} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <line x1={600} y1={70} x2={600} y2={108} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <Label x={120} y={89} text='HKDF "nodea:wrap-kek"' />
        <Label x={360} y={89} text='HKDF "nodea:wrap-kek"' />
        <Label x={600} y={89} text='HKDF "nodea:wrap-kek"' />

        {/* Row 2 — wrapping keys */}
        <Node x={20} y={108} width={200} height={50} label="wk_password" />
        <Node x={260} y={108} width={200} height={50} label="wk_passkey_<credId>" />
        <Node x={500} y={108} width={200} height={50} label="wk_recovery" />

        {/* AES-GCM-decrypt — three paths converging on the KEK.
            Centre column drops straight down; outer columns turn
            inward on a horizontal rail, then the merged line
            drops down to the KEK box with a single arrowhead. */}
        <line x1={120} y1={158} x2={120} y2={210} className="stroke-hair" strokeWidth={1} />
        <line x1={120} y1={210} x2={360} y2={210} className="stroke-hair" strokeWidth={1} />
        <line x1={600} y1={158} x2={600} y2={210} className="stroke-hair" strokeWidth={1} />
        <line x1={600} y1={210} x2={360} y2={210} className="stroke-hair" strokeWidth={1} />
        <line x1={360} y1={158} x2={360} y2={228} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <Label x={360} y={189} text="AES-GCM-decrypt" />

        {/* Row 3 — KEK (highlighted) */}
        <Node x={290} y={228} width={140} height={48} label="KEK" sub="32 bytes" highlight />

        {/* HKDF + AES-decrypt arrow to main_key */}
        <line x1={360} y1={276} x2={360} y2={324} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <Label x={360} y={300} text="HKDF + AES-GCM-decrypt(wrapped_main_key)" />

        {/* Row 4 — main_key (highlighted) */}
        <Node x={260} y={324} width={200} height={48} label="main_key" sub="32 bytes" highlight />

        {/* Diverging HKDF arrows */}
        <line x1={310} y1={372} x2={310} y2={400} className="stroke-hair" strokeWidth={1} />
        <line x1={310} y1={400} x2={150} y2={400} className="stroke-hair" strokeWidth={1} />
        <line x1={150} y1={400} x2={150} y2={448} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <line x1={410} y1={372} x2={410} y2={400} className="stroke-hair" strokeWidth={1} />
        <line x1={410} y1={400} x2={570} y2={400} className="stroke-hair" strokeWidth={1} />
        <line x1={570} y1={400} x2={570} y2={448} className="stroke-hair" strokeWidth={1} markerEnd="url(#kh-arrow)" />
        <Label x={150} y={417} text='HKDF "nodea:aes"' />
        <Label x={570} y={417} text='HKDF "nodea:hmac"' />

        {/* Row 5 — sub-keys for record crypto */}
        <Node x={50} y={448} width={200} height={50} label="aes_main_key" sub="chiffrement entrées" />
        <Node x={470} y={448} width={200} height={50} label="hmac_main_key" sub="guards d'intégrité" />
      </svg>
    </figure>
  );
}
