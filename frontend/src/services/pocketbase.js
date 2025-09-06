import PocketBase from "pocketbase";

// VITE_API_URL prioritaire, puis VITE_PB_URL, sinon origin
const baseUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_PB_URL ||
  window.location.origin
).replace(/\/$/, "");

const pb = new PocketBase(baseUrl);
export default pb;

export function getCurrentUser() {
    return pb.authStore.model;
}

export async function updateUser(partial) {
    const user = getCurrentUser();
    if (!user?.id) throw new Error("No authenticated user");
    return pb.collection('users').update(user.id, partial);
}
