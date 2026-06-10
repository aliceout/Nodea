import type { AnnouncementResponse } from '@nodea/shared';
import type { Announcement } from '../db/schema.ts';

/** Row → JSON-safe response (admin view). Normalises `null` for
 *  optional timestamps. Exposes `createdBy` — fine for the admin
 *  listing, which is already behind `requireAdmin`. */
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

/** Row → JSON-safe response for the PUBLIC feed. Identical to
 *  `serialize` except `createdBy` is forced to `null` : the authoring
 *  admin's user id is operator metadata, not something every logged-in
 *  reader needs (audit 2026-06 passe 2). The response schema already
 *  allows `null`, so the wire contract is unchanged. */
export function serializePublic(row: Announcement): AnnouncementResponse {
  return { ...serialize(row), createdBy: null };
}
