import type { LibraryStatus } from '@nodea/shared';

/** Display label for each `status` value of a library item. Shared
 *  between the catalogue render (`PrimaryColumn` header, sidebar
 *  filter chips) and the status grouping (`buildGroups`) so the
 *  three surfaces stay consistent. */
export const STATUS_LABEL: Record<LibraryStatus, string> = {
  planned: 'À lire',
  in_progress: 'En cours',
  finished: 'Terminés',
  abandoned: 'Abandonnés',
};
