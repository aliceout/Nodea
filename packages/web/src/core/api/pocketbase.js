/**
 * Centralised PocketBase client shared across the app. The base URL is resolved with
 * the following priority: `VITE_API_URL` → `VITE_PB_URL` → `window.location.origin`.
 * Callers can import the default `pb` instance or rely on the helper utilities below.
 */
import PocketBase from "pocketbase";

const baseUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_PB_URL ||
  window.location.origin
).replace(/\/$/, "");

const pb = new PocketBase(baseUrl);
export default pb;

/**
 * Retrieve the authenticated user model from the shared PocketBase client.
 *
 * @returns {import("pocketbase").RecordModel | null} The current user or null when unauthenticated.
 */
export function getCurrentUser() {
  return pb.authStore.model;
}

/**
 * Patch the authenticated user record with the provided partial payload.
 *
 * @param {Record<string, any>} partial - Fields to update on the user document.
 * @returns {Promise<import("pocketbase").RecordModel>} The updated user record.
 * @throws {Error} When no user is authenticated.
 */
export async function updateUser(partial) {
  const user = getCurrentUser();
  if (!user?.id) throw new Error("No authenticated user");
  return pb.collection("users").update(user.id, partial);
}

// --- Exemples d'utilisation ---
// (1) Lire l'utilisateur courant
//   const me = getCurrentUser();
//   console.log(me?.email);
//
// (2) Mettre à jour un champ utilisateur
//   await updateUser({ displayName: "Alice" });
//
// (3) Base URL utilisée
//   // priorités: VITE_API_URL > VITE_PB_URL > window.location.origin
