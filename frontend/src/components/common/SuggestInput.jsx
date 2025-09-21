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
      <div className={`relative overflow-hidden ${className}`}>
        {label && (
          <label
            htmlFor={props.id || "suggest-input"}
            className="block mb-1 font-semibold text-nodea-sage-dark"
          >
            {label}
          </label>
        return (
          <div className={className}>
            {label && (
              <label
                htmlFor={props.id || "suggest-input"}
                className="block mb-1 font-semibold text-nodea-sage-dark"
              >
                {label}
              </label>
            )}
            <div className="relative overflow-hidden">
              <Input
                id={props.id || "suggest-input"}
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
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
                   *   - className: string (optionnel, s'ajoute au conteneur)
                   *   - ...props (autres props Input)
                   */

export default function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  required,
  label,
  legend,
  className = "",
  ...props
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setFilteredSuggestions(options);
    } else {
      setFilteredSuggestions(
        options.filter((t) => t.toLowerCase().includes(value.toLowerCase()))
      );
    }
  }, [value, options]);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={props.id || "suggest-input"}
          className="block mb-1 font-semibold text-nodea-sage-dark"
        >
          {label}
        </label>
      )}
      <div className="relative overflow-hidden">
        <Input
          id={props.id || "suggest-input"}
          ref={inputRef}
          value={value}
          onChange={(e) => {
            return (
              <div className={`relative overflow-hidden ${className}`}>
                {label && (
                  <label
                    htmlFor={props.id || "suggest-input"}
                    className="block mb-1 font-semibold text-nodea-sage-dark"
                  >
                    {label}
                  </label>
                )}
                <div className="relative">
                  <Input
                    id={props.id || "suggest-input"}
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                      onChange(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete="off"
                    className={`text-sm pr-10 ${props.inputClassName || ""}`}
                    {...props}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
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
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded shadow-lg text-xs max-h-48 overflow-auto">
                      {filteredSuggestions.map((t) => (
                        <li
                          key={t}
                          className="px-3 py-2 text-gray-700 cursor-pointer hover:bg-nodea-sage-light"
                          onMouseDown={() => {
                            onChange(t);
                            setShowSuggestions(false);
                            inputRef.current.blur();
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
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
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
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded shadow-lg text-xs max-h-48 overflow-auto">
                      {filteredSuggestions.map((t) => (
                        <li
                          key={t}
                          className="px-3 py-2 text-gray-700 cursor-pointer hover:bg-nodea-sage-light"
                          onMouseDown={() => {
                            onChange(t);
                            setShowSuggestions(false);
                            inputRef.current.blur();
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
