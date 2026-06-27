/**
 * Backup slice — progress of an in-flight cloud-backup push.
 *
 * Sits inside `useNodeaStore` (slice pattern, ADR-0013). Purely in-memory and
 * ephemeral: it drives the sidebar progress card while a push runs. Not
 * persisted, reset on logout.
 *
 * `backupProgress` is `null` when idle, else a real `0..1` fraction — NOT a
 * faked creep. `cloud-push.ts` advances it on actual events (each module
 * collected, then the seal + upload milestones), so the bar reflects work
 * genuinely done.
 */
import type { StateCreator } from 'zustand';
import type { NodeaState } from '../nodea-store.ts';

export interface BackupSlice {
  /** `null` = idle (card hidden); `0..1` = running at that fraction. */
  backupProgress: number | null;
  setBackupProgress(progress: number | null): void;
}

export const createBackupSlice: StateCreator<NodeaState, [], [], BackupSlice> = (
  set,
) => ({
  backupProgress: null,
  setBackupProgress: (backupProgress) => set({ backupProgress }),
});
