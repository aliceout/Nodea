import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// dd.mm
export const formatDDMM = (iso) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
};

function ChartTooltip({ active, payload, label, formatDDMM }) {
  if (!(active && payload && payload.length)) return null;
  const { mood, emoji } = payload[0].payload || {};
  return (
    <div className="rounded border border-slate-200 bg-white p-2 text-sm shadow dark:border-slate-600 dark:bg-slate-800">
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-bold">Date :</span> {formatDDMM(label)}
      </div>
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-bold">Mood :</span> {mood} {emoji}
      </div>
    </div>
  );
}

export default function ChartBody({ data, width, height }) {
  return (
    <LineChart
      data={data}
      width={width}
      height={height}
      // Pas de valeurs fixes : on met tout à 0.
      // L'offset réel est géré par la YAxis (auto-width) → tooltip aligné.
      margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
    >
      <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="5 5" />
      <XAxis
        dataKey="date"
        tickFormatter={formatDDMM}
        interval={0}
        tick={({ x, y, payload }) => (
          <g>
            <text
              x={x}
              y={y + 15}
              textAnchor="middle"
              fontSize={12}
              className="fill-slate-600 dark:fill-slate-300"
            >
              {formatDDMM(payload.value)}
            </text>
          </g>
        )}
      />
      {/* Laisse Recharts dimensionner l'axe Y (auto) → pas de px figés */}
      <YAxis
        domain={[-2, 2]}
        tick={{ fill: "var(--chart-axis-color, #475569)" }}
        axisLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
        tickLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
      />
      <Tooltip
        content={(p) => <ChartTooltip {...p} formatDDMM={formatDDMM} />}
      />
      <Line
        type="monotone"
        dataKey="mood"
        stroke="#90b6a2"
        strokeWidth={3}
        dot={{ r: 6, fill: "#f7f4ef" }}
        activeDot={{ r: 8 }}
      />
    </LineChart>
  );
}
