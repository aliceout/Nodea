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
          <span>Résumé</span>
          <button
            type="button"
            className="text-2xl border rounded border-gray-400 hover:border-gray-500 h-10 w-10 flex items-center justify-center"
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
          <span>Note</span>
          <select
            value={moodScore}
            onChange={(e) => setMoodScore(Number(e.target.value))}
            className="p-1 h-10 border border-gray-400 hover:border-gray-500 rounded text-base"
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
