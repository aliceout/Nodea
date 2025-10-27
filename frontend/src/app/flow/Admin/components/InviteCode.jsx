import Button from "@/ui/atoms/base/Button";
import SettingsCard from "@/ui/atoms/specifics/SettingsCard";

export default function InviteCodeManager({
  inviteCodes,
  generating,
  onGenerate,
  copySuccess,
  onCopy,
  onDelete,
}) {
  return (
    <SettingsCard className="border-gray-200 hover:border-gray-300 bg-white">
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center justify-start">
          <Button
            onClick={onGenerate}
            className="bg-nodea-sky-dark text-white px-4 py-2 rounded hover:bg-nodea-sky-darker"
            disabled={generating}
          >
            {generating ? "Génération..." : "Générer un code"}
          </Button>
        </div>
        {copySuccess ? (
          <span className="text-xs text-emerald-600">{copySuccess}</span>
        ) : null}
      </div>
      {inviteCodes.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Codes d'invitation valides :</div>
          <ul className="flex flex-wrap gap-3">
            {inviteCodes.map((c) => (
              <li
                key={c.id || c.code}
                className="bg-gray-100 px-3 py-2 rounded flex items-center gap-1.5"
              >
                <button
                  className="rounded hover:bg-sky-100 focus:outline-none px-1 py-1"
                  onClick={() => onCopy(c.code)}
                  title="Copier le code"
                  type="button"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="7"
                      y="7"
                      width="10"
                      height="10"
                      rx="2"
                      fill="#fff"
                      stroke="#3182ce"
                      strokeWidth="2"
                    />
                    <rect
                      x="3"
                      y="3"
                      width="10"
                      height="10"
                      rx="2"
                      fill="#e6f0fa"
                      stroke="#3182ce"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
                <span className="font-mono text-sm">{c.code}</span>
                <button
                  className="rounded hover:bg-red-100 focus:outline-none px-1 py-1"
                  onClick={() => onDelete(c.id)}
                  title="Supprimer ce code"
                  type="button"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 22 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 6L16 16M16 6L6 16"
                      stroke="#e53e3e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SettingsCard>
  );
}
