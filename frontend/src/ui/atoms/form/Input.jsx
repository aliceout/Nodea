// Atom canonical: @/ui/atoms/form/Input
// Implémentation rétablie (l’ancienne ligne de self re-export a été supprimée)
import React from "react";

/**
 * Input générique
 * Props supportées :
 * - label, labelClassName
 * - type, value, onChange, placeholder
 * - disabled, required
 * - className (wrapper), inputClassName (élément input)
 * - legend (texte d’aide sous champ)
 * - ...props (attributs natifs)
 */
export default function Input({
	label,
	labelClassName = "",
	type = "text",
	value,
	onChange,
	placeholder = "",
	disabled = false,
	required = false,
	className = "",
	inputClassName = "",
	legend,
	...props
}) {
	return (
		<div className={"flex flex-col " + className}>
			{label && (
				<label
					className={
						"block mb-1 font-semibold text-nodea-sage-dark text-sm " +
						labelClassName
					}
				>
					{label}
				</label>
			)}
			<input
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				required={required}
				className={`w-full p-2 border rounded border-nodea-slate-lighter hover:border-nodea-slate-light focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark text-sm placeholder:text-sm disabled:bg-nodea-slate-light disabled:text-gray-400 disabled:border-nodea-slate-light ${inputClassName}`}
				{...props}
			/>
			{legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
		</div>
	);
}
