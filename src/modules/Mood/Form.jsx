// src/modules/Mood/Form.jsx
import React, { useState, useEffect, useRef } from "react";
import pb from "@/services/pocketbase";
import questions from "@/data/questions.json";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { encryptAESGCM } from "@/services/webcrypto";
import { useMainKey } from "@/hooks/useMainKey";
import { makeGuard } from "@/services/crypto-utils";

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
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  // Import CryptoKey WebCrypto dès que mainKey dispo
  const [cryptoKey, setCryptoKey] = useState(null);
  useEffect(() => {
    if (!mainKey) return;
    // si mainKey est déjà une CryptoKey (selon ton contexte), tu peux la détecter
    if (typeof mainKey === "object" && mainKey?.type === "secret") {
      return;
    }
    window.crypto.subtle
      .importKey("raw", mainKey, { name: "AES-GCM" }, false, ["encrypt"])
      .then((key) => {
        setCryptoKey(key);
      })
      .catch(() => setCryptoKey(null));
  }, [mainKey]);

  // Choix aléatoire simple pour l’instant
  useEffect(() => {
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
    if (!moduleUserId) {
      setError("Module 'Humeur' non configuré (id manquant).");
      return;
    }

    try {
      // 1) Payload clair (clés attendues côté lecture)
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

      // 2) Chiffrement AES‑GCM (retourne { iv, data } en base64)
      const { data, iv } = await encryptAESGCM(
        JSON.stringify(payloadObj),
        cryptoKey
      );

      // 3) Écriture PocketBase v2 (guard = secret par entrée)
      const guard = makeGuard();
      if (!/^g_[a-z0-9]{32,}$/.test(guard || "")) {
        setError("Guard invalide (format)");
        return;
      }
      // Construire un record “propre” (tout en string) pour éviter qu’un undefined soit droppé
      const record = {
        module_user_id: String(moduleUserId),
        payload: String(data),
        cipher_iv: String(iv),
        guard: String(guard),
      };
      await pb.send("/api/collections/mood_entries/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
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
