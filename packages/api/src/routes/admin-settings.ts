import { AdminSettingsPatchBodySchema } from '@nodea/shared';
import { requireUser, requireAdmin } from '../middleware/require-user.ts';
import {
  isOpenRegistration,
  setOpenRegistration,
} from '../services/settings.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  z,
} from '../openapi/index.ts';

/**
 * Admin / settings sub-router. Read + patch the global app settings
 * (currently just `open_registration`). Each setting tracks its
 * `updatedBy` server-side for audit. Mounted by `admin.ts`
 * (the barrel) under `/admin`.
 */
export const adminSettingsRoutes = makeAuthedRouter();

const SettingsResponseSchema = z.object({
  open_registration: z.boolean(),
});

const adminMiddlewares = [requireUser, requireAdmin];

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  tags: ['admin-settings'],
  summary: 'Read admin settings',
  middleware: adminMiddlewares,
  responses: {
    200: jsonContent(SettingsResponseSchema, 'Settings snapshot'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

const patchSettingsRoute = createRoute({
  method: 'patch',
  path: '/settings',
  tags: ['admin-settings'],
  summary: 'Patch admin settings',
  middleware: adminMiddlewares,
  request: { body: { content: { 'application/json': { schema: AdminSettingsPatchBodySchema } } } },
  responses: {
    200: jsonContent(SettingsResponseSchema, 'Updated settings'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

/** Read every setting the UI exposes. Currently just open_registration. */
adminSettingsRoutes.openapi(getSettingsRoute, async (c) => {
  return c.json(
    {
      open_registration: await isOpenRegistration(),
    },
    200,
  );
});

/**
 * Patch one or more settings. Only fields present in the body are
 * touched; absent fields stay as-is. Each setting tracks its
 * `updatedBy` for audit.
 */
adminSettingsRoutes.openapi(patchSettingsRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = AdminSettingsPatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const admin = c.get('user');

  if (parsed.data.open_registration !== undefined) {
    await setOpenRegistration(parsed.data.open_registration, admin.id);
  }

  return c.json(
    {
      open_registration: await isOpenRegistration(),
    },
    200,
  );
});
