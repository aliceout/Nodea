# Mdodule Goals (`goals_entries`)

## Description

Module pour définir et suivre des **objectifs annuels**.

* Une **entrée = un objectif** (pas de suivi quotidien).
* Données chiffrées **côté client** ; le serveur ne voit jamais le clair. Accès/MAJ via `sid` (module\_user\_id) + `guard` HMAC, **création en 2 temps** (POST `guard:"init"` → PATCH de promotion)  .
* Export/Import en **clair structuré** côté client (jamais `guard`, `cipher_iv`, ni `id` dans l’export) .

---

## Structure BDD (rappel commun)

Collection `goals_entries` avec le schéma commun :
`module_user_id` (clé secondaire), `payload` (chiffré), `cipher_iv`, `guard` (**hidden**, required, pattern `^(g_[a-z0-9]{32,}|init)$`), `created`, `updated` .
Règles : lecture/écriture par `?sid=<module_user_id>` ; update/delete exigent aussi `?d=<guard>` (guard non retourné par l’API) .

---

## Payload clair attendu (stocké chiffré dans `payload`)

> Les catégories sont **libres** (tags saisis par l’utilisateur·rice).

```json
{
  "date": "YYYY-MM-DD",                // date de création ou d’échéance (selon ton usage)
  "title": "string",                   // intitulé de l’objectif
  "note": "string|optional",           // détails éventuels
  "status": "open|wip|done",           // état de progression
  "thread": ["string"]                 // tags libres définis par l’utilisateur·rice
}
```

* **Pourquoi tags libres ?** Simplicité et souplesse, sans nouvelle table ; tout reste chiffré, aucune agrégation cross-users possible (modèle Nodea) .
* Si un jour tu veux un référentiel perso de catégories, tu pourras l’ajouter dans `users.modules` chiffré (comme tes autres “capabilities” : `module_user_id`, etc.) sans changer `goals_entries` .

---

## Flux UI/API attendu (rappel)

* **List** : `GET /goals_entries?sid=<module_user_id>` → déchiffrer chaque `payload` côté client avec `mainKey` .
* **Create (2 temps)** :

  1. `POST { module_user_id, payload, cipher_iv, guard:"init" }`
  2. `PATCH …?sid=<sid>&d=init` avec `guard = "g_"+HEX(HMAC(HMAC(mainKey,"guard:sid"), id))` (promotion) .
* **Update/Delete** : passer `?sid=<sid>` **et** `?d=<guard>` ; `guard` reste **hidden** (jamais renvoyé) .

---

## Export / Import

### Export (clair côté client)

* Format racine : `{ meta, modules: { goals:[ … ] } }` (un tableau d’items) .
* On n’exporte **que** le payload clair (jamais `guard`, `cipher_iv`, `id`) .

**Exemple**

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "goals": [
      {
        "date": "2025-01-01",
        "title": "Apprendre React",
        "note": "Faire un mini-projet perso",
        "status": "wip",
        "thread": ["apprentissage", "dev"]
      },
      {
        "date": "2025-03-15",
        "title": "Tennis chaque semaine",
        "status": "open",
        "thread": ["sport", "santé"]
      }
    ]
  }
}
```

### Import

* Côté client : lire `modules.goals[]`, **chiffrer** chaque entrée, puis Create en 2 temps (POST `guard:"init"` → PATCH promotion) comme pour tous les modules  .

---

## Points clés (fonctionnels)

* **Affichage** : liste groupable/filtrable par `status` et par **catégories** (tags libres).
* **Édition rapide** : bascule `status` (`open` ↔ `wip` ↔ `done`) sans forcer de note.
* **Léger et durable** : pas de sous-objets, pas de logs ; si un jour tu veux historiser, on ajoutera une table `goals_logs_entries` séparée, sans casser l’existant.
* **Conformité Nodea** : schéma commun, `guard` hidden, deux temps, et export clair (pour onboarding dev : lire `BDD.md` / `MODULES.md` / `SECURITY.md`)  .
