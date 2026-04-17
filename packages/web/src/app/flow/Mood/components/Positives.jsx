import Textarea from "@/ui/atoms/form/Textarea";
export default function JournalPositives({
  positive1,
  setPositive1,
  positive2,
  setPositive2,
  positive3,
  setPositive3,
  required = false,
}) {
  return (
    <div className="flex flex-col justify-center gap-3">
      <Textarea
        label="Premier point positif du jour :"
        labelClassName="text-sm"
        value={positive1}
        onChange={(e) => setPositive1(e.target.value)}
        required={required}
      />
      <Textarea
        label="Deuxième point positif du jour :"
        labelClassName="text-sm"
        value={positive2}
        onChange={(e) => setPositive2(e.target.value)}
        required={required}
      />

      <Textarea
        label="Troisième point positif du jour :"
        labelClassName="text-sm"
        value={positive3}
        onChange={(e) => setPositive3(e.target.value)}
        required={required}
      />
    </div>
  );
}
