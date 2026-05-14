import { JournalPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

export const journalClient = createCollectionClient('journal', JournalPayloadSchema);
