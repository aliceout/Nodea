import {
  AnnouncementListResponseSchema,
  type AnnouncementResponse,
} from '@nodea/shared';

import { request } from './internal.ts';

/**
 * Public announcements client — wraps `GET /announcements`, the
 * read-only feed every authenticated user sees on the Homepage.
 * Admin CRUD goes through `core/api/admin.ts`. Mounting both
 * surfaces on the same module would import the admin write
 * helpers into every page that just wants to display the feed.
 *
 * The server only returns « live » rows (active && within the
 * optional start/end window) so the caller can render the array
 * verbatim without re-filtering.
 */
export async function apiListLiveAnnouncements(
  limit = 5,
): Promise<AnnouncementResponse[]> {
  // Uniform `{ data, meta }` envelope (audit API-06).
  const { data } = await request(
    'GET',
    `/announcements?limit=${limit}`,
    undefined,
    AnnouncementListResponseSchema,
  );
  return data;
}
