// src/modules/Mood/Form.jsx
import React, { useState, useEffect, useRef } from "react";
import pb from "@/services/pocketbase";
import questions from "@/data/questions.json";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { encryptAESGCM } from "@/services/crypto/webcrypto";
import { useStore } from "@/store/StoreProvider";

// --- Helpers HMAC (dérivation du guard) ---
const te = new TextEncoder();
function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
async function hmacSha256(keyRaw, messageUtf8) {
  // keyRaw: ArrayBuffer|Uint8Array (mainKey ou guardKey)
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}
async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard  = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  const hex = toHex(tag);
  return "g_" + hex; // 64 hex chars → ok avec le pattern ^(g_[a-z0-9]{32,}|init)$
}

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

  const { mainKey } = useStore(); // attendu: bytes (pas CryptoKey)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  // Import CryptoKey WebCrypto dès que mainKey dispo pour AES-GCM
  const [cryptoKey, setCryptoKey] = useState(null);
  useEffect(() => {
    if (!mainKey) return;
    // si mainKey est déjà une CryptoKey (selon ton contexte), on ne peut pas la réutiliser pour AES ici
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
      // -> n'ajoute question/answer que si une réponse a été saisie
      const includeQA = !!answer.trim();
      const payloadObj = {
        date,
        positive1,
        positive2,
        positive3,
        mood_score: String(moodScore),
        mood_emoji: moodEmoji,
        comment,
        ...(includeQA ? { question: randomQuestion, answer: answer } : {}),
      };

      // 2) Chiffrement AES-GCM (retourne { iv, data } en base64url)
      const { data, iv } = await encryptAESGCM(
        JSON.stringify(payloadObj),
        cryptoKey
      );

      // 3) CREATE (étape A) : POST avec guard="init"
      const recordCreate = {
        module_user_id: String(moduleUserId),
        payload: String(data),
        cipher_iv: String(iv),
        guard: "init",
      };

      const created = await pb.send("/api/collections/mood_entries/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordCreate),
      });

      if (!created?.id) {
        throw new Error("Création incomplète (id manquant).");
      }

      // 4) Promotion (étape B) : calcul HMAC du guard et PATCH ?d=init
      if (
        typeof mainKey === "object" &&
        mainKey?.type === "secret" &&
        !("buffer" in mainKey)
      ) {
        // mainKey CryptoKey non extractible → scénario non supporté ici
        throw new Error(
          "MainKey non exploitable pour HMAC. Reconnecte-toi pour récupérer la clé brute."
        );
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

import PositivesBlock from "./components/FormPositives";
import MoodBlock from "./components/FormMood";
import QuestionBlock from "./components/FormQuestion";
import CommentBlock from "./components/FormComment";
import Button from "@/components/common/Button";
import FormError from "@/components/common/FormError";
import Input from "@/components/common/Input";
