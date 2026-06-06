/**
 * HRT typed API clients.
 *
 * Where it sits : the web data-access layer. Two `createCollectionClient`
 * instances — one per HRT collection — give the module CRUD + the full
 * encrypt → create → guard-promote → decrypt round-trip for free,
 * exactly like `mood.ts`. Components never call these directly; the
 * module context (`app/flow/HRT`) wraps them.
 *
 *   - `hrtAdminLogsClient`  → `hrt-admin-logs`  (dose / injection log)
 *   - `hrtLabResultsClient` → `hrt-lab-results` (lab marker readings)
 *   - `hrtProductsClient`   → `hrt-suppliers`   (product catalog — the
 *     wire name stays `hrt-suppliers`, the domain concept is « product »)
 */
import {
  HrtAdminLogPayloadSchema,
  HrtLabResultPayloadSchema,
  HrtProductPayloadSchema,
} from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

export const hrtAdminLogsClient = createCollectionClient(
  'hrt-admin-logs',
  HrtAdminLogPayloadSchema,
);

export const hrtLabResultsClient = createCollectionClient(
  'hrt-lab-results',
  HrtLabResultPayloadSchema,
);

// Wire name kept as `hrt-suppliers` (created in migration 0018) — see
// the schema note ; renaming the table is a destructive migration for
// an internal-only identifier.
export const hrtProductsClient = createCollectionClient(
  'hrt-suppliers',
  HrtProductPayloadSchema,
);
