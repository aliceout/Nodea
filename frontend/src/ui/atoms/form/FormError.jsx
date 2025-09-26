export default function FormFeedback({
  message,
  type = "error",
  className = "",
}) {
  if (!message) return null;
  const color = type === "success" ? "text-nodea-sage" : "text-nodea-blush-dark";
  return <div className={`mt-2 text-center ${color} ${className}`}>{message}</div>;
}
