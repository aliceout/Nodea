// frontend/src/features/Account/components/DeleteAccount.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import pb from "@/core/api/pocketbase";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Button from "@/ui/atoms/base/Button";
import { MODULES } from "@/app/config/modules_list";
import { loadModulesConfig } from "@/core/api/modules-config";
import { deriveGuard } from "@/core/crypto/guards";
import { useStore } from "@/core/store/StoreProvider";

/**
 * Helper: liste toutes les entrées d'une collection pour un sid donné,
 * en respectant la listRule: @request.query.sid = module_user_id.
 */
async function listAllBySid(collection, sid, perPage = 200) {
  const items = [];
  let page = 1;

  while (true) {
    const url =
      `/api/collections/${collection}/records` +
      `?page=${page}&perPage=${perPage}&sort=+created&sid=${encodeURIComponent(
        sid
      )}`;
    const res = await pb.send(url, { method: "GET" });
    const batch = res?.items || [];
    if (!batch.length) break;
    items.push(...batch);
    const total = res?.totalItems ?? items.length;
    if (page * perPage >= total) break;
    page += 1;
  }
  return items;
}

/**
 * Helper: supprime 1 record avec guard calculé ; retry d=init si nécessaire.
 */
async function deleteOneWithGuard(collection, sid, id, guard) {
  const url =
    `/api/collections/${collection}/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(sid)}&d=${encodeURIComponent(guard)}`;
  return pb.send(url, { method: "DELETE" });
}

export default function DeleteAccountSection({ user }) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();
  const { mainKey } = useStore();

  const handleDelete = async () => {
    setDeleteError("");

    const confirmed = window.confirm(
      "Attention : cette action est irréversible. Supprimer définitivement ce compte et toutes les données associées ?"
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const effectiveKey = mainKey || window.mainKey || null;
      if (!effectiveKey) {
        throw new Error(
          "Clé principale manquante : impossible de calculer les guards."
        );
      }
      const currentUser = pb?.authStore?.model;
      if (!currentUser?.id || currentUser.id !== user?.id) {
        throw new Error("Utilisateur non authentifié.");
      }

      let modulesCfg = {};
      try {
        modulesCfg = await loadModulesConfig(pb, user.id, effectiveKey);
      } catch (error) {
        console.warn("[DeleteAccount] loadModulesConfig failed:", error);
      }

      for (const mod of MODULES) {
        if (!mod?.collection || !mod?.id) continue;

        const modCfg = modulesCfg[mod.id];
        const sid = modCfg?.module_user_id;
        if (!sid) continue;

        const records = await listAllBySid(mod.collection, sid);

        for (const record of records) {
          const guard = await deriveGuard(effectiveKey, sid, record.id);
          try {
            await deleteOneWithGuard(mod.collection, sid, record.id, guard);
          } catch (_guardErr) {
            try {
              await deleteOneWithGuard(mod.collection, sid, record.id, "init");
            } catch (fallbackErr) {
              console.error(
                `[DeleteAccount] DELETE failed for ${mod.collection}/${record.id}`,
                fallbackErr
              );
              throw fallbackErr;
            }
          }
        }

        const remaining = await listAllBySid(mod.collection, sid);
        if (remaining.length !== 0) {
          throw new Error(
            `Purge incomplète dans ${mod.collection} (sid=${sid}): ${remaining.length} restant(s)`
          );
        }
      }

      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch (err) {
      console.error("Delete account failed:", err);
      setDeleteError(
        err?.message ||
          "Erreur lors de la suppression du compte et des données."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SurfaceCard className="bg-rose-50 border-rose-300">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-rose-700 mb-1">
          Supprimer mon compte
        </div>
        <div className="text-sm text-rose-700">
          La suppression est <strong>définitive</strong>. Toutes les données
          associées à ce compte seront perdues.
        </div>
      </div>

      <form className="w-full flex gap-6">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleDelete}
            className="bg-nodea-blush-dark !important font-semibold hover:bg-nodea-blush-darker !important"
            disabled={deleting}
          >
            {deleting ? "Suppression en cours..." : "Supprimer mon compte"}
          </Button>
        </div>

        {deleteError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center"
          >
            {deleteError}
          </div>
        )}
      </form>
    </SurfaceCard>
  );
}
