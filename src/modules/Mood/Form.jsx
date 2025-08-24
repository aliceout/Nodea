import React, { useState, useEffect, useRef } from "react";
import pb from "@/services/pocketbase";
import questions from "@/data/questions.json";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { encryptAESGCM } from "@/services/webcrypto";

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
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.module_user_id;
  
  // Import CryptoKey WebCrypto dès que mainKey dispo
  const [cryptoKey, setCryptoKey] = useState(null);
  useEffect(() => {
    if (!mainKey) return;
    window.crypto.subtle
    .importKey("raw", mainKey, { name: "AES-GCM" }, false, ["encrypt"])
    .then(setCryptoKey);
  }, [mainKey]);
  
useEffect(() => {
  // Choix aléatoire simple pour l’instant (on réintégrera l’historique plus tard)
  const q = questions[Math.floor(Math.random() * questions.length)];
  setRandomQuestion(q);
  setLoadingQuestion(false);
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
      if (!moduleUserId) {
        setError("Module manquant");
        return;
      }
      const payloadObj = {
        date,
        positive1,
        positive2,
        positive3,
        mood_score: String(moodScore),
        mood_emoji: moodEmoji,
        comment,
        question: randomQuestion,
        answer,
      };

      // On chiffre le payload clair avec la mainKey (déjà importée en cryptoKey)
      const { data, iv } = await encryptAESGCM(
        JSON.stringify(payloadObj),
        cryptoKey
      );

      // ⚠️ champs attendus par la collection `mood_entries`
      await pb.collection("mood_entries").create({
        module_user_id: moduleUserId, // requis
        payload: data, // requis (ciphertext base64)
        cipher_iv: iv, // requis (IV base64)
        guard: modules?.mood?.guard, // requis (secret g_... stocké dans users.modules)
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
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto ">
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
            <PositivesBlock
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
            <MoodBlock
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

import PositivesBlock from "./components/FormPositives";
import MoodBlock from "./components/FormMood";
import QuestionBlock from "./components/FormQuestion";
import CommentBlock from "./components/FormComment";
import Button from "@/components/common/Button";
import FormError from "@/components/common/FormError";
