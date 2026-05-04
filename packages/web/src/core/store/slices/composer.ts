/**
 * Composer slice — global ⌘K modal state (Direction K).
 *
 * Holds the open flag, the active type-picker selection and an
 * optional `editing` payload that switches the relevant body's save
 * flow from create → update.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type {
  GoalsPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
  MoodPayload,
  PassagePayload,
} from '@nodea/shared';
import type { NodeaState } from '../nodea-store.ts';

/**
 * The five entry archetypes the global composer can capture. Mirrors
 * the `K_Composer` type-picker in `Design/.../dir-k-extras.jsx`. The
 * `note` variant is a free-form journal entry that doesn't bind to
 * any specific module.
 */
export type ComposerType =
  | 'mood'
  | 'goal'
  | 'habit'
  | 'note'
  | 'journal'
  | 'library-item'
  | 'library-review';

/**
 * Discriminated record passed to `openComposer` when editing an
 * existing entry. Each body that supports edit reads the editing
 * slot (narrowed on `type`) and prefills its form. Passages /
 * Habits / Notes stay create-only for now — extend this union when
 * each gets its own rich body + edit flow.
 */
export type ComposerEditing =
  | { type: 'goal'; id: string; payload: GoalsPayload }
  | { type: 'mood'; id: string; payload: MoodPayload }
  | { type: 'journal'; id: string; payload: PassagePayload }
  | { type: 'library-item'; id: string; payload: LibraryItemPayload }
  | {
      type: 'library-review';
      id: string;
      payload: LibraryReviewPayload;
      /** When prefilling a brand-new review for a known item, the
       * editing entry is omitted — but we may still need to know
       * which item the review is being created against. The item
       * version uses `id` for the existing review id when editing,
       * and the body reads `payload.itemRid` from the prefilled
       * payload to pin the relation. */
    };

export interface ComposerSlice {
  composer: {
    open: boolean;
    type: ComposerType;
    /** When set, the matching body prefills its form from the
     * payload and switches its save flow from create → update. */
    editing: ComposerEditing | null;
  };
  openComposer(type?: ComposerType, editing?: ComposerEditing): void;
  closeComposer(): void;
  setComposerType(type: ComposerType): void;
}

export const initialComposer: ComposerSlice['composer'] = {
  open: false,
  type: 'mood',
  editing: null,
};

export const createComposerSlice: StateCreator<NodeaState, [], [], ComposerSlice> = (set) => ({
  composer: initialComposer,
  openComposer: (type, editing) =>
    set((state) => ({
      composer: {
        open: true,
        type: editing?.type ?? type ?? state.composer.type,
        editing: editing ?? null,
      },
    })),
  closeComposer: () =>
    set((state) => ({
      composer: { ...state.composer, open: false, editing: null },
    })),
  setComposerType: (type) =>
    set((state) => ({ composer: { ...state.composer, type, editing: null } })),
});
