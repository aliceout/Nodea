import { CyclePayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

/** E2E client for the `cycle` collection — one line on the generic
 *  factory, like every other module (spec `docs/Modules/Cycle.md`). */
export const cycleClient = createCollectionClient('cycle', CyclePayloadSchema);
