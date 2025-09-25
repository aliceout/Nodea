import Textarea from "@/ui/components/Textarea";
export default function JournalComment({ comment, setComment }) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <Textarea
        label="Commentaire :"
        labelClassName="text-sm"
        value={comment || ""}
        onChange={(e) => setComment(e.target.value)}
        inputClassName="min-h-44"
        placeholder="Réponse optionnelle"
      />
    </div>
  );
}
