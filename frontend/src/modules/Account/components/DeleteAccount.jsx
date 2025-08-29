// frontend/src/modules/Account/components/DeleteAccount.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import pb from "@/services/pocketbase";
import SettingsCard from "@/components/shared/SettingsCard";
import Button from "@/components/common/Button";
import { MODULES } from "@/config/modules_list";
import { loadModulesConfig } from "@/services/modules-config";
import { deriveGuard } from "@/modules/Mood/data/moodEntries";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { useMainKey } from "@/hooks/useMainKey";

/**
 * Helper: liste toutes les entrées d'une collection pour un sid donné,
 * en respectant la listRule: @request.query.sid = module_user_id.
 * (On DOIT passer par pb.send pour injecter ?sid=… dans l'URL.)
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
    if (batch.length === 0) break;
    items.push(...batch);
    const total = res?.totalItems ?? items.length;
    if (page * perPage >= total) break;
    page += 1;
  }
  return items;
}

/**
 * Helper: supprime 1 record avec guard calculé ; retry d=init si nécessaire.
 * deleteRule: @request.query.sid = module_user_id && @request.query.d = guard
 * (guard = g_… ou, cas legacy non-promu, "init")
 */
async function deleteOneWithGuard(collection, sid, id, guard) {
  const url =
    `/api/collections/${collection}/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(sid)}&d=${encodeURIComponent(guard)}`;
  const res = await pb.send(url, { method: "DELETE" });
  // pb.send renvoie généralement {} avec status 204 côté SDK; on tolère l'absence de body
  return res;
}

export default function DeleteAccountSection({ user }) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();
  const { mainKey, markMissing } = useStore();
  const modules = useModulesRuntime();
  const sid = modules?.mood?.id || modules?.mood?.module_user_id;

  const handleDelete = async () => {
    setDeleteError("");

    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte et toutes les données associées ?"
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      // 1) Préconditions
      const effectiveKey = mainKey || window.mainKey || null; // fallback si le hook n'a pas encore fourni la clé
      if (!effectiveKey) {
        throw new Error(
          "Clé principale manquante : impossible de calculer les guards."
        );
      }
      const currentUser = pb?.authStore?.model;
      if (!currentUser?.id || currentUser.id !== user?.id) {
        throw new Error("Utilisateur non authentifié.");
      }

      // 2) Charger la config modules -> récupérer module_user_id (sid) par module
      let modulesCfg = {};
      try {
        modulesCfg = await loadModulesConfig(pb, user.id, effectiveKey);
      } catch (e) {
        // On continue même si la config est partielle — on purgera ce qui est connu
        console.warn("[DeleteAccount] loadModulesConfig failed:", e);
      }

      // 3) Purge module par module (uniquement ceux listés dans MODULES avec collection définie)
      for (const mod of MODULES) {
        if (!mod?.collection || !mod?.id) continue;

        const modCfg = modulesCfg[mod.id];
        const sid = modCfg?.module_user_id;
        if (!sid) continue; // module pas activé pour cet utilisateur

        // 3.a) Lister toutes les entrées pour ce sid (OBLIGATOIRE: via ?sid=…)
        const records = await listAllBySid(mod.collection, sid);

        // 3.b) Supprimer chaque record avec d=<guard> (retry d=init si besoin)
        for (const r of records) {
          // guard normal g_… calculé à partir (effectiveKey, sid, id)
          const g = await deriveGuard(effectiveKey, sid, r.id);
          try {
            await deleteOneWithGuard(mod.collection, sid, r.id, g);
          } catch (e) {
            // fallback legacy : record resté en "init" (créé mais non promu)
            try {
              await deleteOneWithGuard(mod.collection, sid, r.id, "init");
            } catch (e2) {
              console.error(
                `[DeleteAccount] DELETE failed for ${mod.collection}/${r.id}`,
                e2
              );
              throw e2;
            }
          }
        }

        // 3.c) Sanity-check: plus rien pour ce sid
        const remaining = await listAllBySid(mod.collection, sid);
        if (remaining.length !== 0) {
          throw new Error(
            `Purge incomplète dans ${mod.collection} (sid=${sid}): ${remaining.length} restant(s)`
          );
        }
      }

      // 4) Supprime l'utilisateur (EN DERNIER)
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
    <SettingsCard className="bg-rose-50 border-rose-300">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-rose-700 mb-1">
          Supprimer mon compte
        </div>
        <div className="text-sm text-rose-700">
          La suppression est <strong>définitive</strong>. Toutes les données
          associées à ce compte seront perdues.
        </div>
      </div>

      <form className="w-full flex  gap-6">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleDelete}
            className="bg-nodea-blush-dark !important font-semibold hover:bg-nodea-blush-darker !important"
            disabled={deleting}
          >
            {deleting ? "Suppression en cours…" : "Supprimer mon compte"}
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
    </SettingsCard>
  );
}
