import React from "react";

import useMoodTrend from "../hooks/useMoodTrend";
import GraphChart from "../components/Chart";

export default function GraphPage() {
  const { status, data, error } = useMoodTrend();

  if (status === "missing-key")
    return (
      <div
        role="alert"
        aria-live="polite"
        className="m-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 text-center"
      >
        <p className="font-medium">Cle de chiffrement absente du cache</p>
        <p className="mt-1">
          Connecte-toi a nouveau pour afficher le graphique.
        </p>
      </div>
    );

  if (status === "missing-module")
    return (
      <div className="p-8">Module &laquo; Humeur &raquo; non configure.</div>
    );

  if (status === "loading") return <div className="p-8">Chargement...</div>;
  if (status === "error") return <div className="p-8 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-8">Aucune donnee.</div>;

  return <GraphChart data={data} />;
}
