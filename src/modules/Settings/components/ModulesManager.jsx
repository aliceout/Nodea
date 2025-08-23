import React, { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/config/modules_list";
import {
  loadModulesConfig,
  saveModulesConfig,
  getModuleEntry,
  setModuleEntry,
} from "@/services/modules-config";
import { generateModuleUserId, makeGuard } from "@/services/crypto-utils";

import { usePb } from "@/services/usePb";
import { useAuth } from "@/services/useAuth";
import { useMainKey } from "@/services/useMainKey";

function Note({ children }) {
  return <div style={{ fontSize: "0.9em", opacity: 0.9 }}>{children}</div>;
}

export default function ModulesManager() {
  const pb = usePb();
  const { user } = useAuth();
  const { mainKey } = useMainKey();

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState({});
  const [busy, setBusy] = useState(null);
  const [hasDataMap, setHasDataMap] = useState({});

  // Ne garder que les modules désactivables
  const rows = useMemo(
    () => MODULES.filter((m) => m.to_toogle && !!m.collection),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const c = await loadModulesConfig(pb, user.id, mainKey);
      if (mounted) {
        setCfg(c || {});
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pb, user.id, mainKey]);

  useEffect(() => {
    let stop = false;
    (async () => {
      const map = {};
      for (const m of rows) {
        const entry = getModuleEntry(cfg, m.id);
        const sid = entry?.module_user_id || null;
        if (!sid) {
          map[m.id] = false;
          continue;
        }

        try {
          const url = `${pb.baseUrl}/api/collections/${
            m.collection
          }/records?sid=${encodeURIComponent(sid)}&perPage=1`;
          const res = await fetch(url, {
            headers: pb.authStore?.token
              ? { Authorization: pb.authStore.token }
              : {},
          });
          if (!res.ok) {
            map[m.id] = false;
            continue;
          }
          const data = await res.json();
          map[m.id] = (data?.items?.length || 0) > 0;
        } catch {
          map[m.id] = false;
        }
      }
      if (!stop) setHasDataMap(map);
    })();
    return () => {
      stop = true;
    };
  }, [pb, rows, cfg]);

  if (loading) return <div>Chargement…</div>;

  const toggleModule = async (moduleId, nextEnabled) => {
    setBusy(moduleId);
    try {
      const current = getModuleEntry(cfg, moduleId) || {
        enabled: false,
        module_user_id: null,
        guard: null,
        algo: "v1",
      };

      let next = { ...current, enabled: nextEnabled };
      if (nextEnabled) {
        if (!next.module_user_id)
          next.module_user_id = generateModuleUserId("g_");
        if (!next.guard) next.guard = makeGuard();
      }

      const updated = setModuleEntry(cfg, moduleId, next);
      await saveModulesConfig(pb, user.id, mainKey, updated);
      setCfg(updated);
    } finally {
      setBusy(null);
    }
  };

  const hardDeleteData = async (moduleId) => {
    const mod = rows.find((r) => r.id === moduleId);
    const current = getModuleEntry(cfg, moduleId);
    if (!mod || !current?.module_user_id || !current?.guard) return;

    const ok = window.confirm(
      `Suppression définitive des données du module "${mod.label}".\n` +
        `Cette action est IRRÉVERSIBLE.\n\nContinuer ?`
    );
    if (!ok) return;

    setBusy(moduleId);
    try {
      const sid = current.module_user_id;
      const d = current.guard;

      let page = 1;
      let ids = [];
      while (true) {
        const url = `${pb.baseUrl}/api/collections/${
          mod.collection
        }/records?sid=${encodeURIComponent(sid)}&page=${page}&perPage=50`;
        const res = await fetch(url, {
          headers: pb.authStore?.token
            ? { Authorization: pb.authStore.token }
            : {},
        });
        if (!res.ok) break;
        const data = await res.json();
        for (const it of data.items || []) ids.push(it.id);
        if (!data.items || data.items.length < 50) break;
        page += 1;
      }

      for (const id of ids) {
        const delUrl = `${pb.baseUrl}/api/collections/${
          mod.collection
        }/records/${id}?sid=${encodeURIComponent(sid)}&d=${encodeURIComponent(
          d
        )}`;
        await fetch(delUrl, {
          method: "DELETE",
          headers: pb.authStore?.token
            ? { Authorization: pb.authStore.token }
            : {},
        });
      }

      const next = {
        enabled: false,
        module_user_id: null,
        guard: null,
        algo: current.algo || "v1",
      };
      const updated = setModuleEntry(cfg, moduleId, next);
      await saveModulesConfig(pb, user.id, mainKey, updated);
      setCfg(updated);
      setHasDataMap((prev) => ({ ...prev, [moduleId]: false }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h2>Modules</h2>
      <Note>
        Rappel: list/view → <code>?sid=module_user_id</code> ; update/delete →{" "}
        <code>&d=guard</code>.
      </Note>

      <div style={{ marginTop: 12 }}>
        {rows.map((m) => {
          const entry = getModuleEntry(cfg, m.id) || {
            enabled: false,
            module_user_id: null,
            guard: null,
          };
          const enabled = !!entry.enabled;
          const hasData = !!hasDataMap[m.id];

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
              }}
            >
              <div style={{ minWidth: 140, fontWeight: 600 }}>{m.label}</div>
              <div style={{ opacity: 0.8, flex: 1 }}>
                {m.description || null}
              </div>

              <button
                disabled={busy === m.id}
                onClick={() => toggleModule(m.id, !enabled)}
                aria-pressed={enabled}
                title={enabled ? "Désactiver le module" : "Activer le module"}
              >
                {enabled ? "Activé" : "Désactivé"}
              </button>

              {hasData && (
                <button
                  disabled={busy === m.id}
                  onClick={() => hardDeleteData(m.id)}
                  style={{ color: "red" }}
                  title="Suppression définitive des données de ce module"
                >
                  Supprimer les données
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
