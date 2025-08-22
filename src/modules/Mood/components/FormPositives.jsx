export default function JournalPositives({
  positive1,
  setPositive1,
  positive2,
  setPositive2,
  positive3,
  setPositive3,
  required = false,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Premier point positif du jour :
        </label>
        <textarea
          value={positive1}
          onChange={(e) => setPositive1(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Deuxième point positif du jour :
        </label>
        <textarea
          value={positive2}
          onChange={(e) => setPositive2(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Troisième point positif du jour :
        </label>
        <textarea
          value={positive3}
          onChange={(e) => setPositive3(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
    </div>
  );
}
