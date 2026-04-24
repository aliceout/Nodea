import type { AnnouncementResponse } from '@nodea/shared';
import type { Announcement } from '../db/schema.ts';

/** Row → JSON-safe response. Normalises `null` for optional timestamps. */
export function serialize(row: Announcement): AnnouncementResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    active: row.active,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
