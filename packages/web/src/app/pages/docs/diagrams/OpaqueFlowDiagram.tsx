/**
 * OPAQUE 2-step login flow diagram — Direction K · Sauge.
 *
 * Sequence diagram (UML-flavoured) showing the four-message
 * exchange between client and server during an OPAQUE login,
 * plus the two client-side computations that bracket the
 * network round-trips. Mirrors `docs/auth/Login.md` (login password-first).
 *
 * Hand-coded SVG so the visual reads as part of the K · Sauge
 * design (hairline column dividers, accent on the activation
 * blocks for client-side compute) without pulling in a runtime
 * sequence-diagram library.
 */

interface MessageProps {
  y: number;
  /** Direction of the arrow: `right` = client→server, `left` =
   *  server→client. */
  direction: 'right' | 'left';
  label: string;
  body?: string;
}

function Message({ y, direction, label, body }: MessageProps) {
  const left = 140;
  const right = 580;
  const x1 = direction === 'right' ? left : right;
  const x2 = direction === 'right' ? right : left;
  const labelX = (left + right) / 2;
  return (
    <g>
      <text
        x={labelX}
        y={y - 16}
        textAnchor="middle"
        className="fill-ink text-[11.5px] font-medium"
      >
        {label}
      </text>
      {body ? (
        <text
          x={labelX}
          y={y - 4}
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          {body}
        </text>
      ) : null}
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        className="stroke-hair"
        strokeWidth={1.25}
        markerEnd="url(#opaque-arrow)"
      />
    </g>
  );
}

interface ComputeProps {
  /** Client side anchor x — the activation block sits over the
   *  client lifeline. */
  side: 'client' | 'server';
  yTop: number;
  height: number;
  label: string;
  sub?: string;
}

function Compute({ side, yTop, height, label, sub }: ComputeProps) {
  const x = side === 'client' ? 122 : 562;
  return (
    <g>
      <rect
        x={x}
        y={yTop}
        width={36}
        height={height}
        rx={3}
        className="fill-bg-2 stroke-accent"
        strokeWidth={1.25}
      />
      <text
        x={side === 'client' ? 170 : 555}
        y={yTop + height / 2 - (sub ? 5 : 0)}
        textAnchor={side === 'client' ? 'start' : 'end'}
        dominantBaseline="middle"
        className="fill-ink text-[11.5px] font-medium"
      >
        {label}
      </text>
      {sub ? (
        <text
          x={side === 'client' ? 170 : 555}
          y={yTop + height / 2 + 9}
          textAnchor={side === 'client' ? 'start' : 'end'}
          dominantBaseline="middle"
          className="fill-muted text-[10px]"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export default function OpaqueFlowDiagram() {
  const lifelineTop = 60;
  const lifelineBottom = 510;

  return (
    <figure className="my-8 -mx-2 overflow-x-auto">
      <svg
        viewBox="0 0 720 540"
        role="img"
        aria-label="Échange OPAQUE en deux étapes : le client appelle startLogin localement, envoie startLoginRequest au serveur, reçoit loginResponse + loginToken, calcule finishLogin localement (qui produit l'exportKey jamais envoyé), envoie finishLoginRequest au serveur, reçoit le cookie de session et les blobs wrappés, déchiffre la KEK puis la clé maîtresse localement."
        className="mx-auto block w-full max-w-[720px] text-ink"
      >
        <defs>
          <marker
            id="opaque-arrow"
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

        {/* Headers */}
        <rect x={60} y={20} width={160} height={32} rx={6} className="fill-bg-2 stroke-hair" strokeWidth={1} />
        <text x={140} y={36} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-[12.5px] font-semibold">
          Client
        </text>
        <text x={140} y={48} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[10px]">
          (navigateur)
        </text>

        <rect x={500} y={20} width={160} height={32} rx={6} className="fill-bg-2 stroke-hair" strokeWidth={1} />
        <text x={580} y={36} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-[12.5px] font-semibold">
          Server
        </text>
        <text x={580} y={48} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[10px]">
          (Hono / OPAQUE)
        </text>

        {/* Lifelines (dashed) */}
        <line
          x1={140}
          y1={lifelineTop}
          x2={140}
          y2={lifelineBottom}
          className="stroke-hair"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <line
          x1={580}
          y1={lifelineTop}
          x2={580}
          y2={lifelineBottom}
          className="stroke-hair"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {/* Step 1 — client.startLogin (local) */}
        <Compute
          side="client"
          yTop={70}
          height={32}
          label="client.startLogin(password)"
          sub="→ { startLoginRequest, clientLoginState }"
        />

        {/* Step 2 — POST /auth/login/start */}
        <Message
          y={130}
          direction="right"
          label="POST /auth/login/start"
          body="{ email, startLoginRequest }"
        />

        {/* Step 3 — server response */}
        <Message
          y={180}
          direction="left"
          label="200 OK"
          body="{ loginResponse, loginToken }"
        />

        {/* Step 4 — client.finishLogin (local) — exportKey never leaves */}
        <Compute
          side="client"
          yTop={210}
          height={50}
          label="client.finishLogin(password, …)"
          sub="→ finishLoginRequest, exportKey ⚑ jamais envoyé"
        />

        {/* Step 5 — POST /auth/login/finish */}
        <Message
          y={290}
          direction="right"
          label="POST /auth/login/finish"
          body="{ loginToken, finishLoginRequest }"
        />

        {/* Step 6 — server response with wrap blobs */}
        <Message
          y={350}
          direction="left"
          label="200 OK + Set-Cookie nodea_session=…"
          body="{ wrappedMainKey, wrappedKekPassword, … }"
        />

        {/* Step 7 — client unwraps locally */}
        <Compute
          side="client"
          yTop={390}
          height={70}
          label="HKDF(exportKey, &quot;nodea:wrap-kek&quot;)"
          sub="→ AES-GCM-decrypt → KEK → main_key → AES + HMAC sub-keys"
        />

        {/* Footer note */}
        <text
          x={360}
          y={500}
          textAnchor="middle"
          className="fill-muted text-[10.5px] italic"
        >
          ⚑ Le password en clair, l'exportKey, la KEK et la main_key ne quittent jamais le navigateur.
        </text>
      </svg>
    </figure>
  );
}
