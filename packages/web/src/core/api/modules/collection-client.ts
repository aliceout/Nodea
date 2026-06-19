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
import type { z } from 'zod';
import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { encryptAESGCM, decryptAESGCM, type AesBlob } from '@/core/crypto/aes';
import { deriveGuard } from '@/core/crypto/guard-derivation';
import {
  BULK_MAX_ENTRIES,
  BULK_TOTAL_PAYLOAD_MAX,
  PAYLOAD_MAX_CHARS,
  type Base64,
  type CipherIV,
  type EncryptedBlob,
} from '@nodea/shared';

export interface EncryptedRecord {
  id: string;
  moduleUserId: string;
  cipherIv: string;
  payload: string;
}

/**
 * Decrypted record handed back to module code. The server-side
 * minimum-readable-surface design dropped per-row timestamps —
 * any `createdAt` / `updatedAt` a module needs lives inside
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
  /** Collection name — sent as the `X-Collection` header (issue #67).
   *  The server uses it to look up the target table ; moving it out
   *  of the URL keeps the module identifier out of Nginx access logs
   *  and Hono's default request logger, both of which only record
   *  the request line. */
  collection?: string;
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
  if (options.collection !== undefined) headers['x-collection'] = options.collection;

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
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body means an upstream/proxy error page or a corrupted
      // response — surface a typed error instead of letting a raw
      // SyntaxError escape to the global handler.
      throw Object.assign(
        new Error(`${method} ${path} -> non-JSON response (${res.status})`),
        { status: res.status },
      );
    }
  }
  if (!res.ok) {
    throw Object.assign(new Error(`${method} ${path} -> ${res.status}`), {
      status: res.status,
      payload,
    });
  }
  return payload as T;
}

export interface CollectionClient<TSchema extends z.ZodType> {
  list(moduleUserId: string, key: MainKeyMaterial): Promise<DecryptedRecord<z.infer<TSchema>>[]>;
  create(
    moduleUserId: string,
    key: MainKeyMaterial,
    payload: z.infer<TSchema>,
  ): Promise<DecryptedRecord<z.infer<TSchema>>>;
  /**
   * Batched create — collapses N records into one bulk POST + one
   * bulk-promote round-trip per chunk of {@link BULK_MAX_ENTRIES}.
   *
   * **Atomicity** : each chunk is atomic (server-side transaction). A
   * partial failure across chunks is possible at large N — the caller
   * gets a rejection mid-flight and the previously-committed chunks
   * stay in place. Import / restore flows already accept this : they
   * wrap with their own per-batch try/catch and report progress.
   *
   * Returns the freshly-created records in input order, with `payload`
   * mirrored from the input (the server stores ciphertext verbatim
   * so a re-decrypt round-trip would be wasted work at large N).
   */
  createMany(
    moduleUserId: string,
    key: MainKeyMaterial,
    payloads: ReadonlyArray<z.infer<TSchema>>,
  ): Promise<DecryptedRecord<z.infer<TSchema>>[]>;
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
 * `UpdateEntryBodySchema` enforce server-side: `cipherIv` + `payload`.
 * The earlier `{ iv, data }` keys never matched either schema — every
 * create / update silently 400'd. Renamed once so both `create` and
 * `update` share the right wire format.
 */
function packBlob(blob: AesBlob): { cipherIv: CipherIV; payload: EncryptedBlob } {
  return { cipherIv: blob.iv, payload: blob.data };
}

export function createCollectionClient<TSchema extends z.ZodType>(
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
    // Uniform `{ data, meta }` envelope (audit API-06). The factory
    // ignores `meta` for now — it's reserved for future per-list
    // metadata that doesn't belong inside the encrypted payload.
    const { data } = await request<{ data: EncryptedRecord[]; meta: Record<string, unknown> }>(
      'GET',
      `/records`,
      { sid: moduleUserId, collection: collectionName },
    );
    return Promise.all(
      data.map(async (r) => ({
        id: r.id,
        moduleUserId: r.moduleUserId,
        payload: await decodePayload(key, r.cipherIv, r.payload),
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
      `/records`,
      {
        collection: collectionName,
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
      `/records/${encodeURIComponent(created.id)}`,
      { sid: moduleUserId, guard: 'init', collection: collectionName, body: { guard } },
    );
    return {
      id: promoted.id,
      moduleUserId: promoted.moduleUserId,
      payload: await decodePayload(key, promoted.cipherIv, promoted.payload),
    };
  }

  async function createMany(
    moduleUserId: string,
    key: MainKeyMaterial,
    payloads: ReadonlyArray<Payload>,
  ): Promise<DecryptedRecord<Payload>[]> {
    if (payloads.length === 0) return [];
    const results: DecryptedRecord<Payload>[] = [];

    interface PendingEntry {
      payload: Payload;
      blob: AesBlob;
      size: number;
    }
    let pending: PendingEntry[] = [];
    let pendingSize = 0;

    /** POST the currently-pending chunk + promote its guards, then
     *  reset. Called when adding the next entry would cross the count
     *  or size cap, and once at the end for the trailing chunk. */
    async function flushChunk(): Promise<void> {
      if (pending.length === 0) return;
      const created = await request<{ data: EncryptedRecord[] }>(
        'POST',
        `/records/bulk`,
        {
          collection: collectionName,
          body: {
            sid: moduleUserId,
            entries: pending.map((e) => packBlob(e.blob)),
          },
        },
      );
      const rows = created.data;
      if (rows.length !== pending.length) {
        throw new Error('bulk_create_response_mismatch');
      }
      const promotions = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          guard: await deriveGuard(key.hmacKey, moduleUserId, r.id),
        })),
      );
      await request<{ promoted: number }>('POST', `/records/promote-guards`, {
        collection: collectionName,
        body: { sid: moduleUserId, promotions },
      });
      // Server stores ciphertext verbatim — input payload === output
      // payload semantically, so we skip the decrypt + JSON.parse
      // round-trip the single-create path does. Keeps a 100-row import
      // from running 100 unnecessary AES-GCM decrypts.
      for (let i = 0; i < pending.length; i += 1) {
        const row = rows[i]!;
        results.push({
          id: row.id,
          moduleUserId: row.moduleUserId,
          payload: pending[i]!.payload,
        });
      }
      pending = [];
      pendingSize = 0;
    }

    // Encrypt in mini-batches of `BULK_MAX_ENTRIES` so AES-GCM stays
    // parallelized while the in-flight memory stays bounded (a 3000-
    // entry Journal import doesn't try to hold every encrypted blob
    // at once).
    //
    // Inside each mini-batch we stream the encrypted blobs into a
    // pending list and flush as soon as adding the next one would
    // overflow either the count cap (BULK_MAX_ENTRIES) OR the size cap
    // (BULK_TOTAL_PAYLOAD_MAX). This is what makes the same
    // `createMany` work for tiny Mood entries (count-bound) and for
    // Journal entries with inline images (size-bound).
    for (let off = 0; off < payloads.length; off += BULK_MAX_ENTRIES) {
      const batch = payloads.slice(off, off + BULK_MAX_ENTRIES);
      const blobs = await Promise.all(batch.map((p) => encodePayload(key, p)));
      for (let i = 0; i < blobs.length; i += 1) {
        const blob = blobs[i]!;
        const payload = batch[i]!;
        const size = blob.iv.length + blob.data.length;

        // A single entry whose ciphertext exceeds the SERVER'S
        // per-record cap can never be accepted — refuse it up front
        // with an actionable message rather than ship a chunk the
        // server 400s wholesale (audit 2026-06 passe 2 : the check
        // used the 16 MB bulk-total cap, so an 8–16 MB entry passed
        // the client and then failed the whole import chunk on the
        // 8 MB per-row `Base64ish` bound). `blob.data` is the
        // ciphertext the server validates ; the iv is a constant ~24
        // chars on top.
        if (blob.data.length > PAYLOAD_MAX_CHARS) {
          await flushChunk();
          throw new Error(
            `Entry at index ${off + i} is ${blob.data.length} chars after ` +
              `encryption — exceeds the ${PAYLOAD_MAX_CHARS}-char per-record ` +
              `cap. Reduce attachment size or split this record.`,
          );
        }

        if (
          pending.length >= BULK_MAX_ENTRIES ||
          pendingSize + size > BULK_TOTAL_PAYLOAD_MAX
        ) {
          await flushChunk();
        }
        pending.push({ payload, blob, size });
        pendingSize += size;
      }
    }
    await flushChunk();
    return results;
  }

