import { GoalsPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

export const goalsClient = createCollectionClient('goals', GoalsPayloadSchema);
