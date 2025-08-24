# MODULES.md

Ce document décrit l’intégration des **modules fonctionnels** (Mood, Goals, …) côté UI et leur contrat avec le backend PocketBase.

- UI/UX : **ne pas modifier ici** (voir composants dans `src/modules/*`).
- Sécurité/cryptographie : détails dans `SECURITY.md`.
- Schéma des tables : détails dans `BDD.md`.

---

## 1) Glossaire (rappel)

- **mainKey** : clé AES de l’utilisateur·rice (mémoire uniquement).
- **module_user_id** : identifiant secondaire opaque pour un module (ex. `m_…`, `g_…`).
- **payload** : données métier **chiffrées** (AES-GCM) stockées dans `*_entries.payload`.
- **cipher_iv** : IV AES-GCM (Base64URL).
- **guard** : **preuve HMAC déterministe** par entrée (champ **hidden** en DB) requise pour `UPDATE`/`DELETE`.  
  Dérivation : `guardKey = HMAC_SHA256(mainKey, "guard:"+module_user_id)` puis  
  `guard = "g_" + HEX(HMAC_SHA256(guardKey, record.id))`.

---

## 2) Quick-start (intégration d’un module)

1. **Lire la config des modules**
   - Récupérer `users.modules` (blob chiffré), le **déchiffrer** avec `mainKey`.
   - Chaque entrée de `modules` a la forme `{ enabled: boolean, id: <module_user_id> }`.

2. **Activer un module**
   - Générer un `module_user_id` (préfixé par le module, p.ex. `m_…` pour Mood).
   - Mettre à jour `users.modules` (re-chiffré avec `mainKey`).

3. **CRUD (contrat REST)**
   - **LIST/VIEW** :  
     `GET /api/collections/<module>_entries/records?sid=<module_user_id>`  
     → retourne uniquement `items[]` du `sid` donné (sans `guard`).
   - **CREATE (2 temps)** :  
     A. `POST` body : `{ module_user_id, payload, cipher_iv, guard: "init" }`  
        (un **hook serveur** copie `"init"` vers le champ **hidden** `guard`).  
     B. Le client reçoit `id`, calcule `guard` via HMAC, puis **PATCH de promotion** :  
        `PATCH /api/collections/<module>_entries/records/{id}?sid=<module_user_id>&d=init`  
        body : `{ guard: "<g_xxx calculé>" }`.
   - **UPDATE/DELETE** :  
     recalculer `guard` à la volée, puis appeler :  
     `PATCH|DELETE …/{id}?sid=<module_user_id>&d=<guard>`.

> Remarques :
> - `payload` et `cipher_iv` sont toujours générés côté UI (AES-GCM).
> - Le serveur **ne renvoie jamais** `guard` (champ hidden).
> - Aucun stockage local du `guard` n’est requis : il est **recalculable**.

---

## 3) Structure commune des modules `*_entries`

Toutes les tables d’entrées partagent le même contrat minimal :

| Champ            | Type     | Notes                                                                                                  |
|------------------|----------|--------------------------------------------------------------------------------------------------------|
| `module_user_id` | string   | Id secondaire opaque, requis (clé d’accès via `sid`).                                                  |
| `payload`        | string   | Blob **chiffré** (Base64URL).                                                                          |
| `cipher_iv`      | string   | IV AES-GCM (Base64URL).                                                                                |
| `guard`          | string   | **Hidden**. Valeur initiale `"init"`, puis **HMAC déterministe** après promotion (PATCH).              |
| `created`        | datetime | Auto.                                                                                                  |
| `updated`        | datetime | Auto.                                                                                                  |

- **Règles PB** (résumé) :  
  - `list/view` : `record.module_user_id = @request.query.sid`.  
  - `update/delete` : `record.module_user_id = @request.query.sid` **ET** `record.guard = @request.query.d`.  
  - Le **premier PATCH de promotion** passe avec `?d=init`.

