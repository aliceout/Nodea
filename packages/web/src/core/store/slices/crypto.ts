/**
 * Crypto slice — in-memory main key material + status.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 * The slice never persists key material : `localStorage` is forbidden
 * (cf. nodea.app/docs/security/tech, "no key material at rest"). Logout calls `resetAll`
 * which drops the reference and lets GC collect the bytes.
 */
import type { StateCreator } from 'zustand';
import type { MainKeyMaterial } from '../../crypto/key-material.ts';
import type { NodeaState } from '../nodea-store.ts';

export type KeyStatus = 'idle' | 'ready' | 'missing' | 'error';

export interface CryptoSlice {
  crypto: {
    status: KeyStatus;
    main: MainKeyMaterial | null;
  };
  setMainKey(material: MainKeyMaterial | null): void;
  markKeyMissing(): void;
}

export const emptyCrypto: CryptoSlice['crypto'] = { status: 'idle', main: null };

export const createCryptoSlice: StateCreator<NodeaState, [], [], CryptoSlice> = (set) => ({
  crypto: emptyCrypto,
  setMainKey: (material) =>
    set({
      crypto: material
        ? { status: 'ready', main: material }
        : { status: 'idle', main: null },
    }),
  markKeyMissing: () => set({ crypto: { status: 'missing', main: null } }),
});
