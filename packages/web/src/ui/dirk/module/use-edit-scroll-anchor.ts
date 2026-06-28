import { useLayoutEffect, useRef } from 'react';

/**
 * Scroll choreography for the inline EDIT form, shared by Mood and Journal.
 *
 * Editing a row far down the (window-virtualised) list opens the form above
 * the list, off-screen. This hook:
 *   - on open  — jumps to the top so the form is visible (Mood already did
 *                this via the composer's autofocus; Journal didn't, leaving
 *                the user to scroll up by hand);
 *   - on close — glides back to where the edited row was, so save/cancel
 *                lands on the entry just touched instead of stranded at top.
 *
 * The pre-edit position is banked from a LIVE scroll listener that's torn
 * down the instant editing opens — so the browser's scroll-anchoring bump
 * (inserting the form above the viewport shifts `scrollY`) can't overwrite
 * the banked value before we read it back on close. Window-scroll based:
 * both entry lists scroll with the page (`useWindowVirtualizer`).
 *
 * Pass `editing = editingEntry !== null` — false while CREATING, so opening
 * a brand-new entry keeps the natural position instead of bouncing.
 *
 * The open jump is instant on purpose: it coincides with Mood's autofocus
 * scroll (a smooth glide would visibly fight it), and matches the existing
 * "snaps to top" behaviour the user already signed off on.
 */
export function useEditScrollAnchor(editing: boolean): void {
  const bankRef = useRef(0);
  const wasEditing = useRef(false);

  useLayoutEffect(() => {
    const was = wasEditing.current;
    wasEditing.current = editing;

    if (editing) {
      // Opened (idle → edit): the idle listener below was just torn down by
      // this effect re-running, so `bankRef` is frozen at the pre-form
      // scroll position. Reveal the form at the top.
      if (!was) window.scrollTo({ top: 0 });
      return undefined;
    }

    // Idle, plus the edit → idle edge: glide back to the banked row first,
    // then resume tracking the live scroll position for the next edit.
    if (was) {
      const y = bankRef.current;
      // Honour reduced motion — jump instead of gliding for users who opt
      // out (consistent with the `motion-reduce` guard on the indicators).
      const behavior: ScrollBehavior = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
        ? 'auto'
        : 'smooth';
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior }));
    }
    bankRef.current = window.scrollY;
    const onScroll = (): void => {
      bankRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [editing]);
}
