// frontend/src/features/Passage/History.jsx
import React, { useEffect, useMemo, useState } from "react";
import EditDeleteActions from "@/components/common/EditDeleteActions";
import FormError from "@/components/common/FormError";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import {
  listPassageEntries,
  listPassageDecrypted,
  deletePassageEntry,
} from "@/services/dataModules/Passage";

function usePassageSid() {
  const modules = useModulesRuntime();
  return modules?.passage?.id || modules?.passage?.module_user_id || "";
}
export default function PassageHistory() {
  // Hooks d'état placés en tout début du composant
  // ...existing code...
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [localItems, setLocalItems] = useState([]);

  // Refs pour textarea auto-resize par entrée
  const contentRefs = React.useRef({});

  // Fonction utilitaire pour auto-resize textarea
  const autoResize = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  // Auto-resize dès le passage en édition
  useEffect(() => {
    if (editId !== null && contentRefs.current[editId]) {
      autoResize(contentRefs.current[editId]);
    }
  }, [editId, editContent]);
  const { mainKey } = useStore();
  const moduleUserId = usePassageSid();

  const [rawCount, setRawCount] = useState(0); // items bruts (chiffrés)
  const [items, setItems] = useState([]); // items déchiffrés
  const [error, setError] = useState("");
  const [decryptHint, setDecryptHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [hashtagFilter, setHashtagFilter] = useState("");
  // Gestion édition et suppression
  // ...existing code...

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
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

  // Gestion édition et suppression
  // ...existing code...

  // Sync localItems avec items
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Lance édition
  const startEdit = (entry) => {
    setEditId(entry.id);
    setEditTitle(entry.payload?.title || "");
    setEditContent(entry.payload?.content || "");
  };
  // Annule édition
  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditContent("");
  };
  // Sauve édition
  const saveEdit = (id) => {
    setLocalItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              payload: {
                ...it.payload,
                title: editTitle,
                content: editContent,
              },
            }
          : it
      )
    );
    cancelEdit();
  };
  // Supprime entrée
  // Supprime entrée (optimiste + rollback si erreur)
  const deleteEntry = async (id) => {
    const prevItems = items;
    const prevLocal = localItems;
    // UI optimiste
    setItems((cur) => cur.filter((it) => it.id !== id));
    setLocalItems((cur) => cur.filter((it) => it.id !== id));
    if (editId === id) cancelEdit();
    try {
      await deletePassageEntry(id, moduleUserId, mainKey);
    } catch (e) {
      // rollback + message
      setItems(prevItems);
      setLocalItems(prevLocal);
      setError("Suppression impossible.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-baseline justify-start gap-4 ">
        <h1 className="text-2xl font-bold mb-2">Historique</h1>{" "}
        {/* Filtre par hashtag */}
        <div className="mb-6 flex items-center gap-2">
          <select
            id="hashtagFilter"
            value={hashtagFilter}
            onChange={(e) => setHashtagFilter(e.target.value)}
            className="border border-nodea-slate-light rounded px-2 py-1 text-xs"
          >
            <option value="">Tous</option>
            {groups.map(([thread]) => (
              <option key={thread} value={thread}>
                {thread}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <FormError message={error} /> : null}
      {loading ? (
        <div className="text-sm text-gray-600">Chargement…</div>
      ) : null}
      {!loading && groups.length === 0 ? (
        <div className="text-sm text-gray-600">Aucune entrée à afficher</div>
      ) : null}
      <div className="space-y-6">
        {groups
          .filter(([thread]) => !hashtagFilter || thread === hashtagFilter)
          .map(([thread, entries]) => (
            <section key={thread} className="border border-gray-200 rounded">
              <header className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold">
                  {thread}
                  <span className="ml-2 text-xs text-gray-500">
                    ({entries.length})
                  </span>
                </h2>
              </header>
              <ul className="divide-y divide-gray-100 pt-2">
                {entries.map((it) => {
                  const date = (it.created || "").slice(0, 10);
                  const title = it.payload?.title || "(sans titre)";
                  // Cherche dans localItems pour édition/suppression
                  const localEntry =
                    localItems.find((e) => e.id === it.id) || it;
                  const isEditing = editId === it.id;
                  return (
                    <li key={it.id} className="px-4 pt-1 pb-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              className="font-medium text-sm border rounded px-2 py-1 w-full mb-1"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                          ) : (
                            <div className="font-medium">
                              {localEntry.payload?.title || "(sans titre)"}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{date}</div>
                        <EditDeleteActions
                          isEditing={isEditing}
                          onEdit={() => startEdit(localEntry)}
                          onDelete={() => deleteEntry(it.id)}
                          onSave={() => saveEdit(it.id)}
                          onCancel={cancelEdit}
                        />
                      </div>
                      {isEditing ? (
                        <textarea
                          ref={(el) => {
                            contentRefs.current[it.id] = el;
                            if (el) autoResize(el);
                          }}
                          className="text-sm text-gray-700 mt-1 border rounded px-2 py-1 w-full resize-y"
                          value={editContent}
                          onChange={(e) => {
                            setEditContent(e.target.value);
                            autoResize(contentRefs.current[it.id]);
                          }}
                          onFocus={(e) =>
                            autoResize(contentRefs.current[it.id])
                          }
                          rows={3}
                          style={{ overflow: "hidden" }}
                        />
                      ) : localEntry.payload?.content ? (
                        <p className="text-sm text-gray-700 mt-1">
                          {localEntry.payload.content}
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
