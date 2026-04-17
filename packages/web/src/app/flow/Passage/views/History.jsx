// frontend/src/features/Passage/views/History.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import EditDeleteActions from "@/ui/atoms/actions/EditDeleteActions";
import FormError from "@/ui/atoms/form/FormError";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
import {
  listPassageDecrypted,
  deletePassageEntry,
} from "@/core/api/modules/Passage";

function usePassageSid() {
  const modules = useModulesRuntime();
  return modules?.passage?.id || modules?.passage?.module_user_id || "";
}

export default function PassageHistory() {
  const { mainKey, markMissing } = useStore();
  const moduleUserId = usePassageSid();

  const [items, setItems] = useState([]);
  const [localItems, setLocalItems] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hashtagFilter, setHashtagFilter] = useState("");

  const contentRefs = useRef({});

  const autoResize = (element) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    if (editId === null) return;
    const ref = contentRefs.current[editId];
    if (ref) autoResize(ref);
  }, [editId, editContent]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      if (!moduleUserId) {
        if (!cancelled) {
          setItems([]);
          setLocalItems([]);
          setError("Module 'Passage' non configure.");
          setLoading(false);
        }
        return;
      }

      if (!hasMainKeyMaterial(mainKey)) {
        if (!cancelled) {
          setItems([]);
          setLocalItems([]);
          setError(
            "Cle de chiffrement absente. Reconnecte-toi pour continuer."
          );
          setLoading(false);
        }
        return;
      }

      try {
        const list = await listPassageDecrypted(moduleUserId, mainKey, {
          pages: 5,
          perPage: 100,
          sort: "-created",
          markMissing,
        });
        if (!cancelled) {
          setItems(list);
          setLocalItems(list);
        }
      } catch (err) {
        console.error("[PassageHistory] listPassageDecrypted failed", err);
        if (!cancelled) {
          setItems([]);
          setLocalItems([]);
          setError("Chargement impossible.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const startEdit = (entry) => {
    setEditId(entry.id);
    setEditTitle(entry.payload?.title || "");
    setEditContent(entry.payload?.content || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = (id) => {
    setLocalItems((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              payload: {
                ...entry.payload,
                title: editTitle,
                content: editContent,
              },
            }
          : entry
      )
    );
    cancelEdit();
  };

  const deleteEntry = async (id) => {
    if (!moduleUserId || !hasMainKeyMaterial(mainKey)) {
      setError(
        "Suppression impossible sans cle de chiffrement valide ou module configure."
      );
      return;
    }

    const prevItems = items;
    const prevLocal = localItems;

    setItems((current) => current.filter((entry) => entry.id !== id));
    setLocalItems((current) => current.filter((entry) => entry.id !== id));
    if (editId === id) cancelEdit();

    try {
      await deletePassageEntry(id, moduleUserId, mainKey);
    } catch (err) {
      console.error("[PassageHistory] deletePassageEntry failed", err);
      setItems(prevItems);
      setLocalItems(prevLocal);
      setError("Suppression impossible.");
    }
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of items) {
      const thread =
        (entry?.payload?.thread || "").trim() || "(sans thread)";
      if (!map.has(thread)) map.set(thread, []);
      map.get(thread).push(entry);
    }

    for (const [, entries] of map) {
      entries.sort((a, b) => (a.created < b.created ? 1 : -1));
    }

    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "(sans thread)") return 1;
      if (b[0] === "(sans thread)") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [items]);

  const visibleGroups = useMemo(() => {
    if (!hashtagFilter) return groups;
    return groups.filter(([thread]) => thread === hashtagFilter);
  }, [groups, hashtagFilter]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-baseline justify-start gap-4">
        <h1 className="text-2xl font-bold mb-2">Historique</h1>
        <div className="mb-6 flex items-center gap-2">
          <select
            id="hashtagFilter"
            value={hashtagFilter}
            onChange={(event) => setHashtagFilter(event.target.value)}
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
        <div className="text-sm text-gray-600">Chargement...</div>
      ) : null}
      {!loading && visibleGroups.length === 0 ? (
        <div className="text-sm text-gray-600">Aucune entree a afficher.</div>
      ) : null}

      <div className="space-y-6">
        {visibleGroups.map(([thread, entries]) => (
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
              {entries.map((entry) => {
                const date = (entry.created || "").slice(0, 10);
                const localEntry =
                  localItems.find((it) => it.id === entry.id) || entry;
                const isEditing = editId === entry.id;

                return (
                  <li key={entry.id} className="px-4 pt-1 pb-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            className="font-medium text-sm border rounded px-2 py-1 w-full mb-1"
                            value={editTitle}
                            onChange={(event) =>
                              setEditTitle(event.target.value)
                            }
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
                        onDelete={() => deleteEntry(entry.id)}
                        onSave={() => saveEdit(entry.id)}
                        onCancel={cancelEdit}
                      />
                    </div>
                    {isEditing ? (
                      <textarea
                        ref={(element) => {
                          contentRefs.current[entry.id] = element;
                          autoResize(element);
                        }}
                        className="text-sm text-gray-700 mt-1 border rounded px-2 py-1 w-full resize-y"
                        value={editContent}
                        onChange={(event) => {
                          setEditContent(event.target.value);
                          const ref = contentRefs.current[entry.id];
                          if (ref) autoResize(ref);
                        }}
                        rows={3}
                        style={{ overflow: "hidden" }}
                      />
                    ) : localEntry.payload?.content ? (
                      <p className="text-sm text-gray-700 mt-1 text-justify">
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
