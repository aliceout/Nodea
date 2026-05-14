import type {
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';

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
