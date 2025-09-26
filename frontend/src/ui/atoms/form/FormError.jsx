// Atom canonical: @/ui/atoms/form/FormError
// (Removed legacy self re-export to avoid duplicate default export)

export default function FormFeedback({
  message,
  type = "error", // "error" ou "success"
  className = "",
}) {
  if (!message) return null;

  const color =
    type === "success" ? "text-nodea-sage" : "text-nodea-blush-dark"; // rouge si error, vert si success

  return (
    <div className={`mt-2 text-center ${color} ${className}`}>{message}</div>
  );
}
