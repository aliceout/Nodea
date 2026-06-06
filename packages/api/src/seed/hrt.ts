import {
  HrtAdminLogPayloadSchema,
  HrtLabResultPayloadSchema,
  HrtProductPayloadSchema,
  type HrtAdminLogPayload,
  type HrtLabResultPayload,
  type HrtProductPayload,
} from '@nodea/shared';
import {
  hrtAdminLogsEntries,
  hrtLabResultsEntries,
  hrtSuppliersEntries,
} from '../db/schema.ts';
import {
  ensureModuleUserId,
  replaceEntries,
  type SeedContext,
  type SeedResult,
} from './shared.ts';
import {
  buildHrtAdminLogFixtures,
  buildHrtLabResultFixtures,
  buildHrtProductFixtures,
} from './hrt.fixtures.ts';

/**
 * HRT seed — the module owns two collections but a single module sid
 * (like Library's items/reviews/covers). We resolve the sid once, then
 * wipe + reinsert each collection under it. The two `SeedResult`s are
 * summed so the orchestrator logs one tidy « hrt » line.
 */
export async function seedHrt(ctx: SeedContext): Promise<SeedResult> {
  const sid = await ensureModuleUserId(ctx.user.id, 'hrt', ctx.aesKey);

  const logs: HrtAdminLogPayload[] = buildHrtAdminLogFixtures().map((f) =>
    HrtAdminLogPayloadSchema.parse(f),
  );
  const labs: HrtLabResultPayload[] = buildHrtLabResultFixtures().map((f) =>
    HrtLabResultPayloadSchema.parse(f),
  );
  const products: HrtProductPayload[] = buildHrtProductFixtures().map((f) =>
    HrtProductPayloadSchema.parse(f),
  );

  const a = await replaceEntries(hrtAdminLogsEntries, sid, logs, ctx.aesKey, ctx.hmacKey);
  const b = await replaceEntries(hrtLabResultsEntries, sid, labs, ctx.aesKey, ctx.hmacKey);
  const c = await replaceEntries(hrtSuppliersEntries, sid, products, ctx.aesKey, ctx.hmacKey);

  return {
    cleared: a.cleared + b.cleared + c.cleared,
    inserted: a.inserted + b.inserted + c.inserted,
  };
}
