// pb_hooks/mood_guard.pb.js
// Gestion du champ hidden "guard" (HMAC) pour *_entries
// - Create: copie "guard" du body -> record.guard (accepte "init" ou g_...)
// - Update: autorise uniquement la promotion init -> g_... (puis fige le guard)

const targets = ["mood_entries", "passage_entries"];

targets.forEach((name) => {
  // CREATE: accepte "init" (étape A) ou un g_... déjà calculé
  onRecordCreateRequest((e) => {
    const model = new DynamicModel({ guard: "" });
    e.bindBody(model); // JSON / form-data / x-www-form-urlencoded

    const g = String(model.guard || "");
    const ok = g === "init" || /^g_[a-z0-9]{32,}$/.test(g);
    if (!ok) {
      throw new BadRequestError("Missing or invalid guard.");
    }

    // Champ hidden: on l'injecte dans le record avant validation
    e.record.set("guard", g);
    return e.next();
  }, name);

  // UPDATE: promotion uniquement si record.guard == "init"
  onRecordUpdateRequest((e) => {
    const current = String(e.record.get("guard") || "");

    // lire éventuellement un guard proposé dans le body
    const model = new DynamicModel({ guard: "" });
    e.bindBody(model);
    const g = String(model.guard || "");

    // Pas de champ guard dans le body -> update normal (la rule PB checkera ?d=)
    if (!g) return e.next();

    // Si déjà promu, on interdit tout changement (sauf no-op)
    if (current !== "init") {
      if (g === current) return e.next(); // no-op
      throw new BadRequestError("Guard change not allowed.");
    }

    // Promotion init -> g_...
    if (!/^g_[a-z0-9]{32,}$/.test(g)) {
      throw new BadRequestError("Invalid guard for promotion.");
    }

    e.record.set("guard", g);
    return e.next();
  }, name);
});
