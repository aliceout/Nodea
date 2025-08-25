# BDD.md

Description de la **structure PocketBase** utilisée par l’app.  
Les contraintes d’accès (rules) et le protocole crypto sont détaillés dans `SECURITY.md`.  
Le contrat UI/Backend par module est détaillé dans `MODULES.md`.

---

## 0) Conventions

- Toutes les tables d’entrées suivent le schéma commun :  
  `module_user_id` (clé secondaire), `payload` (chiffré), `cipher_iv`, `guard` (hidden), `created`, `updated`.
- `guard` est **hidden** et **requis**. Il est **dérivé par HMAC** côté client puis **stocké**.  
  Création en **2 temps** : `POST guard="init"` → **PATCH de promotion** (voir `SECURITY.md`).
- Préfixes d’identifiants secondaires : `m_…` (Mood), `g_…` (Goals), etc.

---

## 1) `users` (auth)

- **Type**: `auth`  
- **Accès**: `list/view/update/delete` autorisés pour l’`id` courant ou rôle `admin`.

| Champ              | Type     | Requis | Hidden | Contraintes / Notes                                            |
|--------------------|----------|--------|--------|----------------------------------------------------------------|
| `id`               | text PK  | yes    | no     | Généré PB (`[a-z0-9]{15}`)                                     |
| `username`         | text     | yes    | no     |                                                                |
| `email`            | email    | yes    | no     | système PB                                                     |
| `verified`         | bool     | no     | no     | système PB                                                     |
| `role`             | select   | no     | no     | `admin` \| `user`                                              |
| `encrypted_key`    | text     | yes    | no     | **blob chiffré** (scellé avec la clé dérivée du mot de passe) |
| `encryption_salt`  | text     | yes    | no     | sel pour Argon2id                                              |
| `modules`          | text     | no     | no     | **blob chiffré**: état des modules (enabled, module_user_id)  |
| `created`          | autodate | auto   | no     |                                                                |
| `updated`          | autodate | auto   | no     |                                                                |

**Indexes principaux**
- uniques PB par défaut (`email`, `tokenKey`).

---

## 2) `invites_codes`

- **Type**: `base`  
- **Accès**: création par `admin`, lecture publique (via `viewRule` existante).

| Champ     | Type     | Requis | Hidden | Notes         |
|-----------|----------|--------|--------|---------------|
| `id`      | text PK  | yes    | no     | PB            |
| `code`    | text     | yes    | no     |               |
| `created` | autodate | auto   | no     |               |
| `updated` | autodate | auto   | no     |               |

---

## 3) `mood_entries`

- **Type**: `base`  
- **Accès** (règles côté PB) :  
  - `list/view` : `record.module_user_id = @request.query.sid`  
  - `update/delete` : idem **et** `record.guard = @request.query.d`

| Champ            | Type     | Requis | Hidden | Contraintes / Notes                                                                                                   |
|------------------|----------|--------|--------|-----------------------------------------------------------------------------------------------------------------------|
| `id`             | text PK  | yes    | no     | PB                                                                                                                    |
| `module_user_id` | text     | yes    | no     | `^[a-z0-9_\\-]{16,}$` (id secondaire opaque, ex. `m_…`)                                                               |
| `payload`        | text     | yes    | no     | **Base64URL** d’un blob **AES-GCM**                                                                                   |
| `cipher_iv`      | text     | yes    | no     | **Base64URL** (IV AES-GCM)                                                                                            |
| `guard`          | text     | yes    | **yes**| **Hidden**. Pattern **`^(g_[a-z0-9]{32,}|init)$`**. Création en 2 temps : POST `"init"` → PATCH de promotion (HMAC). |
| `created`        | autodate | auto   | no     |                                                                                                                       |
| `updated`        | autodate | auto   | no     |                                                                                                                       |

**Index**
- `CREATE INDEX idx_mood_entries_sid ON mood_entries(module_user_id);`

**Payload clair attendu (référence)**  
_Stocké chiffré dans `payload` (voir `MODULES.md` pour le contrat exact)._
json
{
  "date": "YYYY-MM-DD",
  "mood_score": "<-2..+2|string|number>",
  "mood_emoji": "🙂",
  "positive1": "string",
  "positive2": "string",
  "positive3": "string",
  "comment": "string|optional",
  "question": "string|optional",
  "answer": "string|optional"
}
`

---

## 4) `goals_entries`

* **Type**: `base`
* **Accès** (règles PB) : identiques à `mood_entries`.

| Champ            | Type     | Requis | Hidden  | Contraintes / Notes                                     |                                                                               |
| ---------------- | -------- | ------ | ------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `id`             | text PK  | yes    | no      | PB                                                      |                                                                               |
| `module_user_id` | text     | yes    | no      | `^[a-z0-9_\\-]{16,}$` (id secondaire opaque, ex. `g_…`) |                                                                               |
| `payload`        | text     | yes    | no      | **Base64URL** d’un blob **AES-GCM**                     |                                                                               |
| `cipher_iv`      | text     | yes    | no      | **Base64URL** (IV AES-GCM)                              |                                                                               |
| `guard`          | text     | yes    | **yes** | **Hidden**. Pattern \*\*\`^(g\_\[a-z0-9]{32,}           | init)\$`**. Création en 2 temps : POST `"init"\` → PATCH de promotion (HMAC). |
| `created`        | autodate | auto   | no      |                                                         |                                                                               |
| `updated`        | autodate | auto   | no      |                                                         |                                                                               |

**Index**

* `CREATE INDEX idx_goals_entries_sid ON goals_entries(module_user_id);`

**Payload clair attendu (référence)**

json
{
  "date": "YYYY-MM-DD",
  "title": "string",
  "note": "string|optional",
  "status": "open|done|wip"
}


---

## 5) Notes générales

* **Hidden** : les champs `guard` n’apparaissent **jamais** dans les réponses API.
* **Création en 2 temps** :

  * POST avec `guard="init"` (le hook serveur recopie la valeur dans le champ hidden),
  * PATCH de promotion avec `?sid=<module_user_id>&d=init` pour écrire la valeur HMAC finale.
* **Update/Delete** : nécessitent `?sid=<module_user_id>&d=<guard>` (égalité stricte côté PB).
* **Aucune donnée en clair** n’est stockée : seul `payload` (chiffré) + `cipher_iv` sont persistés.
* **Export JSON (référence)**
- Le fichier d’export regroupe les payloads clairs par module dans modules.<nomDuModule>[].
- Non inclus : payload (blob chiffré), cipher_iv, guard, id.
- Exemple de racine :
``` json
{ "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": { "mood": [ … ], "goals": [ … ] } }
```
- L’import utilise le flux create en 2 temps décrit dans SECURITY.md (promotion HMAC).

---

## 6) Évolution / Migration

* Passage depuis l’ancien modèle (guard aléatoire stocké côté client) :

  * Mettre à jour le **pattern** de `guard` en `^(g_[a-z0-9]{32,}|init)$`.
  * UI : implémenter la **promotion HMAC** (`POST init` → `PATCH` HMAC).
  * Plus de stockage local du guard : recalcul à la volée via HMAC.
