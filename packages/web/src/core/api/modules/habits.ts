import { HabitsItemPayloadSchema, HabitsLogPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

/** Habit definitions (title, category, frequency, target…). */
export const habitsItemsClient = createCollectionClient('habits-items', HabitsItemPayloadSchema);

/** Habit occurrences ("did X on date Y"). */
export const habitsLogsClient = createCollectionClient('habits-logs', HabitsLogPayloadSchema);
