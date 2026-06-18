/** The six tabs that compose the Account page. The order here
 *  is the order rendered in the topbar. */
export type Tab =
  | 'identity'
  | 'security'
  | 'preferences'
  | 'modules'
  | 'data'
  | 'danger';

/** Tone-tagged feedback message shown under a form row. The
 *  `IdentityTab` rows and the data panels all share this shape,
 *  rendered through the shared `<InlineAlert>` atom (the `error`
 *  tone maps to the atom's `danger`). */
export interface FeedbackState {
  tone: 'success' | 'error';
  text: string;
}
