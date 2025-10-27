import EmojiPicker from "emoji-picker-react";

export default function JournalMood({
  moodScore,
  setMoodScore,
  moodEmoji,
  setMoodEmoji,
  showPicker,
  setShowPicker,
  emojiBtnRef,
  pickerRef,
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-row items-end justify-between">
        <div className="flex items-center gap-4">
          <label className="block font-semibold text-nodea-sage-dark text-sm ">
            Résumé
          </label>
          <button
            type="button"
            className="text-2xl border rounded-lg border-gray-200 hover:border-gray-300 h-10 w-10 flex items-center justify-center transition-colors"
            ref={emojiBtnRef}
            onClick={() => setShowPicker(!showPicker)}
            style={{ lineHeight: 1 }}
          >
            {moodEmoji || "🙂"}
          </button>
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute z-50 top-16 left-1/2 -translate-x-1/2 shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={(e) => {
                  setMoodEmoji(e.emoji);
                  setShowPicker(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <label className="block font-semibold text-nodea-sage-dark text-sm ">
            Note
          </label>{" "}
          <select
            value={moodScore}
            onChange={(e) => setMoodScore(Number(e.target.value))}
            className="h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40"
            required
          >
            <option value="" disabled>
              Sélectionner
            </option>
            <option value="2">🤩 2</option>
            <option value="1">😊 1</option>
            <option value="0">😐 0</option>
            <option value="-1">😓 -1</option>
            <option value="-2">😭 -2</option>
          </select>
        </div>
      </div>
    </div>
  );
}
