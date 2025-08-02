import React, { useState, useRef } from "react";
import pb from "../services/pocketbase";
import EmojiPicker from "emoji-picker-react";
import Layout from "../components/LayoutTop";
import questions from "../data/questions.json";

export default function JournalEntryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [positive1, setPositive1] = useState("");
  const [positive2, setPositive2] = useState("");
  const [positive3, setPositive3] = useState("");
  const [moodScore, setMoodScore] = useState("");
  const [moodEmoji, setMoodEmoji] = useState("");
  const [comment, setComment] = useState("");
  const [answer, setAnswer] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Question du jour aléatoire (fixée à chaque ouverture de page)
  const [randomQuestion] = useState(() => {
    const idx = Math.floor(Math.random() * questions.length);
    return questions[idx];
  });

  // Emoji picker refs
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(event.target)
      ) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  // Validation stricte sur les champs requis
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    // Validation obligatoire sur tous les champs requis
    if (!positive1.trim() || !positive2.trim() || !positive3.trim()) {
      setError("Merci de remplir les trois points positifs.");
      return;
    }
    if (moodScore === "" || moodScore === null) {
      setError("Merci de choisir une note d'humeur.");
      return;
    }
    if (!moodEmoji) {
      setError("Merci de choisir un emoji.");
      return;
    }
    try {
      await pb.collection("journal_entries").create({
        user: pb.authStore.model.id,
        date,
        positive1,
        positive2,
        positive3,
        mood_score: Number(moodScore),
        mood_emoji: moodEmoji,
        comment,
        question: randomQuestion,
        answer,
      });
      setSuccess("Entrée enregistrée !");
      setPositive1("");
      setPositive2("");
      setPositive3("");
      setMoodScore("");
      setMoodEmoji("");
      setComment("");
      setAnswer("");
    } catch (err) {
      setError("Erreur lors de l’enregistrement : " + (err?.message || ""));
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl mx-auto rounded-lg mt-5"
      >
        {/* Header : h1 et date */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold text-center md:text-left">
            Mon journal du jour
          </h1>
          <div className="flex-shrink-0 flex items-center justify-center md:justify-end w-full md:w-85 mt-5">
            <input
              id="journal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
        </div>

        {/* Deux colonnes (desktop) */}
        <div className="flex flex-col md:flex-row gap-8 mb-4">
          {/* Colonne gauche */}
          <div className="flex flex-col w-full md:w-1/2">
            <label className="mb-1 font-medium">
              Premier point positif du jour  :
            </label>
            <textarea
              value={positive1}
              onChange={(e) => setPositive1(e.target.value)}
              className="w-full mb-3 p-3 border rounded min-h-18 resize-none align-top"
              rows={2}
              required
            />
            <label className="mb-1 font-medium">
              Deuxième point positif du jour :
            </label>
            <textarea
              value={positive2}
              onChange={(e) => setPositive2(e.target.value)}
              className="w-full mb-3 p-3 border rounded min-h-18 resize-none align-top"
              rows={2}
              required
            />
            <label className="mb-1 font-medium">
              Troisième point positif du jour :
            </label>
            <textarea
              value={positive3}
              onChange={(e) => setPositive3(e.target.value)}
              className="w-full mb-3 p-3 border rounded min-h-18 resize-none align-top"
              rows={2}
              required
            />
          </div>

          {/* Colonne droite */}
          <div className="flex flex-col w-full md:w-1/2 gap-4">
            {/* Mood + Emoji côte à côte */}
            <div className="mb-4">
              <div className="flex flex-row items-end justify-between">
                {/* Emoji */}
                <div className="flex items-center gap-4">
                  <span>Résumé</span>
                  <button
                    type="button"
                    className="text-2xl border rounded  h-10 w-10 flex items-center justify-center"
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
                {/* Mood */}
                <div className="flex items-center gap-4 ">
                  <span>Note</span>
                  <select
                    value={moodScore}
                    onChange={(e) => setMoodScore(e.target.value)}
                    className="p-1 h-10 border rounded text-base"
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

            <label className="mb-1 font-medium">
              Commentaire (optionnel) :
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full mb-4 p-3 border rounded min-h-50"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 mb-2 w-full text-center">{error}</div>
        )}
        {success && (
          <div className="text-green-600 mb-2 w-full text-center">
            {success}
          </div>
        )}
        {/* Question du jour + bouton */}
        <div className="mb-6 flex flex-row items-end gap-3">
          <div className="flex flex-col basis-6/10">
            <div className="text-lg font-semibold mb-2">Question du jour :</div>
            <div className="mb-2 italic text-gray-800">{randomQuestion}</div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full mb-0 p-3 border rounded min-h-18 resize-none align-top"
              rows={2}
              placeholder="Ta réponse (optionnel)"
            />
          </div>
          <button
            type="submit"
            className="basis-4/10 bg-sky-600 text-white px-5 py-3 rounded hover:bg-sky-700 font-semibold h-[50px] ml-2"
            style={{ minWidth: 120 }}
          >
            Enregistrer
          </button>
        </div>
      </form>
    </Layout>
  );
}
