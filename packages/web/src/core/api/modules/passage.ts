import { PassagePayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

export const passageClient = createCollectionClient('passage', PassagePayloadSchema);
