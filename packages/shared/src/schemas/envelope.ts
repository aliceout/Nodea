/**
 * Zod schema for the encrypted-record envelope shared by every module
 * (front + back single source of truth).
 *
 * Where: packages/shared — imported by the api records route and the web
 * collection client. Mirrors the `*_entries` columns the server sees:
 * `cipherIv` + `payload` (the AES-GCM blob). camelCase on the wire
 * (ADR-0012).
 */
import { z } from 'zod';

/**
 * Uniform list-response envelope (audit follow-up API-06).
 *
 * Every GET-list endpoint in the API returns
 *
 *   { data: <array of items>, meta: <object> }
 *
 * `data` always carries the array. `meta` is per-endpoint metadata:
 * empty by default, used to surface auxiliary counts that don't fit
 * inside an item (e.g. `prfCount` on `/auth/passkeys/list`). The
 * envelope is intentionally lean — pagination cursors / totals are
 * out of scope for this pass and would be added as additional
 * `meta` fields when needed.
 *
 * The mobile app coming next will consume the same shape, so we
 * keep one canonical helper here rather than per-endpoint
 * `{ users: [...] }` / `{ invites: [...] }` shapes.
 */

/**
 * Default `meta` shape — empty record that allows future fields to
 * land without bumping the wire contract for existing callers. Each
 * list endpoint can extend with its own meta schema (see
 * `PasskeyListMetaSchema` for an example).
 */
export const EmptyListMetaSchema = z.looseObject({});
export type EmptyListMeta = z.infer<typeof EmptyListMetaSchema>;

/**
 * Build a list-response schema for a given item shape and an optional
 * `meta` schema. Call sites stay short:
 *
 *   const UsersListResponseSchema = listResponseSchema(UserRowSchema);
 *   const PasskeyListResponseSchema = listResponseSchema(
 *     PasskeyListItemSchema,
 *     PasskeyListMetaSchema,
 *   );
 *
 * Per-endpoint Zod schemas remain the canonical source of truth ; this
 * helper is offered for code that doesn't need a tighter `meta` shape.
 */
export function listResponseSchema<TItem extends z.ZodType>(
  itemSchema: TItem,
) {
  return z.object({
    data: z.array(itemSchema),
    meta: EmptyListMetaSchema,
  });
}
