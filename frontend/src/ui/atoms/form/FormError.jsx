// Deprecated: use @/ui/atoms/form/FormError
export { default } from "./FormError";
// src/components/common/FormFeedback.jsx

export default function FormFeedback({
  message,
  type = "error", // "error" ou "success"
  className = "",
}) {
  if (!message) return null;

  const color =
    type === "success" ? "text-nodea-sage" : "text-nodea-blush-dark"; // rouge si error, vert si success

  return (
    <div className={`mt-2 text-center ${color} ${className}`}>
      {message}
    </div>
  );
}
