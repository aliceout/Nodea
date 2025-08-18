// src/components/common/KeyMissingMessage.jsx
import React from "react";

export default function KeyMissingMessage({
  context = "continuer",
  className = "",
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 ${className}`}
    >
      <p className="font-medium">Clé de chiffrement absente du cache</p>
      <p className="mt-1">Merci de vous reconnecter pour {context}.</p>
    </div>
  );
}
