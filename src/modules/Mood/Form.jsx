import React, { useState, useEffect, useRef } from "react";
import pb from "../../services/pocketbase";
import { useMainKey } from "../../hooks/useMainKey";
import PositivePoint from "./components/FormPositives";
import MoodSelector from "./components/FormMood";
import QuestionBlock from "./components/FormQuestion";
import CommentBlock from "./components/FormComment";
import Button from "../../components/common/Button";
import questions from "../../data/questions.json";

import { encryptAESGCM } from "../../services/webcrypto";

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
  const [randomQuestion, setRandomQuestion] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const { mainKey } = useMainKey();
  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  // Import CryptoKey WebCrypto dès que mainKey dispo
  const [cryptoKey, setCryptoKey] = useState(null);
  useEffect(() => {
    if (!mainKey) return;
    window.crypto.subtle
      .importKey("raw", mainKey, { name: "AES-GCM" }, false, ["encrypt"])
      .then(setCryptoKey);
  }, [mainKey]);

  function encryptField(value) {
    if (!cryptoKey) return ""; // Sécurité, cas anormal
    return encryptAESGCM(value, cryptoKey).then((encrypted) =>
      JSON.stringify(encrypted)
    );
  }

  useEffect(() => {
    // Aller chercher les questions utilisées sur les 30 derniers jours
    const fetchQuestion = async () => {
      setLoadingQuestion(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        // Prend les entrées du user sur les 30 derniers jours
        const entries = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}" && date >= "${sinceStr}"`,
        });
        const alreadyUsedQuestions = entries.map((e) => e.question);

        // Filtre les questions jamais (ou pas récemment) posées
        const availableQuestions = questions.filter(
          (q) => !alreadyUsedQuestions.includes(q)
        );
        let chosen = "";
        if (availableQuestions.length > 0) {
          chosen =
            availableQuestions[
              Math.floor(Math.random() * availableQuestions.length)
            ];
        } else {
          // fallback : prend n’importe quelle question au hasard
          chosen = questions[Math.floor(Math.random() * questions.length)];
        }
        setRandomQuestion(chosen);
      } catch {
        // fallback
        setRandomQuestion(
          questions[Math.floor(Math.random() * questions.length)]
        );
      } finally {
        setLoadingQuestion(false);
      }
    };
    fetchQuestion();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!cryptoKey) {
      setError(
        "Erreur : clé de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
      );
      return;
    }
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
        positive1: await encryptField(positive1),
        positive2: await encryptField(positive2),
        positive3: await encryptField(positive3),
        mood_score: await encryptField(String(moodScore)), // Chiffré
        mood_emoji: await encryptField(moodEmoji), // Chiffré
        comment: await encryptField(comment),
        question: await encryptField(randomQuestion), // Chiffré
        answer: await encryptField(answer), // Chiffré
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
    <>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl mx-auto "
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold text-center md:text-left">
            Nouvelle entrée
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

        <div className="flex flex-col md:flex-row gap-8 mb-4">
          <div className="flex flex-col w-full md:w-1/2">
            <PositivePoint
              positive1={positive1}
              setPositive1={setPositive1}
              positive2={positive2}
              setPositive2={setPositive2}
              positive3={positive3}
              setPositive3={setPositive3}
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-1/2 gap-4">
            <MoodSelector
              moodScore={moodScore}
              setMoodScore={setMoodScore}
              moodEmoji={moodEmoji}
              setMoodEmoji={setMoodEmoji}
              showPicker={showPicker}
              setShowPicker={setShowPicker}
              emojiBtnRef={emojiBtnRef}
              pickerRef={pickerRef}
            />
            <CommentBlock comment={comment} setComment={setComment} />
          </div>
        </div>
        <div className="mb-6 flex flex-col md:flex-row items-end gap-3">
          <QuestionBlock
            question={randomQuestion}
            answer={answer}
            setAnswer={setAnswer}
            loading={loadingQuestion}
          />
          <Button type="submit" className="w-full md:w-1/2">
            Enregistrer
          </Button>
          {error && <FormError message={error} />}
        </div>
        <div className="flex justify-center"></div>
      </form>
    </>
  );
}
