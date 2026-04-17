import { MoodPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

export const moodClient = createCollectionClient('mood', MoodPayloadSchema);
