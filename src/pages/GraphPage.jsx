import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}"`,
          sort: "date",
          $autoCancel: false,
        });

        // Filtrer sur les 6 derniers mois glissants
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const filtered = result.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= sixMonthsAgo && entryDate <= now;
        });

        setData(
          filtered.map((entry) => ({
            date: entry.date,
            mood: entry.mood_score,
            emoji: entry.mood_emoji,
          }))
        );
      } catch (err) {
        setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  // Format dd.mm
  const formatDDMM = (isoDate) => {
    const d = new Date(isoDate);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold  mt-10">Évolution</h1>
      <div className="h-[60vh] min-h-[400px] md:min-h-[600px] w-full flex justify-center items-center">
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
                    <text x={x} y={y + 32} textAnchor="middle" fontSize={18}>
                      {data[index] ? data[index].emoji : ""}
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
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 6, fill: "#fbbf24" }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  );
}