- **Pattern `guard`** en schéma : `^(g_[a-z0-9]{32,}|init)$`.

---

## 4) Flux côté UI (référence développeur)

### 4.1 Lire l’historique d’un module
1. `GET …/<module>_entries?sid=<module_user_id>&sort=-created`
2. Pour chaque item : `decryptAESGCM({ iv: cipher_iv, data: payload }, mainKey)`
3. Mapper vers le modèle d’affichage (selon le module).

### 4.2 Créer une entrée (2 temps)
1. Construire `payloadObj` (données claires attendues par le module).
2. Chiffrer : `{ payload, cipher_iv } = encryptAESGCM(JSON.stringify(payloadObj), mainKey)`.
3. **POST** : `{ module_user_id, payload, cipher_iv, guard: "init" }`  
   → Réponse : `{ id, created, … }`
4. Dériver `guardKey = HMAC_SHA256(mainKey, "guard:"+module_user_id)`  
   Puis `guard = "g_" + HEX(HMAC_SHA256(guardKey, id))`.
5. **PATCH** de promotion :  
   `PATCH …/{id}?sid=<module_user_id>&d=init` avec body `{ guard }`.

### 4.3 Modifier / Supprimer
- Recalculer le `guard` à partir de `id` + `module_user_id` + `mainKey`.  
- `PATCH|DELETE …/{id}?sid=<module_user_id>&d=<guard>`.

---

## 5) Spécifiques par module (payload clair attendu)

> ⚠️ Les **clés internes du payload** doivent rester **stables** : l’historique et les exports s’appuient dessus.

### 5.1 Mood (`mood_entries`)
- **Payload clair minimal** :
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

* UI : `Form.jsx` construit ce payload, le chiffre et suit le flux **create (2 temps)** ci-dessus.
* History : déchiffre puis affiche `date, mood_emoji, mood_score, positive1..3, comment, question/answer`.

### 5.2 Goals (`goals_entries`)

* **Payload clair minimal** (exemple) :

  json
  {
    "date": "YYYY-MM-DD",
    "title": "string",
    "note": "string|optional",
    "status": "open|done|wip"
  }
  
* Flux identique (create 2 temps, list/view, update/delete).

> Ajouter de nouveaux modules : réutiliser exactement la **structure commune** (§3) et définir uniquement le **payload clair** attendu.

---

## 6) Hooks serveur (PocketBase)

> Détails d’implémentation dans `SECURITY.md`. Ici, seulement le **contrat**.

* **Hook Create** : copie le `guard` du **body** vers le champ **hidden** (accepte `"init"`).
* **Hook Promotion** : aucun hook spécial requis — c’est un `PATCH` standard avec `?d=init`.
* **Hidden** : comme `guard` est hidden, il **n’apparaît jamais** dans les réponses API.

---

## 7) Erreurs & validations (guideline UI)

* `Module '<X>' non configuré` → `module_user_id` absent.
* `Clé de chiffrement absente` → `mainKey` non disponible (demander reconnexion).
* `Missing or invalid guard.` (server) → vérifier le 2-temps (POST `"init"` puis PATCH) ou le recalcul HMAC.
* Sur erreurs réseau : afficher le message brut côté UI (composant `FormError`) sans détails techniques sensibles.

---

## 8) Convention & compat

* Préfixes d’ID secondaires : `m_…` (Mood), `g_…` (Goals), etc.
* Toute table d’entrées = `<module>_entries`.
* Migration depuis l’ancien modèle (guard aléatoire) :

  * Activer le pattern `^(g_[a-z0-9]{32,}|init)$`,
  * Promouvoir les nouveaux enregistrements via PATCH,
  * L’UI **n’a plus besoin** de persister `guard` localement.

---



Quand tu valides celui-ci, je te donne **`BDD.md` complet** (version HMAC).
::contentReference[oaicite:0]{index=0}

