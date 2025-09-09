// frontend/src/modules/Passage/History.jsx
import { useEffect, useMemo, useState } from "react";
import FormError from "@/components/common/FormError";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import {
  listPassageEntries,
  listPassageDecrypted,
} from "./data/passageEntries";

function usePassageSid() {
  const modules = useModulesRuntime();
  return modules?.passage?.id || modules?.passage?.module_user_id || "";
}

export default function PassageHistory() {
  const { mainKey } = useStore();
  const moduleUserId = usePassageSid();

  const [rawCount, setRawCount] = useState(0); // items bruts (chiffrés)
  const [items, setItems] = useState([]); // items déchiffrés
  const [error, setError] = useState("");
  const [decryptHint, setDecryptHint] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!mainKey || !moduleUserId) {
          setItems([]);
          setRawCount(0);
          return;
        }

        // Compte brut (sans déchiffrement) pour diagnostic sid
        const page1 = await listPassageEntries(moduleUserId, {
          page: 1,
          perPage: 200,
          sort: "-created",
        });
        if (!cancelled) setRawCount(Array.isArray(page1) ? page1.length : 0);

        // Liste déchiffrée (quelques pages)
        const list = await listPassageDecrypted(moduleUserId, mainKey, {
          pages: 5,
          perPage: 100,
          sort: "-created",
        });
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setError("Chargement impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  // Grouper par thread (inclure ceux sans thread)
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const th = (it?.payload?.thread || "").trim() || "(sans thread)";
      if (!map.has(th)) map.set(th, []);
      map.get(th).push(it);
    }
    // tri interne par created décroissant
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.created < b.created ? 1 : -1));
    }
    // liste triée par nom de thread (place “(sans thread)” en dernier)
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "(sans thread)") return 1;
      if (b[0] === "(sans thread)") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [items]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Historique</h1>
      {error ? <FormError message={error} /> : null}
      {loading ? (
        <div className="text-sm text-gray-600">Chargement…</div>
      ) : null}

      {!loading && groups.length === 0 ? (
        <div className="text-sm text-gray-600">
          Aucune entrée. S’il y a des données en base mais rien n’apparaît ici :
          <ul className="list-disc ml-5">
            <li>
              vérifie le <em>sid</em> du module Passage
            </li>
            <li>
              ou ajoute/édite les entrées pour leur donner un <em>hashtag</em>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="space-y-6">
        {groups.map(([thread, entries]) => (
          <section key={thread} className="border border-gray-200 rounded">
            <header className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold">
                {thread}
                <span className="ml-2 text-xs text-gray-500">
                  ({entries.length})
                </span>
              </h2>
            </header>
            <ul className="divide-y divide-gray-100">
              {entries.map((it) => {
                const date = (it.created || "").slice(0, 10);
                const title = it.payload?.title || "(sans titre)";
                return (
                  <li key={it.id} className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{title}</div>
                      <div className="text-xs text-gray-500">{date}</div>
                    </div>
                    {it.payload?.content ? (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                        {it.payload.content}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
