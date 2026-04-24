import { useCallback, useEffect, useRef, useState } from 'react';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import type { Base64, CipherIV, EncryptedBlob } from '@nodea/shared';
import { useNodeaStore, selectMainKey } from '@/core/store/nodea-store';
import type { ReviewPayload } from '@nodea/shared';

/**
 * Auto-save for in-progress review drafts.
 *
 * The draft never touches localStorage in clear: payload is encrypted
 * with the user's AES key before write, and decrypted on read. If the
 * stored ciphertext can't be decoded with the current key (stale, wrong
 * user), we silently drop it — the user gets a fresh start.
 *
 * Storage key layout: `nodea:review:draft:<year>`. Keeping separate
 * slots per year lets the user step between drafts without collisions.
 */

const DEBOUNCE_MS = 800;

function storageKey(year: number): string {
  return `nodea:review:draft:${year}`;
}

async function encode(key: MainKeyMaterial, payload: ReviewPayload): Promise<string> {
  const blob = await encryptAESGCM(JSON.stringify(payload), key.aesKey);
  return JSON.stringify({ iv: blob.iv, data: blob.data });
}

async function decode(key: MainKeyMaterial, raw: string): Promise<ReviewPayload | null> {
  try {
    const parsed = JSON.parse(raw) as { iv: string; data: string };
    const plain = await decryptAESGCM(
      { iv: parsed.iv as Base64 as CipherIV, data: parsed.data as Base64 as EncryptedBlob },
      key.aesKey,
    );
    return JSON.parse(plain) as ReviewPayload;
  } catch {
    return null;
  }
}

export interface DraftControls {
  /** Last successfully persisted draft for this year, or null. */
  hydrated: ReviewPayload | null;
  /** True until we've checked the store once on mount. */
  hydrating: boolean;
  save(payload: ReviewPayload): void;
  clear(): void;
  saving: boolean;
  lastSavedAt: number | null;
}

export function useDraft(year: number): DraftControls {
  const mainKey = useNodeaStore(selectMainKey);
  const [hydrated, setHydrated] = useState<ReviewPayload | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const pending = useRef<ReviewPayload | null>(null);
  const timer = useRef<number | null>(null);

  // Hydrate once per (key, year) change.
  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    setHydrated(null);
    if (!mainKey) {
      setHydrating(false);
      return;
    }
    const raw = localStorage.getItem(storageKey(year));
    if (!raw) {
      setHydrating(false);
      return;
    }
    void decode(mainKey, raw).then((p) => {
      if (cancelled) return;
      setHydrated(p);
      setHydrating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mainKey, year]);

  const flush = useCallback(async () => {
    if (!mainKey) return;
    const payload = pending.current;
    if (!payload) return;
    setSaving(true);
    try {
      const encoded = await encode(mainKey, payload);
      localStorage.setItem(storageKey(year), encoded);
      setLastSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [mainKey, year]);

  const save = useCallback(
    (payload: ReviewPayload) => {
      pending.current = payload;
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  const clear = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    pending.current = null;
    localStorage.removeItem(storageKey(year));
    setHydrated(null);
    setLastSavedAt(null);
  }, [year]);

  // On unmount, flush any pending save synchronously.
  useEffect(() => {
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  return { hydrated, hydrating, save, clear, saving, lastSavedAt };
}
