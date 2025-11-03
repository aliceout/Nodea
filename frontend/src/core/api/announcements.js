/**
 * CRUD helpers around the PocketBase `announcements` collection.
 * Handles basic validation and consistent error conversion.
 */
import pb from "./pocketbase";

/**
 * Convert unknown error payloads into a human readable string.
 *
 * @param {unknown} error - Arbitrary error value.
 * @returns {string} Safe error message.
 */
function ensureErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Fetch a paginated list of announcements ordered by publication date.
 *
 * @param {{limit?: number, sort?: string, throwOnError?: boolean}} [options] - Query fine tuning.
 * @returns {Promise<Array<Record<string, any>>>} PocketBase records (empty array on failure).
 * @throws {Error} When `throwOnError` is true and the query fails.
 */
export async function listAnnouncements({
  limit = 5,
  sort = "-published_at,-created",
  throwOnError = false,
} = {}) {
  try {
    const records = await pb.collection("announcements").getList(1, limit, {
      sort,
      $autoCancel: false,
    });
    return Array.isArray(records?.items) ? records.items : [];
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("listAnnouncements failed:", ensureErrorMessage(error));
    }
    if (throwOnError) {
      const message = ensureErrorMessage(error);
      throw new Error(message);
    }
    return [];
  }
}

/**
 * Create a published announcement with sane defaults for missing fields.
 *
 * @param {{title?: string, message?: string, published?: boolean, publishedAt?: string}} input - Announcement fields.
 * @returns {Promise<Record<string, any>>} The created PocketBase record.
 */
export async function createAnnouncement(input) {
  const payload = {
    title: input?.title ?? "",
    message: input?.message ?? "",
    published: input?.published ?? true,
    published_at: input?.publishedAt ?? new Date().toISOString(),
  };

  try {
    return await pb.collection("announcements").create(payload);
  } catch (error) {
    const message = ensureErrorMessage(error);
    throw new Error(message);
  }
}

/**
 * Delete an announcement record.
 *
 * @param {string} id - PocketBase record identifier.
 * @returns {Promise<void>}
 */
export async function deleteAnnouncement(id) {
  if (!id) throw new Error("id requis pour deleteAnnouncement");
  try {
    await pb.collection("announcements").delete(id);
  } catch (error) {
    const message = ensureErrorMessage(error);
    throw new Error(message);
  }
}
