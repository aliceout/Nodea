/**
 * Generic client for any encrypted collection on the new Hono API.
 *
 * Handles the full round-trip:
 *   - encrypt → POST create → derive guard → PATCH promote → return id
 *   - list → decrypt every payload → return typed items
 *   - update: derive guard → encrypt new payload → PATCH
 *   - delete: derive guard → DELETE
 *
 * Each module wraps this with a Zod payload schema for its own types.
 * The generic here does not know the payload shape; that's the point —
 * new modules (Habits, Library, Review) will reuse this verbatim.
 */
import type { ZodTypeAny, z } from 'zod';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { encryptAESGCM, decryptAESGCM, type AesBlob } from '@/core/crypto/aes';
import { deriveGuard } from '@/core/crypto/guard-derivation';
import type { Base64, CipherIV, EncryptedBlob } from '@nodea/shared';

export interface EncryptedRecord {
  id: string;
  module_user_id: string;
  cipher_iv: string;
  payload: string;
}

/**
 * Decrypted record handed back to module code. The server-side
 * minimum-readable-surface design dropped per-row timestamps —
 * any `created_at` / `updated_at` a module needs lives inside
 * the encrypted payload (`T`). Module clients that want
 * chronological ordering pull dates from `payload.*` after
 * decryption rather than from the wrapper.
 */
export interface DecryptedRecord<T> {
  id: string;
  moduleUserId: string;
  payload: T;
}

/**
 * Base URL resolver — same policy as the auth client. Kept separate to
 * avoid an import cycle with `core/api/client.ts`.
 */
function apiBase(): string {
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api'
  );
}

interface RequestOptions {
  body?: unknown;
  /** Module-user scope id — sent as the `X-Sid` header so the
   *  identifier never lands in `hono/logger()` output, nginx access
   *  logs, or browser referrers (SEC-01). */
  sid?: string;
  /** HMAC guard for mutations — sent as the `X-Guard` header for
   *  the same reason as `sid`. The guard IS crypto material derived
   *  from the user's main key ; it MUST NOT travel through URLs. */
  guard?: string;
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.sid !== undefined) headers['x-sid'] = options.sid;
  if (options.guard !== undefined) headers['x-guard'] = options.guard;

  const init: RequestInit = {
    method,
    credentials: 'include',
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  };
  const res = await fetch(`${apiBase()}${path}`, init);
  const text = await res.text();
  const payload: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw Object.assign(new Error(`${method} ${path} -> ${res.status}`), {
      status: res.status,
      payload,
    });
  }
  return payload as T;
}

export interface CollectionClient<TSchema extends ZodTypeAny> {
  list(moduleUserId: string, key: MainKeyMaterial): Promise<DecryptedRecord<z.infer<TSchema>>[]>;
  create(
    moduleUserId: string,
    key: MainKeyMaterial,
    payload: z.infer<TSchema>,
  ): Promise<DecryptedRecord<z.infer<TSchema>>>;
  update(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
    payload: z.infer<TSchema>,
  ): Promise<DecryptedRecord<z.infer<TSchema>>>;
  remove(moduleUserId: string, key: MainKeyMaterial, id: string): Promise<void>;
}

/**
 * Pack an `AesBlob` into the request shape `CreateEntryBodySchema` /
 * `UpdateEntryBodySchema` enforce server-side: `cipher_iv` + `payload`.
 * The earlier `{ iv, data }` keys never matched either schema — every
 * create / update silently 400'd. Renamed once so both `create` and
 * `update` share the right wire format.
 */
function packBlob(blob: AesBlob): { cipher_iv: CipherIV; payload: EncryptedBlob } {
  return { cipher_iv: blob.iv, payload: blob.data };
}

export function createCollectionClient<TSchema extends ZodTypeAny>(
  collectionName: string,
  schema: TSchema,
): CollectionClient<TSchema> {
  type Payload = z.infer<TSchema>;

  async function encodePayload(key: MainKeyMaterial, payload: Payload): Promise<AesBlob> {
    const parsed = schema.parse(payload) as Payload;
    return encryptAESGCM(JSON.stringify(parsed), key.aesKey);
  }

  async function decodePayload(key: MainKeyMaterial, iv: string, data: string): Promise<Payload> {
    const plain = await decryptAESGCM(
      { iv: iv as Base64 as CipherIV, data: data as Base64 as EncryptedBlob },
      key.aesKey,
    );
    return schema.parse(JSON.parse(plain)) as Payload;
  }

  async function list(
    moduleUserId: string,
    key: MainKeyMaterial,
  ): Promise<DecryptedRecord<Payload>[]> {
    const { records } = await request<{ records: EncryptedRecord[] }>(
      'GET',
      `/${collectionName}/records`,
      { sid: moduleUserId },
    );
    return Promise.all(
      records.map(async (r) => ({
        id: r.id,
        moduleUserId: r.module_user_id,
        payload: await decodePayload(key, r.cipher_iv, r.payload),
      })),
    );
  }

  async function create(
    moduleUserId: string,
    key: MainKeyMaterial,
    payload: Payload,
  ): Promise<DecryptedRecord<Payload>> {
    const blob = await encodePayload(key, payload);
    const created = await request<EncryptedRecord>(
      'POST',
      `/${collectionName}/records`,
      {
        body: {
          sid: moduleUserId,
          ...packBlob(blob),
          guard: 'init',
        },
      },
    );

    // Immediate promotion init → g_<hex>.
    const guard = await deriveGuard(key.hmacKey, moduleUserId, created.id);
    const promoted = await request<EncryptedRecord>(
      'PATCH',
      `/${collectionName}/records/${encodeURIComponent(created.id)}`,
      { sid: moduleUserId, guard: 'init', body: { guard } },
    );
    return {
      id: promoted.id,
      moduleUserId: promoted.module_user_id,
      payload: await decodePayload(key, promoted.cipher_iv, promoted.payload),
    };
  }

  async function update(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
    payload: Payload,
  ): Promise<DecryptedRecord<Payload>> {
    const guard = await deriveGuard(key.hmacKey, moduleUserId, id);
    const blob = await encodePayload(key, payload);
    const updated = await request<EncryptedRecord>(
      'PATCH',
      `/${collectionName}/records/${encodeURIComponent(id)}`,
      { sid: moduleUserId, guard, body: packBlob(blob) },
    );
    return {
      id: updated.id,
      moduleUserId: updated.module_user_id,
      payload: await decodePayload(key, updated.cipher_iv, updated.payload),
    };
  }

  async function remove(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
  ): Promise<void> {
    const guard = await deriveGuard(key.hmacKey, moduleUserId, id);
    await request<void>(
      'DELETE',
      `/${collectionName}/records/${encodeURIComponent(id)}`,
      { sid: moduleUserId, guard },
    );
  }

  return { list, create, update, remove };
}
