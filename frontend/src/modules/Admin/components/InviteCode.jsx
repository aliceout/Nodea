import React from "react";

export default function InviteCodeManager({
  inviteCodes,
  generating,
  onGenerate,
  copySuccess,
  onCopy,
}) {
  return (
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <div className="flex gap-3 items-center justify-start">
        <Button
          onClick={onGenerate}
          className="bg-nodea-sky-dark text-white px-4 py-2 rounded hover:bg-nodea-sky-darker"
          disabled={generating}
        >
          {generating ? "Génération..." : "Générer un code"}
        </Button>
      </div>
      {copySuccess && (
        <div className="mt-2 text-green-600 font-medium">{copySuccess}</div>
      )}
      {inviteCodes.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Codes d’invitation valides :</div>
          <ul className="flex flex-wrap gap-3">
            {inviteCodes.map((c) => (
              <li
                key={c.id || c.code}
                className="bg-gray-100 px-3 py-2 rounded flex items-center gap-2"
              >
                <span className="font-mono">{c.code}</span>
                <button
                  className="text-sky-700 text-xs hover:underline"
                  onClick={() => onCopy(c.code)}
                >
                  Copier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SettingsCard>
  );
}

import Button from "@/components/common/Button";
import SettingsCard from "@/components/common/SettingsCard";