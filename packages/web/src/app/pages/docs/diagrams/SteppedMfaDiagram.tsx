/**
 * Stepped MFA state machine — Direction K · Sauge.
 *
 * Vertical state diagram of the session lifecycle through MFA :
 * `POST /auth/login/finish` either emits a `full` session
 * directly (mode `password_or_passkey`) or an `mfa_pending`
 * session (modes `always_2fa` / `maximum`) that the client
 * must finalize via factor-verify routes before getting a
 * `full` session.
 *
 * Mirrors `docs/auth/Login.md` (stepped MFA finalisation). Hand-coded SVG so the visual
 * fits the K · Sauge tokens (`fill-bg-2`, `stroke-hair`,
 * `stroke-accent` for terminal `full` states).
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
            ? 'fill-ink text-[13px] font-semibold'
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

export default function SteppedMfaDiagram() {
  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 720 580"
        role="img"
        aria-label="Machine d'états du login Nodea : selon le mode de sécurité, le serveur émet directement une session 'full' (mode password_or_passkey) ou une session 'mfa_pending' (modes always_2fa / maximum). Dans le second cas, le client doit valider les facteurs additionnels (TOTP, passkey) via /auth/mfa/* avant que le serveur ne promote la session pending en full atomiquement."
        className="mx-auto block w-full max-w-[720px] text-ink"
      >
        <defs>
          <marker
            id="smfa-arrow"
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

        {/* Entry — login finish */}
        <Node
          x={240}
          y={20}
          width={240}
          height={56}
          label="POST /auth/login/finish"
          sub="OPAQUE password OU passkey assertion"
        />

        {/* Arrow down to decision */}
        <line
          x1={360}
          y1={76}
          x2={360}
          y2={114}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#smfa-arrow)"
        />
        <Label x={420} y={95} text='users.security_mode = ?' anchor="start" />

        {/* Decision diamond rendered as a labeled point */}
        <Node x={290} y={114} width={140} height={42} label="security_mode" />

        {/* Two branches : left (direct) + right (pending) */}
        <line
          x1={360}
          y1={156}
          x2={360}
          y2={185}
          className="stroke-hair"
          strokeWidth={1}
        />
        <line
          x1={150}
          y1={185}
          x2={570}
          y2={185}
          className="stroke-hair"
          strokeWidth={1}
        />

        {/* Left branch label */}
        <Label x={150} y={205} text="password_or_passkey" />
        <line
          x1={150}
          y1={185}
          x2={150}
          y2={222}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#smfa-arrow)"
        />

        {/* Left terminal — direct full */}
        <Node
          x={50}
          y={222}
          width={200}
          height={70}
          label="Session 'full'"
          sub="cookie nodea_session émis · TTL 7j"
          highlight
        />

        {/* Right branch label */}
        <Label x={570} y={205} text="always_2fa / maximum" />
        <line
          x1={570}
          y1={185}
          x2={570}
          y2={222}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#smfa-arrow)"
        />

        {/* Right intermediate — mfa_pending */}
        <Node
          x={460}
          y={222}
          width={220}
          height={80}
          label="Session 'mfa_pending'"
          sub="TTL 5min · flag du facteur primaire ✓"
        />

        {/* Down arrow with verify routes label */}
        <line
          x1={570}
          y1={302}
          x2={570}
          y2={340}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#smfa-arrow)"
        />
        <Label
          x={570}
          y={321}
          text="POST /auth/mfa/totp · /auth/mfa/passkey"
        />

        {/* Pending after factor verifies — flags ticked */}
        <Node
          x={460}
          y={340}
          width={220}
          height={70}
          label="Pending : tous les flags requis ✓"
          sub="mfa_password / passkey / totp _verified"
        />

        {/* Down arrow to atomic finalize */}
        <line
          x1={570}
          y1={410}
          x2={570}
          y2={448}
          className="stroke-hair"
          strokeWidth={1}
          markerEnd="url(#smfa-arrow)"
        />
        <Label x={570} y={429} text="finalizeMfaSession (transaction)" />

        {/* Right terminal — full after MFA */}
        <Node
          x={460}
          y={448}
          width={220}
          height={70}
          label="Session 'full'"
          sub="DELETE pending + INSERT full atomique"
          highlight
        />

        {/* Footer note */}
        <text
          x={360}
          y={555}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          Les wrap blobs (KEK, main_key) accompagnent toute réponse mfa_pending —
          le client peut déchiffrer localement avant la finalisation.
        </text>
      </svg>
    </figure>
  );
}
