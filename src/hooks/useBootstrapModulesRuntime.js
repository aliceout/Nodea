// src/hooks/useBootstrapModulesRuntime.js
import { useEffect } from "react";
import pb from "@/services/pocketbase";
import { loadModulesConfig } from "@/services/modules-config";
import { setModulesState } from "@/store/modulesRuntime";
import { useMainKey } from "@/hooks/useMainKey";

/**
 * Monte la config modules déchiffrée dans le store runtime
 * dès que l'utilisateur est connecté et que mainKey est dispo.
 */
export default function useBootstrapModulesRuntime() {
  const { mainKey } = useMainKey();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const user = pb?.authStore?.model;
      if (!user || !mainKey) return;

      try {
        const cfg = await loadModulesConfig(pb, user.id, mainKey); // objet DÉCHIFFRÉ
        if (!cancelled) {
          setModulesState(cfg || {});
        }
      } catch (e) {
        if (import.meta.env.DEV)
          console.warn("[ModulesBootstrap] load error:", e);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mainKey]);
}
