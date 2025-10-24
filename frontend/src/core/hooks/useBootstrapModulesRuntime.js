import { useEffect } from "react";
import pb from "@/core/api/pocketbase";
import { loadModulesConfig } from "@/core/api/modules-config";
import { setModulesState } from "@/core/store/modulesRuntime";
import { KeyMissingError } from "@/core/crypto/webcrypto";
import { useStore } from "@/core/store/StoreProvider";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

/**
 * Monte la config modules déchiffrée dans le store runtime
 * dès que l'utilisateur est connecté et que mainKey est dispo.
 */
export default function useBootstrapModulesRuntime() {
  const { mainKey } = useStore();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const user = pb?.authStore?.model;
      if (!user || !hasMainKeyMaterial(mainKey)) return;

      try {
        const cfg = await loadModulesConfig(pb, user.id, mainKey); // objet DÉCHIFFRÉ
        if (!cancelled && cfg && Object.keys(cfg).length > 0) {
          setModulesState(cfg);
        }
      } catch (e) {
        if (e instanceof KeyMissingError) {
          if (import.meta.env.DEV)
            console.warn("[ModulesBootstrap] key missing; skip init");
          return;
        }
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
