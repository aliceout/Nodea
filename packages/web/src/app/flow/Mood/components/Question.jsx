import Textarea from "@/ui/atoms/form/Textarea";
export default function JournalQuestion({
  question,
  answer,
  setAnswer,
  loading,
}) {
  return (
    <div className="flex flex-col w-full basis-full md:basis-3/5 ">
      <div className="flex flex-row gap-x-2">
        <span className="text-sm font-semibold text-nodea-sage-dark ">
          Question du jour :
        </span>
        <span className="mb-2 text-nodea-slate italic text-sm">
          {loading ? <span className="opacity-50">Chargement…</span> : question}
        </span>
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
