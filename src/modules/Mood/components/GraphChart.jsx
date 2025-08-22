import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Format dd.mm
const formatDDMM = (isoDate) => {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
};

export default function GraphChart({ data }) {
  return (
    <div className="h-[60vh] min-h-[400px] md:min-h-[600px] w-full flex justify-start items-center -ml-8">
      <ResponsiveContainer width="95%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
        >
          <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDDMM}
            interval={0}
            tick={(props) => {
              const { x, y, payload, index } = props;
              return (
                <g>
                  <text
                    x={x}
                    y={y + 15}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize={12}
                  >
                    {formatDDMM(payload.value)}
                  </text>
                </g>
              );
            }}
          />
          <YAxis domain={[-2, 3]} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const { mood, emoji } = payload[0].payload;
                return (
                  <div className="bg-white border rounded p-2 shadow text-sm">
                    <div>
                      <span className="font-bold">Date :</span>{" "}
                      {formatDDMM(label)}
                    </div>
                    <div>
                      <span className="font-bold">Mood :</span> {mood} {emoji}
                    </div>
                  </div>
                );
              }
              return null;
            }}
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
      </ResponsiveContainer>
    </div>
  );
}
