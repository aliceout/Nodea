/**
 * Admin diagnostics: `GET /admin/sources` — live health probe of the
 * external library-metadata providers.
 *
 * Where: api admin route layer (mounted at `/admin`, behind requireAdmin);
 * delegates to `services/library-lookup/dispatcher.ts`.
 */
import { AdminSourcesResponseSchema } from '@nodea/shared';
import type { AdminSourcesResponse } from '@nodea/shared';
import { requireUser, requireAdmin } from '../middleware/require-user.ts';
import { probeLibraryProviders } from '../services/library-lookup/dispatcher.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
} from '../openapi/index.ts';

/**
 * Admin / sources sub-router. Probes external metadata providers and
 * reports per-source health (configured / online / responseMs /
 * testFoundResults / error). Mounted by `admin.ts` (the barrel) under
 * `/admin`.
 *
 * `requireAdmin` is enforced at the route level so non-admins never
 * reach the probe. Each call hits up to 5 providers in parallel,
 * bounded by their per-fetch timeout (~6–8 s) so the overall
 * response is also bounded.
 *
 * Phase 2 covers Library only; future modules with their own
 * providers (audio-visual when it lands) get an extra entry in the
 * response `data` array without touching the route.
 */
export const adminSourcesRoutes = makeAuthedRouter();

const adminMiddlewares = [requireUser, requireAdmin];

const sourcesRoute = createRoute({
  method: 'get',
  path: '/sources',
  tags: ['admin-sources'],
  summary: 'Probe external metadata providers',
  middleware: adminMiddlewares,
  responses: {
    200: jsonContent(AdminSourcesResponseSchema, 'Sources health snapshot'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

adminSourcesRoutes.openapi(sourcesRoute, async (c) => {
  const library = await probeLibraryProviders();
  // Uniform `{ data, meta }` envelope (audit API-06). `data` flattens
  // every source across every module; each `SourceHealth.module` lets
  // the client group by module without the server having to nest.
  // `meta.generatedAt` carries the single timestamp the batch ran at.
  const response: AdminSourcesResponse = {
    data: [...library],
    meta: { generatedAt: new Date().toISOString() },
  };
  return c.json(response, 200);
});
