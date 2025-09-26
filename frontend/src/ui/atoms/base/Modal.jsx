
import React, { useEffect, useRef } from "react";

export default function Modal({ open, onClose, children, className = "", backdropClass = "", disableClose = false }) {
	const dialogRef = useRef(null);

	useEffect(() => {
		if (open && dialogRef.current) {
			dialogRef.current.focus();
		}
		function handleKeyDown(e) {
			if (!disableClose && e.key === "Escape") {
				onClose?.();
			}
		}
		if (open) {
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	}, [open, disableClose, onClose]);

	if (!open) return null;

		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center">
				{/* Backdrop */}
				<div className={`absolute inset-0 ${backdropClass || "bg-black/40 backdrop-blur-xs"} z-0`} />
				{/* Modal */}
						<div
							className={`relative rounded-lg shadow-lg p-8 max-w-md w-full text-center bg-white ${className}`}
							role="dialog"
							aria-modal="true"
							tabIndex={-1}
							ref={dialogRef}
						>
							{children}
						</div>
			</div>
		);
}
