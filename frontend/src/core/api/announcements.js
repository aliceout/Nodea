import pb from "./pocketbase";

function ensureErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

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

export async function deleteAnnouncement(id) {
  if (!id) throw new Error("id requis pour deleteAnnouncement");
  try {
    await pb.collection("announcements").delete(id);
  } catch (error) {
    const message = ensureErrorMessage(error);
    throw new Error(message);
  }
}
