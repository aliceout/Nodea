import { useCallback, useEffect, useRef, useState } from 'react';
import { encryptAESGCM, decryptAESGCM } from '@/core/crypto/aes';
import type { Base64, CipherIV, EncryptedBlob } from '@nodea/shared';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { useNodeaStore, selectMainKey } from '@/core/store/nodea-store';

/**
 * Auto-save for in-progress goal drafts.
 *
 * Mirrors the Journal / Review draft pattern : a single
 * encrypted slot at `nodea:goals:draft:new`, debounced auto-save
 * at 800 ms, hydrated once on Composer mount. New-entry path
 * only — when editing an existing record the canonical state is
 * the server payload.
 *
 * Three sites now follow this pattern (Review + Journal + Goals).
 * The next time we add one we should factor a generic
 * `useEncryptedDraft<T>(slot)` instead of duplicating the
 * encrypt / debounce / hydrate plumbing — for now keeping the
 * wrappers local keeps each call site's storage key + payload
 * shape obvious.
 */

const DEBOUNCE_MS = 800;
const STORAGE_KEY = 'nodea:goals:draft:new';

export interface GoalDraftPayload {
  title: string;
  month: string;
  year: string;
  status: string;
  thread: string;
  note: string;
}

const EMPTY_DRAFT: GoalDraftPayload = {
  title: '',
  month: '',
  year: '',
  status: 'open',
  thread: '',
  note: '',
};

async function encode(
  key: MainKeyMaterial,
  payload: GoalDraftPayload,
): Promise<string> {
  const blob = await encryptAESGCM(JSON.stringify(payload), key.aesKey);
  return JSON.stringify({ iv: blob.iv, data: blob.data, savedAt: Date.now() });
}

async function decode(
  key: MainKeyMaterial,
  raw: string,
): Promise<GoalDraftPayload | null> {
  try {
    const parsed = JSON.parse(raw) as { iv: string; data: string };
    const plain = await decryptAESGCM(
      {
        iv: parsed.iv as Base64 as CipherIV,
        data: parsed.data as Base64 as EncryptedBlob,
      },
      key.aesKey,
    );
    return JSON.parse(plain) as GoalDraftPayload;
  } catch {
    // Stored slot was written under a previous main key (post
    // password change), or the JSON shape changed across versions.
    // Either way the draft is unrecoverable — drop it silently and
    // start fresh, the user just loses an in-progress entry.
    return null;
  }
}

function isEmpty(d: GoalDraftPayload): boolean {
  return (
    d.title.trim() === '' &&
    d.month === '' &&
    d.year === '' &&
    d.thread.trim() === '' &&
    d.note.trim() === '' &&
    d.status === EMPTY_DRAFT.status
  );
}

export interface GoalDraftControls {
  hydrated: GoalDraftPayload | null;
  hydrating: boolean;
  save(payload: GoalDraftPayload): void;
  clear(): void;
}

export function useGoalDraft(): GoalDraftControls {
  const mainKey = useNodeaStore(selectMainKey);
  const [hydrated, setHydrated] = useState<GoalDraftPayload | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const pending = useRef<GoalDraftPayload | null>(null);
  const timer = useRef<number | null>(null);

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
    if (isEmpty(payload)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const encoded = await encode(mainKey, payload);
    localStorage.setItem(STORAGE_KEY, encoded);
  }, [mainKey]);

  const save = useCallback(
    (payload: GoalDraftPayload) => {
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
