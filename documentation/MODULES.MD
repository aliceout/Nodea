# MODULES.md

## 🧩 Système de modules dans Nodea

Chaque utilisateur·rice peut activer ou désactiver des modules indépendants (Mood, Goals, Reviews, etc.), chacun stockant des données personnelles chiffrées. Ce document décrit la structure, la logique d’accès, et les conventions liées à ces modules.

## Quick‑start

1) Connexion → dérive `mainKey` → déchiffre `users.modules` → hydrate `modulesState`.
2) Activer un module si besoin :
   - s’il n’a pas d’`id`, en générer un (`module_user_id`), `enabled: true`,
   - réencrypter `users.modules`, update serveur.
3) CRUD d’un module :
   - list/view : GET /<module>_entries?sid=<module_user_id>
   - create    : body { module_user_id, payload, cipher_iv, guard }
   - update/del: …?sid=<module_user_id>&d=<guard>

---

## 1. Vue d'ensemble

- Chaque module est autonome (pas de dépendance entre eux).
- Les données sont chiffrées **côté client**.
- L’accès aux entrées d’un module se fait via un **identifiant secondaire unique (`module_user_id`)**, jamais lié directement à `user.id`.

---

## 2. Structure stockée dans `users.modules` (chiffré)

Le champ `modules` dans la table `users` contient une **structure JSON**, chiffrée avec la `mainKey`. Chaque module est identifié par son nom (`mood`, `goals`, etc.) :

```json
{
  "mood": {
    "enabled": true,
    "id": "m_abc123"
  },
  "goals": {
    "enabled": false,
    "id": "g_xyz789"
  }
}
````

* `enabled` : booléen indiquant si le module est activé.
* `id` : identifiant secondaire unique, utilisé comme `module_user_id` dans les entrées.

---

## 3. Tables de données des modules

Chaque module a sa propre table PocketBase (ex : `mood_entries`, `goals_entries`) avec les caractéristiques suivantes :

* Champs sensibles (`payload`, `cipher_iv`, `guard`) générés côté client.
* Le champ en clair de jointure est `module_user_id`.
* Pas de relation avec `user.id`.

Exemple d’entrée :

```json
{
  "id": "rec_xyz",
  "module_user_id": "m_abc123",
  "payload": "<blob chiffré>",
  "cipher_iv": "<IV utilisé>",
  "guard": "g_a1b2c3d4e5f6",
  "created": "...",
  "updated": "..."
}
```

---

## 4. Activation d’un module

1. L’utilisateur·rice active le module (via Settings).
2. Si l’entrée `modules[m]` n’existe pas encore :

   * Générer un `module_user_id` unique
   * Définir `enabled: true`
3. Réencrypter le champ `modules` avec la `mainKey`
4. Mettre à jour `users.modules` côté serveur

---

## 5. Chargement à la connexion

1. Le client récupère `users.modules` (chiffré)
2. Le déchiffre avec la `mainKey`
3. Stocke le résultat dans un store (`modulesState`)
4. Les composants utilisent ce store pour :

   * savoir si un module est activé
   * obtenir le `module_user_id`
   * charger les entrées (`GET /mood_entries?sid=<module_user_id>`)

---

## 6. Accès aux données

* **Lecture** : `GET /<module>_entries?sid=<module_user_id>`
* **Création** : body `{ module_user_id, payload, cipher_iv, guard }`
* **Update/Delete** : `PATCH|DELETE …?sid=<module_user_id>&d=<guard>` (guard requis)

---

## 7. Désactivation d’un module

* La désactivation **ne supprime pas** les données ni l’`id`.
* Le champ `enabled: false` masque le module dans l’UI.
* Une réactivation réutilise le même `id`.

---

## 8. Résumé des responsabilités

| Élément              | Rôle                                             |
| -------------------- | ------------------------------------------------ |
| `users.modules`      | Config chiffrée des modules                      |
| `module_user_id`     | Jeton opaque pour accéder aux données            |
| Tables de modules    | Stockage des entrées par `module_user_id`        |
| UI (client)          | Active/désactive, génère `id`, chiffre/déchiffre |
| Serveur (PocketBase) | Stocke les blobs, applique les règles d’accès    |

---

## 9. Ce qui n’est pas encore implémenté

* Rotation/révocation d’`id`
* Liaisons entre modules
* Journalisation fine des actions
* Règles de sécurité avancées (caps time-based)

---

## 10. Glossaire rapide

* `module_user_id` : identifiant secondaire unique par module
* `payload` : contenu chiffré
* `guard` : secret requis pour update/delete
* `mainKey` : clé AES propre à l’utilisateur·rice

---

## 11. Convention de nommage

* Préfixes d’`id` : `m_` pour Mood, `g_` pour Goals, etc.
* Tables PB : `<module>_entries`
* Stores frontend : `modulesState`
* Clés JSON de `users.modules` = noms de modules dans le code

---

## 12. Validation & fallback côté client

* Le module doit exister dans `users.modules`
* Il doit avoir `enabled: true`
* Il doit avoir un `id`

Sinon :

* Message d’erreur : `Module non configuré`
* Ou bouton d’activation (génère un nouvel `id`)

----

## Règles d’accès PB (résumé)

- list/view:
  request.query.sid != "" && record.module_user_id = request.query.sid

- update/delete:
  request.query.sid != "" && request.query.d != "" &&
  record.module_user_id = request.query.sid &&
  record.guard = request.query.d
