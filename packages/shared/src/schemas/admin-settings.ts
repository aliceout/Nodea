import { z } from 'zod';

/**
 * Body schema for `PATCH /admin/settings` — partial update of the
 * app-wide settings the admin UI exposes. Only fields present in
 * the body are touched ; absent fields stay as-is server-side.
 *
 * Lives in `@nodea/shared` so the future admin form can validate
 * the body client-side before sending (REFACTO-15). Today the
 * admin UI calls `apiAdminUpdateSettings` directly without a form
 * layer, but as soon as a second field lands here we'll want the
 * shared validation in lockstep with the server.
 */
export const AdminSettingsPatchBodySchema = z.object({
  open_registration: z.boolean().optional(),
});
export type AdminSettingsPatchBody = z.infer<typeof AdminSettingsPatchBodySchema>;
