import type {
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';
import type { I18nValue } from '@/i18n/I18nProvider.jsx';

/** Translate function threaded into the pure `lib/` helpers
 *  (grouping, labels) that build user-facing strings outside a
 *  React render. Same shape as the `t` returned by `useI18n()` —
 *  callers pass it down so the helpers stay hook-free and
 *  testable with a stub. */
export type TranslateFn = I18nValue['t'];

/** Decrypted item record + id — what the page hands around in
 *  memory. The id is the server-generated row UUID ; the rest of
 *  the fields come from the decrypted payload. */
export interface LibraryItem extends LibraryItemPayload {
  id: string;
}

/** Decrypted review record + id. */
export interface LibraryReview extends LibraryReviewPayload {
  id: string;
}

/**
 * One rendered group — header + the items below it. The five
 * grouping axes (status + author / year / tag / publisher /
 * collection) all produce this shape so `<GroupBlock>` doesn't
 * have to branch on the active axis.
 */
export interface LibraryGroup {
  /** Stable key for React reconciliation (status code, normalised
   *  tag, author name, year string, etc.). */
  key: string;
  /** Human-readable header rendered above the items. */
  label: string;
  items: LibraryItem[];
}
