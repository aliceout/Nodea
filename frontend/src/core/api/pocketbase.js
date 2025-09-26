import PocketBase from "pocketbase";
// Client PocketBase centralisé
// - Base URL résolue par priorité: VITE_API_URL > VITE_PB_URL > window.location.origin
// - Exporte: instance pb, getCurrentUser(), updateUser(partial)

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