  /**
   * Promotion catch-up (audit 2026-06). `create()` is two round
   * trips : a POST with the constant `guard: 'init'` then a PATCH
   * that promotes it to the derived `g_<hex>`. If the promotion is
   * lost (network drop, tab closed), the row stays on `init`
   * forever — every later mutation 403s because we send the
   * derived guard, and the HMAC tamper protection never applies to
   * that row. On a 403 we attempt the promotion once (only
   * succeeds if the row genuinely still carries `init`) and tell
   * the caller whether a retry makes sense.
   */
  async function tryPromoteStaleInit(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
  ): Promise<boolean> {
    try {
      const guard = await deriveGuard(key.hmacKey, moduleUserId, id);
      await request<EncryptedRecord>(
        'PATCH',
        `/records/${encodeURIComponent(id)}`,
        { sid: moduleUserId, guard: 'init', collection: collectionName, body: { guard } },
      );
      return true;
    } catch {
      // Not an `init` row (or gone) — the original 403 stands.
      return false;
    }
  }

  function isForbidden(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { status?: number }).status === 403
    );
  }

  async function update(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
    payload: Payload,
  ): Promise<DecryptedRecord<Payload>> {
    const guard = await deriveGuard(key.hmacKey, moduleUserId, id);
    const blob = await encodePayload(key, payload);
    const doPatch = () =>
      request<EncryptedRecord>(
        'PATCH',
        `/records/${encodeURIComponent(id)}`,
        { sid: moduleUserId, guard, collection: collectionName, body: packBlob(blob) },
      );
    let updated: EncryptedRecord;
    try {
      updated = await doPatch();
    } catch (err) {
      if (!isForbidden(err)) throw err;
      const promoted = await tryPromoteStaleInit(moduleUserId, key, id);
      if (!promoted) throw err;
      updated = await doPatch();
    }
    return {
      id: updated.id,
      moduleUserId: updated.moduleUserId,
      payload: await decodePayload(key, updated.cipherIv, updated.payload),
    };
  }

  async function remove(
    moduleUserId: string,
    key: MainKeyMaterial,
    id: string,
  ): Promise<void> {
    const guard = await deriveGuard(key.hmacKey, moduleUserId, id);
    const doDelete = () =>
      request<void>(
        'DELETE',
        `/records/${encodeURIComponent(id)}`,
        { sid: moduleUserId, guard, collection: collectionName },
      );
    try {
      await doDelete();
    } catch (err) {
      if (!isForbidden(err)) throw err;
      const promoted = await tryPromoteStaleInit(moduleUserId, key, id);
      if (!promoted) throw err;
      await doDelete();
    }
  }

  return { list, create, createMany, update, remove };
}
