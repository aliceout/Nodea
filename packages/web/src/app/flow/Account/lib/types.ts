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
 *  `IdentityTab` rows and the data panels all share this shape so
 *  the `<Feedback>` primitive doesn't need a tab-specific variant. */
export interface FeedbackState {
  tone: 'success' | 'error';
  text: string;
}
