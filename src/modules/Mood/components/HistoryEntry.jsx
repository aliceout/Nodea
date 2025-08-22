export default function HistoryEntry({ entry, onDelete, decryptField }) {
  const dateObj = new Date(entry.date);
  const jours = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const jour = jours[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");

  return (
    <li className="relative mb-6 p-4 bg-white rounded shadow min-w-[250px] max-w-xs flex-1">
      <div className="flex items-center mb-2 justify-between">
        <span className="font-bold">
          {jour.charAt(0).toUpperCase() + jour.slice(1)}
          <span className="mx-1 text-gray-500"></span>
          {dd}.{mm}
        </span>
        <div className="flex items-center justify-center pr-8 ">
          <span className="text-xl mr-3">{entry.mood_emoji}</span>
          <span className="ml-auto px-2 py-1 rounded bg-sky-50">
            {entry.mood_score}
          </span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="absolute top-2 right-2 bg-white rounded-full p-1 hover:bg-red-100 transition group"
          title="Supprimer"
          tabIndex={-1}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="block"
          >
            <circle cx="10" cy="10" r="10" fill="#F87171" opacity="0.20" />
            <path
              d="M7 7L13 13M13 7L7 13"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive1}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive2}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive3}
        </div>
      </div>
      {/* Question du jour */}
      {entry.question && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Question du jour : <span>{entry.question}</span>
        </div>
      )}
      {/* Réponse à la question */}
      {entry.answer && (
        <div className="mb-1 ml-2 italic text-sky-900 text-sm">
          ↳ {entry.answer}
        </div>
      )}
      {/* Commentaire */}
      {entry.comment && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Commentaire :{" "}
          <span className=" font-normal text-gray-700 italic">
            {entry.comment}
          </span>
        </div>
      )}
    </li>
  );
}
