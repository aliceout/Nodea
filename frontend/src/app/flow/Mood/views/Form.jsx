import React, { useEffect, useRef, useState } from "react";
import pb from "@/core/api/pocketbase";
import questions from "@/i18n/fr/Mood/questions.json";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { encryptAESGCM } from "@/core/crypto/webcrypto";
import { deriveGuard } from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
import { useStore } from "@/core/store/StoreProvider";

import PositivesBlock from "../components/Positives";
import MoodBlock from "../components/Mood";
import QuestionBlock from "../components/Question";
import CommentBlock from "../components/Comment";
import Button from "@/ui/atoms/base/Button";
import FormError from "@/ui/atoms/form/FormError";
import Input from "@/ui/atoms/form/Input";

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

  const { mainKey } = useStore();
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    const question = questions[Math.floor(Math.random() * questions.length)];
    setRandomQuestion(question);
    setLoadingQuestion(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hasMainKeyMaterial(mainKey)) {
      setError(
        "Erreur : cle de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Humeur' non configure (id manquant).");
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
      const includeQA = !!answer.trim();
      const payloadObj = {
        date,
        positive1,
        positive2,
        positive3,
        mood_score: String(moodScore),
        mood_emoji: moodEmoji,
        comment,
        ...(includeQA ? { question: randomQuestion, answer } : {}),
      };

      const { data, iv } = await encryptAESGCM(
        JSON.stringify(payloadObj),
        mainKey
      );

      const created = await pb.send("/api/collections/mood_entries/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_user_id: String(moduleUserId),
          payload: String(data),
          cipher_iv: String(iv),
          guard: "init",
        }),
      });

      if (!created?.id) {
        throw new Error("Creation incomplete (id manquant).");
      }

      const guard = await deriveGuard(mainKey, moduleUserId, created.id);

      await pb.send(
        `/api/collections/mood_entries/records/${encodeURIComponent(
          created.id
        )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guard }),
        }
      );

      setSuccess("Entree enregistree !");
      setPositive1("");
      setPositive2("");
      setPositive3("");
      setMoodScore("");
      setMoodEmoji("");
      setComment("");
      setAnswer("");
    } catch (err) {
      setError("Erreur lors de l'enregistrement : " + (err?.message || ""));
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto ">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold text-center md:text-left">
            Nouvelle entree
          </h1>
          <div className="flex-shrink-0 flex items-center justify-center md:justify-end w-full md:w-85 mt-5">
            <Input
              id="journal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm"
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
          <Button
            type="submit"
            className=" bg-nodea-sage-dark hover:bg-nodea-sage-darker "
          >
            Enregistrer
          </Button>
          {error && <FormError message={error} />}
          {success && (
            <div className="text-green-700 text-sm mt-2">{success}</div>
          )}
        </div>
        <div className="flex justify-center"></div>
      </form>
    </>
  );
}



