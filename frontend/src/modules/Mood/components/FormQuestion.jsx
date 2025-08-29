import Textarea from "@/components/common/Textarea";
export default function JournalQuestion({
  question,
  answer,
  setAnswer,
  loading,
}) {
  return (
    <div className="flex flex-col w-full basis-full md:basis-3/5 ">
      <div className="text-sm font-semibold">Question du jour :</div>
      <div className="mb-2 italic text-gray-800 text-sm">
        {loading ? <span className="opacity-50">Chargement…</span> : question}
      </div>
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="mb-0"
        rows={2}
        placeholder="Réponse optionnelle"
        disabled={loading}
      />
    </div>
  );
}
