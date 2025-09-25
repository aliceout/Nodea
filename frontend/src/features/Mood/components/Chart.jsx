// src/modules/Mood/components/GraphChart.jsx
import { ResponsiveContainer } from "recharts";
import RotatedFrame from "./GraphFrame";
import ChartBody from "./GraphChartBody";

export default function GraphChart({ data }) {
  return (
    // Parent définit l'emprise logique. Ajuste si besoin.
    <div className="w-full h-[min(80vh,700px)] md:h-[min(80vh,800px)]">
      <RotatedFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ChartBody data={data} />
        </ResponsiveContainer>
      </RotatedFrame>
    </div>
  );
}
