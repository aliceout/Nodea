/**
 * Focus restore for inline-form trigger buttons (audit 2026-06,
 * lot G — accessibility).
 *
 * Where it sits : shared web util consumed by the module topbars
 * (Mood / Goals / Journal / Library). The « + Nouvelle entrée »
 * trigger either unmounts while its inline form is open, or stays
 * but loses focus to the form ; when the form closes, the browser
 * drops focus on `<body>` and a keyboard user loses their place.
 * This hook hands back a ref to attach to the trigger `<Button>`
 * and refocuses it on the open → closed transition.
 *
 * Baked-in decision : the refocus only fires when
 * `document.activeElement` is `<body>` (or null) — if the user
 * already moved focus elsewhere (e.g. clicked into the list), we
 * never steal it back. The effect runs after the re-render that
 * remounts the trigger, so the ref is populated by the time we
 * call `.focus()`.
 */
import { useEffect, useRef, type RefObject } from 'react';

export function useRefocusTrigger(
  open: boolean,
): RefObject<HTMLButtonElement | null> {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    if (!was || open) return;
    const active = document.activeElement;
    if (active === null || active === document.body) {
      triggerRef.current?.focus();
    }
  }, [open]);

  return triggerRef;
}
