import Textarea from "@/components/common/Textarea";
export default function JournalComment({ comment, setComment }) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <label className="text-sm font-semibold">Commentaire :</label>
      <Textarea
        value={comment || ""}
        onChange={(e) => setComment(e.target.value)}
        className="min-h-50"
        placeholder="Réponse optionnelle"
      />
    </div>
  );
}
