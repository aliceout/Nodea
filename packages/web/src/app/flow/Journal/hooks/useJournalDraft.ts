import { useCallback, useEffect, useRef, useState } from 'react';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import type {
  Base64,
  CipherIV,
  EncryptedBlob,
  PassageAttachment,
} from '@nodea/shared';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { useNodeaStore, selectMainKey } from '@/core/store/nodea-store';

/**
 * Auto-save for in-progress journal drafts.
 *
 * Stored encrypted in localStorage under a single slot
 * `nodea:journal:draft:new` — the Composer is single-instance, the
 * draft only matters for « new entry » flows (the edit path
 * loads from the server record, not a draft). On a successful
 * save the slot is wiped so the next open starts fresh.
 *
 * Mirrors the Review draft pattern (`Review/hooks/useDraft.ts`) —
 * if we end up with a third site we should factor a generic
 * `useEncryptedDraft<T>(slot, key)` hook. Two sites is borderline;
 * keeping each module's wrapper local for now keeps the storage
 * key + payload shape obvious.
 */

const DEBOUNCE_MS = 800;
const STORAGE_KEY = 'nodea:journal:draft:new';

export interface JournalDraftPayload {
  thread: string;
  content: string;
  attachments: PassageAttachment[];
}

async function encode(
  key: MainKeyMaterial,
  payload: JournalDraftPayload,
): Promise<string> {
  const blob = await encryptAESGCM(JSON.stringify(payload), key.aesKey);
  return JSON.stringify({ iv: blob.iv, data: blob.data, savedAt: Date.now() });
}

async function decode(
  key: MainKeyMaterial,
  raw: string,
): Promise<JournalDraftPayload | null> {
  try {
    const parsed = JSON.parse(raw) as { iv: string; data: string };
    const plain = await decryptAESGCM(
      {
        iv: parsed.iv as Base64 as CipherIV,
        data: parsed.data as Base64 as EncryptedBlob,
      },
      key.aesKey,
    );
    return JSON.parse(plain) as JournalDraftPayload;
  } catch {
    // Same fall-through as the Goals draft : stored slot decrypts
    // under a stale key or the JSON shape changed. Drop silently
    // and let the user start fresh — losing an in-progress draft
    // is acceptable next to mounting an inconsistent form.
    return null;
  }
}

export interface JournalDraftControls {
  /** Decrypted draft pulled from localStorage on mount, or null if
   *  nothing is stored / decryption failed. */
  hydrated: JournalDraftPayload | null;
  hydrating: boolean;
  save(payload: JournalDraftPayload): void;
  clear(): void;
}

export function useJournalDraft(): JournalDraftControls {
  const mainKey = useNodeaStore(selectMainKey);
  const [hydrated, setHydrated] = useState<JournalDraftPayload | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const pending = useRef<JournalDraftPayload | null>(null);
  const timer = useRef<number | null>(null);

  // Hydrate once per mount (or when the AES key arrives — happens
  // when a re-auth surfaces the key after the form was already
  // mounted).
  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    setHydrated(null);
    if (!mainKey) {
      setHydrating(false);
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
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
  }, [mainKey]);

  const flush = useCallback(async () => {
    if (!mainKey) return;
    const payload = pending.current;
    if (!payload) return;
    // Wipe slot on empty draft so we don't keep a never-ending
    // « brouillon en cours » that's just whitespace.
    if (
      payload.thread.trim() === '' &&
      payload.content.trim() === '' &&
      payload.attachments.length === 0
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const encoded = await encode(mainKey, payload);
    localStorage.setItem(STORAGE_KEY, encoded);
  }, [mainKey]);

  const save = useCallback(
    (payload: JournalDraftPayload) => {
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
    localStorage.removeItem(STORAGE_KEY);
    setHydrated(null);
  }, []);

  // Flush on unmount so a quick close after typing doesn't lose
  // the last keystrokes.
  useEffect(() => {
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  return { hydrated, hydrating, save, clear };
}
