// Atom canonical: @/ui/atoms/form/SuggestInput
// (Removed legacy self re-export)
import React, { useRef, useState, useEffect } from "react";
import Input from "./Input";

/**
 * SuggestInput
 * Input avec suggestions (dropdown) pour sélectionner ou créer une valeur.
 * Props :
 *   - value: string
 *   - onChange: (string) => void
 *   - options: string[] (suggestions)
 *   - placeholder: string
 *   - required: bool
 *   - label: string (optionnel)
 *   - legend: string | ReactNode (optionnel)
 *   - className: string (optionnel, classes du conteneur)
 *   - inputClassName: string (optionnel, classes de l'<input>)
 *   - id: string (optionnel)
 *   - ...props (autres props passés à l'<input>)
 */
export default function SuggestInput({
  value,
  onChange,
  options = [],
  placeholder,
  required,
  label,
  legend,
  className = "",
  inputClassName = "",
  id = "suggest-input",
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!value) setFiltered(options);
    else
      setFiltered(
        options.filter((t) => t.toLowerCase().includes(value.toLowerCase()))
      );
  }, [value, options]);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block mb-1 font-semibold text-nodea-sage-dark"
        >
          {label}
        </label>
      )}
      {/* Wrapper strict autour de l'input pour positionner la flèche et le menu */}
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          inputClassName={`text-sm pr-12 ${inputClassName}`} // padding à droite pour la flèche
          aria-haspopup="listbox"
          aria-expanded={open}
          {...props}
        />

        {/* Flèche positionnée DANS le wrapper (pas dans l'input) */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="h-4 w-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 8l4 4 4-4"
            />
          </svg>
        </span>

        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded shadow-lg text-xs max-h-48 overflow-auto"
          >
            {filtered.map((t) => (
              <li
                key={t}
                role="option"
                className="px-3 py-2 text-gray-700 cursor-pointer hover:bg-nodea-sage-light"
                onMouseDown={() => {
                  onChange(t);
                  setOpen(false);
                  inputRef.current && inputRef.current.blur();
                }}
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>

      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
