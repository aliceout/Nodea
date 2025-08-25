# Project Structure

```
documentation/
  BDD.MD
  MODULES.MD
  pb_schema.json
  SECURITY.MD
public/
  favicon.png
  favicon.svg
  Logo_long.png
src/
  components/
    common/
      Alert.jsx
      Button.jsx
      Card.jsx
      FormError.jsx
      Input.jsx
      KeyMissingMessage.jsx
      LogoLong.jsx
      Modal.jsx
      ProtectedRoute.jsx
    layout/
      components/
        HeaderNav.jsx
        SideLinks.jsx
        SubNavDesktop.jsx
        SubNavMobile.jsx
        UserAvatar.jsx
        UserMenu.jsx
      Header.jsx
      Layout.jsx
      Navigation.jsx
      Sidebar.jsx
      Subheader.jsx
  config/
    modules_list.jsx
  data/
    questions.json
  hooks/
    useAuth.js
    useBootstrapModulesRuntime.js
    useJournalEntries.js
    useMainKey.jsx
    useUsers.js
  modules/
    Account/
      components/
        ChangeEmail.jsx
        ChangeUsername.jsx
        DeleteAccount.jsx
        ExportData.jsx
        ImportData.jsx
        PasswordReset.jsx
        SettingsCard.jsx
      index.jsx
    Admin/
      components/
        InviteCode.jsx
        UserTable.jsx
      Admin.jsx
      index.jsx
    Goals/
      index.jsx
    Mood/
      components/
        FormComment.jsx
        FormMood.jsx
        FormPositives.jsx
        FormQuestion.jsx
        GraphChart.jsx
        GraphChartBody.jsx
        GraphFrame.jsx
        HistoryEntry.jsx
        HistoryFilters.jsx
        HistoryList.jsx
      Form.jsx
      Graph.jsx
      History.jsx
      index.jsx
    Review/
    Settings/
      components/
        ModulesManager.jsx
      index.jsx
    Homepage.jsx
  pages/
    ChangePassword.jsx
    Login.jsx
    NotFound.jsx
    Register.jsx
  services/
    crypto-utils.js
    crypto.js
    guards.js
    modules-config.js
    moodEntries.js
    pocketbase.js
    webcrypto.js
  store/
    actions.js
    modulesRuntime.js
    reducer.js
    selectors.js
    StoreProvider.jsx
  theme/
    global.css
    index.css
    theme.css
  App.jsx
  main.jsx
.env
.env_example
.gitignore
eslint.config.js
export.md
index.html
LICENSE
package-lock.json
package.json
README.md
vite.config.js
```


## documentation\BDD.MD

```MD
Voici **le fichier complet `BDD.md`** (version HMAC + création en 2 temps). Tu peux le coller tel quel.

`md
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

---

## 6) Évolution / Migration

* Passage depuis l’ancien modèle (guard aléatoire stocké côté client) :

  * Mettre à jour le **pattern** de `guard` en `^(g_[a-z0-9]{32,}|init)$`.
  * UI : implémenter la **promotion HMAC** (`POST init` → `PATCH` HMAC).
  * Plus de stockage local du guard : recalcul à la volée via HMAC.
```


## documentation\MODULES.MD

```MD
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
```


## documentation\pb_schema.json

```json
[
  {
    "id": "pbc_1614515019",
    "listRule": "@request.query.sid = module_user_id",
    "viewRule": "@request.query.sid = module_user_id",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "deleteRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "name": "goals_entries",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text37674119",
        "max": 0,
        "min": 0,
        "name": "module_user_id",
        "pattern": "^[a-z0-9_\\\\-]{16,}$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1110206997",
        "max": 0,
        "min": 0,
        "name": "payload",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1283462680",
        "max": 0,
        "min": 0,
        "name": "cipher_iv",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": true,
        "id": "text895479457",
        "max": 0,
        "min": 0,
        "name": "guard",
        "pattern": "^(g_[a-z0-9]{32,}|init)$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_goals_entries_sid ON goals_entries(module_user_id);"
    ],
    "system": false
  },
  {
    "id": "pbc_2746472859",
    "listRule": "code != \"\"",
    "viewRule": "code != \"\"",
    "createRule": "@request.auth.role = \"admin\"",
    "updateRule": "",
    "deleteRule": "code != \"\"",
    "name": "invites_codes",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1997877400",
        "max": 0,
        "min": 0,
        "name": "code",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "system": false
  },
  {
    "id": "pbc_1148030965",
    "listRule": "@request.query.sid = module_user_id",
    "viewRule": "@request.query.sid = module_user_id",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "deleteRule": "@request.query.sid = module_user_id && @request.query.d = guard",
    "name": "mood_entries",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text202763660",
        "max": 0,
        "min": 0,
        "name": "module_user_id",
        "pattern": "^[a-z0-9_\\\\-]{16,}$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1110206997",
        "max": 0,
        "min": 0,
        "name": "payload",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3201413635",
        "max": 0,
        "min": 0,
        "name": "cipher_iv",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": true,
        "id": "text2937197516",
        "max": 0,
        "min": 0,
        "name": "guard",
        "pattern": "^(g_[a-z0-9]{32,}|init)$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_DxJ0976u3O` ON `mood_entries` (`module_user_id`)"
    ],
    "system": false
  },
  {
    "id": "_pb_users_auth_",
    "listRule": "@request.auth.role = 'admin' || @request.auth.id = id",
    "viewRule": "@request.auth.role = 'admin' || @request.auth.id = id",
    "createRule": "",
    "updateRule": "@request.auth.role = 'admin' || @request.auth.id = id",
    "deleteRule": "@request.auth.role = 'admin' || @request.auth.id = id",
    "name": "users",
    "type": "auth",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text4166911607",
        "max": 0,
        "min": 0,
        "name": "username",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select1466534506",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "admin",
          "user"
        ]
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "email3885137012",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text562493840",
        "max": 0,
        "min": 0,
        "name": "encrypted_key",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3495263917",
        "max": 0,
        "min": 0,
        "name": "encryption_salt",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text783762391",
        "max": 0,
        "min": 0,
        "name": "modules",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "bool256245529",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 0,
        "hidden": true,
        "id": "password901924565",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "[a-zA-Z0-9]{50}",
        "hidden": true,
        "id": "text2504183744",
        "max": 60,
        "min": 30,
        "name": "tokenKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool1547992806",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''"
    ],
    "system": false,
    "authRule": "",
    "manageRule": null,
    "authAlert": {
      "enabled": false,
      "emailTemplate": {
        "subject": "Login from a new location",
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location.</p>\n<p>If this was you, you may disregard this email.</p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
      }
    },
    "oauth2": {
      "mappedFields": {
        "id": "",
        "name": "",
        "username": "",
        "avatarURL": ""
      },
      "enabled": false
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": [
        "email"
      ]
    },
    "mfa": {
      "enabled": false,
      "duration": 1800,
      "rule": ""
    },
    "otp": {
      "enabled": false,
      "duration": 180,
      "length": 8,
      "emailTemplate": {
        "subject": "OTP for {APP_NAME}",
        "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
      }
    },
    "authToken": {
      "duration": 604800
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "emailChangeToken": {
      "duration": 1800
    },
    "verificationToken": {
      "duration": 259200
    },
    "fileToken": {
      "duration": 180
    },
    "verificationTemplate": {
      "subject": "Verify your {APP_NAME} email",
      "body": "<p>Hello,</p>\n<p>Merci d'avoir créer un compte sur {APP_NAME}.</p>\n<p>Merci de cliquer sur le bouton ci-dessous pour vérifier l'adresse email.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Merci<br/>\n  Alyss\n</p>"
    },
    "resetPasswordTemplate": {
      "subject": "Daily {Alyss} - Renouvellement mot de passe",
      "body": "<p>Salut,</p>\n<p>Merci de cliquer sur le bouton ci-dessous pour renouveller le mot de passe.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>Si tu n'as pas demandé le reset du mot de passe, merci d'ignorer cet email</i></p>\n<p>\n  Merci,<br/>\n  Alyss\n</p>"
    },
    "confirmEmailChangeTemplate": {
      "subject": "Daily {Alyss} - Confirmation changement d'email",
      "body": "<p>Salut,</p>\n<p>Merci de cliquer sur le bouton ci-dessous pour confirmer l'adresse email</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>Si vous n'avez pas demandé de changement d'adresse email, merci d'ignorer cet email</i></p>\n<p>\n  Merci,<br/>\n  Alyss\n</p>"
    }
  }
]
```


## documentation\SECURITY.MD

```MD
# SECURITY.md

## 🔐 Sécurité & Chiffrement

Ce document décrit **tout le protocole de sécurité** de l’application : gestion des clés, modules, entrées, et les étapes suivies par l’UI (client) et le serveur.

---

## 1. Fichiers de chiffrement

- `src/services/crypto.js`
  - Chiffrement symétrique AES-GCM (`seal` / `open`).
  - Helpers aléatoires (`randomBytes`).
  - PBKDF2 (legacy, à éviter sauf compatibilité).

- `src/services/webcrypto.js`
  - Dérivation de clé robuste avec Argon2id.
  - Hash SHA-256, HMAC.
  - Encodage base64url, génération aléatoire sécurisée.

- `src/services/crypto-utils.js`
  - Helpers métiers :
    - `generateModuleUserId` (identifiant secondaire),
    - `hmac` (utilisé pour la dérivation de `guard`).

---

## 2. Concepts clés

- **mainKey** : clé AES unique par utilisateur·rice, jamais stockée en clair côté serveur.  
- **modules** : configuration chiffrée, stockée dans `users.modules`.  
- **module_user_id** : identifiant secondaire, opaque, sert à grouper les entrées d’un module.  
- **guard** : valeur **dérivée par HMAC** (déterministe) pour chaque entrée (`*_entries`), utilisée comme preuve de capacité pour modification/suppression. Le serveur ne recalcule rien : il stocke le `guard` (champ hidden) et vérifie l’égalité avec `?d=` sur UPDATE/DELETE.  
- **payload** : données métier (mood, goals, etc.), toujours chiffrées côté client.  
- **cipher_iv** : vecteur d’initialisation unique par payload.

### Dérivation HMAC du `guard`

Objectif : ne rien stocker côté client, tout en pouvant toujours recalculer le secret pour une entrée donnée.

- **Clé par module (côté client)** :  
  `guardKey = HMAC_SHA256(mainKey, "guard:" + module_user_id)`  
  *(via WebCrypto/HMAC)*

- **Guard d’une entrée** (déterministe) :  
  `guard = "g_" + HEX( HMAC_SHA256(guardKey, record.id) )`  
  (HEX sur 32 octets → 64 caractères, préfixés par `g_`)

- **Flux de création en 2 temps** :  
  1) **POST create** avec `guard="init"` (placeholder).  
     Un **hook PocketBase** copie le `guard` reçu dans le **champ hidden** de l’enregistrement (le client ne peut pas écrire un champ hidden).  
  2) Le client reçoit `id`, calcule le `guard` (HMAC ci-dessus), puis **PATCH** l’entrée pour remplacer `"init"` par la vraie valeur, en passant `?sid=<module_user_id>&d=init` (autorisé car la valeur actuelle est `"init"`).

- **Update/Delete ultérieurs** :  
  le client recalcule à la volée `guard = "g_" + HEX(HMAC_SHA256(guardKey, id))` et appelle  
  `...?sid=<module_user_id>&d=<guard>`.

👉 Résultat : **pas de stockage local** du `guard` ; suppression/modif toujours possibles tant que `mainKey` et `module_user_id` sont connus.

---

## 3. Processus détaillés

### 3.1 Création de compte
1. L’utilisateur choisit un mot de passe.  
2. **UI** : génère un `salt` aléatoire.  
3. **UI** : dérive une clé de protection avec Argon2id(password, salt).  
4. **UI** : génère une `mainKey` aléatoire (AES).  
5. **UI** : chiffre la `mainKey` avec la clé de protection (`seal`).  
6. **UI → serveur** : envoie `{ encrypted_key, encryption_salt }`.  
7. **Serveur** : stocke dans `users.encrypted_key` et `users.encryption_salt`.

### 3.2 Connexion / déverrouillage
1. L’utilisateur entre son mot de passe.  
2. **UI** : récupère `encrypted_key` + `encryption_salt` depuis `users`.  
3. **UI** : dérive la clé de protection avec Argon2id(password, salt).  
4. **UI** : déchiffre `encrypted_key` pour retrouver la `mainKey`.  
5. La `mainKey` reste uniquement en mémoire côté client.

### 3.3 Activation d’un module
1. **UI** : génère un `module_user_id` (aléatoire, base64url).  
2. **UI** : construit un objet `{ enabled: true, id: module_user_id }`.  
3. **UI** : chiffre l’objet complet `modules` avec la `mainKey` (`seal`).  
4. **UI → serveur** : met à jour `users.modules`.

### 3.4 Création d’une entrée (2 temps)
1. **UI** : prépare `payloadObj`.  
2. **UI** : chiffre avec la `mainKey` → obtient `{ payload, cipher_iv }`.  
3. **UI → serveur (A)** : `POST /<module>_entries` avec `{ module_user_id, payload, cipher_iv, guard: "init" }`.  
   - Hook PB : copie `"init"` vers le champ **hidden** `guard`.  
4. **UI ← serveur** : reçoit `record.id`.  
5. **UI** : dérive `guardKey = HMAC_SHA256(mainKey, "guard:" + module_user_id)` puis  
   `guard = "g_" + HEX(HMAC_SHA256(guardKey, record.id))`.  
6. **UI → serveur (B)** : **PATCH de promotion** de l’entrée avec `?sid=<module_user_id>&d=init` et body `{ guard: <guard dérivé> }`.

### 3.5 Lecture d’une entrée
1. **UI → serveur** : `GET /<module>_entries?sid=<module_user_id>`.  
2. **Serveur** : renvoie les entrées chiffrées (payload + iv, **sans** `guard`).  
3. **UI** : déchiffre chaque `payload` avec la `mainKey`.

### 3.6 Modification / suppression
1. **UI** : recalcule `guard` à partir de `mainKey`, `module_user_id` et `record.id`.  
2. **UI → serveur** : `PATCH`/**`DELETE`** `/.../{id}?sid=<module_user_id>&d=<guard>`.  
3. **PocketBase** : vérifie `module_user_id` ET `guard` (égalité stricte) avant d’accepter.

### 3.7 Changement de mot de passe
1. **UI** : demande l’ancien + le nouveau mot de passe.  
2. **UI** : redérive la `mainKey` avec l’ancien mot de passe (comme connexion).  
3. **UI** : dérive une nouvelle clé de protection (Argon2id) avec le nouveau mot de passe.  
4. **UI** : re-scelle la `mainKey` avec cette nouvelle clé.  
5. **UI → serveur** : met à jour `users.encrypted_key` et `users.encryption_salt`.

---

## 4. Rôles : qui fait quoi ?

- **UI (client)**  
  - Génère les secrets (`mainKey`, `module_user_id`, `iv`).  
  - Dérive `guardKey` et `guard` via HMAC (déterministe).  
  - Chiffre/déchiffre tous les `payloads`.  
  - Envoie uniquement des données chiffrées au serveur.

- **Serveur (PocketBase)**  
  - Stocke les blobs chiffrés (`encrypted_key`, `modules`, `payloads`).  
  - Stocke le `guard` (champ hidden) et applique les règles d’accès (`module_user_id` + `guard`).  
  - Ne connaît jamais les clés réelles.

---

## 5. Résumé sécurité

- **End-to-end** : le serveur ne voit jamais les données déchiffrées.  
- **Capability-based** : l’accès dépend uniquement de `module_user_id` + `guard`.  
- **Pas de lien direct avec user.id** : empêche la corrélation entre données chiffrées et utilisateurs.  
- **Argon2id** : empêche le brute-force des mots de passe.  
- **AES-GCM** : assure confidentialité + intégrité des données.  
- **HMAC (guard)** : suppression/modif sans stockage local, recalcul à la demande.

---

## 6. FAQ technique

**Que se passe-t-il si l’utilisateur ouvre un autre onglet ou redémarre l’app ?**  
La `mainKey` est volatile. Elle est dérivée du mot de passe à chaque session via Argon2id et **n’est jamais persistée**. Aucune donnée n’est accessible tant que `mainKey` n’est pas disponible en mémoire.

**Peut-on précharger les modules automatiquement après connexion ?**  
Oui. Une fois la `mainKey` dérivée, l’UI peut décrypter `users.modules` et initialiser les modules actifs.

---

## 7. Règles d’accès PocketBase (résumé)

- **list/view** :  
  `request.query.sid != ""` **et** `record.module_user_id = request.query.sid`

- **update/delete** :  
  `request.query.sid != ""` **et** `request.query.d != ""` **et**  
  `record.module_user_id = request.query.sid` **et** `record.guard = request.query.d`

*(En création, le hook autorise `guard="init"` puis le PATCH de promotion avec `?d=init`.)*

---

## 8. Glossaire rapide

- `module_user_id` : identifiant secondaire unique par module  
- `payload` : contenu chiffré  
- `guard` : preuve HMAC requise pour update/delete (champ hidden côté serveur)  
- `mainKey` : clé AES propre à l’utilisateur·rice

---

## 9. Convention de nommage

- Préfixes d’`id` : `m_` pour Mood, `g_` pour Goals, etc.  
- Tables PB : `<module>_entries`  
- Stores frontend : `modulesState`  
- Clés JSON de `users.modules` = noms de modules dans le code
```


## public\favicon.png

```png
�PNG

   IHDR         �x��   IDATx���[�d�u%���Ϲ��㙑��ʪ�"@�`��(�e�n�F�1Q���͟��VH���Wx�zL=fR�Pۘi��=Di|t�lv3�M6�
��zee�#�������q�~��#3�dd�xVd�����9{��^����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*����*�������
=��f��d�������l6��'�wU��=+����*�����갓okK�\z���:� ��- o�����|}�/��{�5ׯ���[c��7o�m @�������wײ?��q�I�UAe�UVYe�/����lci8�h`ₒ���~{�ǲ�/�����G:�G��󯬲�*����*����*��B ��봲���=� ����@D@�7PYe�UV�?���(��
��������cyy�����ۼ�&--- j6�EoDe�UVYe�U�3vm�9yTe��UVYe�=� ��@DHӔ�z�-�����:>���Y?�33��s,��{�lD}k)2�c�&	c(eK�`C)'TG}�|M �8�n�����^�8��k�k���9M}�l��؊�d��H��SD��Zz�Z���Uܺ%K[[����;m kL�މŘ�*�ɳ��#)�s��W�Ce�UVY <u��s2l`�E��3 ��/���oo|3n�%1���q�1Y��E����5ޑ1�a՘�x���ffVe&&c��牪*����:��^	>MSU��W�F\�M=�R�$��ħ���M�k{�n&:�fg��8�k׮ɗ�|V�+�3�� d�1�"�{8�����*O8n�����`ja}yYC��4B5mPYe�UV O] ���9��@���X��{���6�v�����Q�}lj�RiM#kYɲ�F`3Yf6B1ð2���|�!�*JD"$���*N<�R睨��J
�4q�*iOӤ�)���x�ĩ$M�ӔL=����TM��Ą������Y�t���9��/`��) ����'iz��Z^^�_�U��ۤ��������X�[��T��H FK��U PYe�UV OO ��@t������ٝ���~�;�>ܝ:<jM��ք84 �4���1ՙ��GDl�ق�!F���a�0bF)  R�������zQ�*p��*�E�S���$�I���������k��}%�U�B)a2}�&�����>��h4�1ѐ��rS��t��l�ki�(93��'.IL��7f�wtt�nܸ�ͦ6�Mef� +����*;�@V� �"� �����{�o��`k���^�����q�u��ؘ��։3s����"$���0��e�1 f��|(@�
Q(DQ�WUQ���+� ��ŋ�S�w>��}�'��*R% $uJU)��3V=+���#k��cGqb�	[��׾K]�%IO�t-S'�Zgjz�{af�7??�;�ڹ�y��[k��3���kS�
TVYe�=sf�_@5x]":�Ǌe߱�>�?�}�sukg�N���:o�h�^�E�D��d��4"���%�	`"��0��3�X�� "y����C�
TIE�*U�Ë���x�W��!p^Ձ�T��#"O^�<yx%�"PU/>����8߷�>�{굟������K�<uj��531u���M���~�6�_ġs�����	c��˴�����te}]��J�d�
*���ʪ ೵������S`����u:/�}������+dhJ3��(1XV	R�)x/"� Aix�.���y;�
P��BIp�A�UU=DT��YP2�(1)`"��
x����{ϤN�����^��n�O��I��v���;p������u��<H��;{���o�Ȯ1�-�ɑ�e X6�7tX�b�B*���ʞQ��� T�� 5�?��g��d����6~p�������/w{���ɩ)�'&`���U�\91��&r}�����W(2穔�v�f���(� ��_W��#	��Ue�Hx]q�P��_U@D�5�*�4u�4I��Iװ�֢�=59q4٘<���؏�x�c�ec��"�	Ӷ�~?9@���N�O���e���}��{�s�.vjJ~��Ey����2�<JYq��R!�UVYe�����5��1ƹ�;;o�?���L��uVT��(:WS��M4И�D� f(�V����_�:��/P���$�<��_˨v��+ C�7Th\ 
5�Rx��B݁���W�r{#T�@ 
xa�|�RWW`���"�'pj��)��µ:I��s��iϫ�Ȟ��K}r�$�K��j0iO8a���ԅ��^d|��B�~��������������$q9���|�Jo����uʧ� ,���0*nTMTV��i��j��=1�X� `�"k���xM�ۏx��'<�ۏ~z�X[�̊5`qq��=j�X[��L�kO�l4��J4�_���h�7��u_�tz��N�+�K~�{�Y�h�j�:�X�(�J�=��%����ͺ�z�a e w�Zꅣ,v��<cE�v�" �2��;i��
�*D*��z����攙�̔�K��*���U��}G�]I]*u ��Б�=���Z��:79}p����+����[ : ��X�r�o`ee�b	�6x����Յ�ݼ��������*{��3 ��%���8�~o���~���&KXʟ�w�p�c|�w����>���~�쥳Z�_n7�1??�$d��~�����y-yb��
��Y��|v�R�� `ciI��xc����o��L�t�(���R���A�$��Q-��q(�z/"
)7�éu�(�� � P���;0�����~��J�*�D��D%��*�J�0���*�*�PM�@�K�-U�H�����y���7Q���v�hb�~pfjf~�����+���.�>3�RC!"D���yT�\QWV�����4�(T w� ����Ԍ�/�M<J��q���̿� *� ��7~c�Կ�q��-��KƘ/(�+&��(�ԋ"q)D�k�IQ� (� �À����� Z���I�e}�����:U	�b��k!�$���((�1��^x�J����U���@8$6��y��3�5�E�=�㣃���>lw҇����9J������^YYe�toױ\e���=���>-_dy}f`�vL���Q�01��¿�X~�	
��P��R�F���q�����R9:(�	D��ߩ�MY���P"h�7H$z�����B#!��`�a8�/*:!*���]��EdREg@:+^:
t��ni8p�]o�Ȯz�K%�C��gi�Oݜ�[YY�]]]�O�@heee(ʮ��U��eS�y��lbim�������҆��/*VW�
>����
6��hq}]�ͦ��=�>�����P�z	���B��Ι<�9q(�+)<�����/j�'�!��@O\1C��cA�	�T�F��ʆ�
ym+d}�y����'���� ���"���3"�<�眈v��#��Pl+d��v!~�P��L��{sק����y�=1---�$|TYe�}^�?�o������_X'��-ܣ��E|���Ґsu�>��@KKX��驜f4� &�&�;N\�EY�sNDDE`"2��fB�K٤>��9��%��������y�@y�1;N~)�B� $ �q_��0����؎-��xQID�"��v�h���&������Ӊ���������oݺ�][[���Z�|��:^S Z����*��m�
��'�u8}9�`ci��Ox���   sss SSSCϷZ-���;q����|��:�ۿlkkk'v���I<�#�� ��x�ʮ��� ,--��M����4�ݫ�N��'Ki�~ɋ[t�YM�81��5�� E�l"�t�J�4p�Y��:J�ٹ�61L��-рH�Ĝ��E8��XUCB�`�*ȧ�G�$ 舀#>d�}üka����L|7R�����~�}�I�&}J9����m�,�_=�����pQ�x����rh��R���fSA���WYeϕ/��wy��I�h���l�$I��j������7�o�l�{]��#�o�l-�Md��&��lL��0�Z�p\3LdT�Հ�4a�B�<E�򞉙��
 �#�ߝU4�珝�|Y���c��QTTD5IDYDٰN�j:11!��(�^$U�:]iwڒ�-I��b"�5���$����x��b����g�������q� �q-��*kV~9m倧XZZұ0�.@0BBg@\8�Z�ޙ�mt���u�hثg�A>���� �ǧ�g��˺�yЅ��5
�k-|ꦈ(b�3c��1�e�t�@;^d7w�oiDm&s;{��L�����v>N�K�4i�i����������
��sdymMWV�|��Le�=�!q�k�kK����U�d�[�G����}��_���eY[[{$�o�E��AQ� z{g'��n$j㎧��ۄ�f�^i���p��Zl,�B�14�j��֩D��!&{�bC��,"����KS�d)BAm �e$n��
2
�OW�$$PQc���"L���DRJ�>�!gb�����#��)��HQ�'V�T�m��{}�DB��I �����޽�^�q)��L���@?��:w,��5n|ةٻ��@s̿M'�v�(�>x.�M�g�ӽ�IxT���cU�:=�����@I�xp?�p""PD�l@��-�&�Y9���h׋~��|�;�����1;{�{��ÿ��ʵ��z�����m ]"rš-���
�tss��s�qp\e�=y���X��e`iI�G���y���������!�teq�VC��8���Ltѝ��'Z����N}{����0\#��ф7~�׭��1ф���u�� BC��� �
��aT��?1\����%Z�R�#����
JVT���!�Ȩgb!fH
Q��M��S�DiE}(��/@�@}h܋��	�U�)�MT�9�����_��z��׮�^����NSױ��G�Rh9��'/�<M��g������//�(�����N'H���F����K>�9���TT��@�8 �Ng	�1�x���( �%daH28t�SBJ!~ �l���`"@�i?��N�����Ȏz�!c��q}�1U�;;=�731yШŇ�<����^��޺}+�U�j�����E����7�5�����Y{Y�8��'&k��f�Lq<1�B�
�8jw'Z�G�V��jw��n��$��b���r#2ф��a����N6ա�)4U�*FT FYc ��y��Z�\u�ݩ�_�(�J6V����CU���5�c�e�)1J}U�Ի$u.�I��.M�H�"}��T�'*=���=��g)��zԟ�O�g�Ow&k����飈͡:w0ղGGG�V��~��~͟f9���	p{{��I�ދ8d��S���/t�0�G,l`�M ��ԯe�Lsv�0��  4IPN�h�����\h'��Qd�bg�^�O��N�!�Y6朲���ítwwwo��!s��m�j���n��-�+xV.]e��r�?�U �ň�5��F�xr�lMn�鉴�m|�ݛ�t=�M��T�15ec�e6S^���'�T|�5�L-�Z�6��1�n��1ۘ���p@E�����{6��N8����AQ�Q�0����a�T�XU��`{ƃ"�^�S&J�pjaN�YgBg@�DM��ڮ��A�6}b�4�^?��ww-��!+�B�v�&6�x略�i�P�S�==�`���^��i��{����e\?`*7���������ϰ[�g��0s� ����Ey� a�d�ET�5f"�K��L�BA��I`�E���PP佛�PC�V2��u���ir$��W�-߉m<3�R��=��ċ!�ȓ]:�rTVٳ��Ѥ��%Z__�{���W�����>����ECH�t���6��]�\����9�n&Q?�E�����K&�4���񌉢IUi���x���̖�1֐e���Dl�ق�O�9���:(5��i�/�i�{�a�[F�ND��,�����䬪���������+T�Xo�笇w^����T�)�@��A)��>M���Ե8��]k�n�8��s�{s��}Xk���VVV��U�'�n���T$*b �T�I�y?/@��_.� A���tX�`��:e�)gU�B� P�5 C�
�U/"��\����׭�x�G���]Ij���C��������#�ƕ'T��5�Uο�g�B3[��-C���i~~� ����},_���l����̇3��֥����N�}����UqI!s��i�~BHHiBI���	"�E4VCf�DL`f"&2ր�s&��D 	�+��|�%�^v�eF6 ���z�֚H�c�X�'�w�û��l�ɰ!Tְ*4� �@!�� +BEهQ$������'���3}uS����|O�7�U�b��� <Bl�
 ��Z��֧�g����������jOm�|�kF^��!H&�@�L� 0g��C��11 �"`g��I/~�A`��X���̝���wv��C�7��?�������G�������f��o}����;c�f�,�q�=�n��-����U��kk��g�ڙ	g-�1��Y���b��}��ڎ�	k������q�>Æ/����|z��$�E�ΰ�)%L�RL5��E��5k6�9�Z��J ��&��SVLxѠO�
%�!eA�Mr����=" �� `��=��*��T)Obـ	e���0��ޓ! L`1�~���AU�{��i��*�V����5�D4�J:q�=��t������|���|����H����	��S�=�L��&���űO��I����H��ظ���A�8�ܙ?.[�Ĥ��fM��
�t��@�#u���z� ff.���j޹����Xa��$Y��oy�v����������^���)�{��l �x��8���*���e�pq��۸�qQC��x�)8+{&�'�:��e,^X���%]__�GQk�1��?��>����'���v��:����ۛTƔՉ)"�ȉ���u��I5:G�/r���@f�0ɖ("bK�"[��F6���Kɦ���#��	s%%A@	<��S��f�#�JI�d�:]G�2e�;�8tֹ�_�YUAH	`c2G2l�C���5/?��dDr̜�5@���dܷ5�}d�j�D5fj8�S���^ң^?�r�_ v&�U��l6ͦb5�����j���ڳ�� `��+?dK�����SJ$���"����6�r@N���n.+�Nr�AW(L�HE���;�(�Qb�,#ȗ��q��6�f��p.��U������ɾ���jy��A�����[߽���/\��I�� �fS��16As��0�[ ����7׀�V��������7��X{��e,to�O����N�4�� �F�7�?��?��9X=�@cV$���T��1Myus�|D��`�	�a4N}ZS��*jR�5@jd�c-"�l8��rp���s��A��8�d+dɠ�ܶk�<Y���_�ʈ8il��'oY�1��"p^���Os�e@MQ����/tR
^w�Ng�'(H���#�`"��a��	h�Q�.I���V�G�OY$%nxv'�f��[]]-����o�A��
xR��������Q�2K"J�U=�湋�8�,�I*�ͅ(MZ�Пj��j],RD��7d�`�P����y PC{���h۰�T��8'�g��Gg����[[[���g&w/_�������!�a���B���U�_����^�����ʹ����&P��O���;o��������c�g�t�@�
��,g�0�I0�a/WV��.Y�'3ð����L8,c�c�0�C< ���ೇ�����҆�Ѧ�1I2����ʪR����l�)$,��W��P'{-!+�>2���ؙ%�V0&�Bk����4ix��jOT�N|[=5����ͥ �R���Eʐ�
xR����؄�$#JI��5+Y�ﱪH|<@(�}x�HT�Aݠ6�  ��IWP%T� �����P�Z���O���$�I#F9C��^{>����z�7���>�I@o�묮�����Hsl�������p��ѯ,�[��譵�&�ɿ�gu�ԉ���$qs��y����ɘ��%�4�&�e�"�%��ƚF�Q��#�	Nݫ�{'>����9�	<
x񪢢v	�<!��T�i>��PU�:틒�`�<�]
 �� '��I���~$�� C{3�4G���|� �N�2���(�B�b��J �5�l�	l�P8�/��9@.�a��ۻ�q��6�{������Sw۟�
"�`�fstc��֒��x�w�;6��DT��(%Ie�\AO?��O���I?�	8	1`�'
T�X�ƗTT a|DRce�(�d��EAP@�!k�\M1�zg�s~�{y!M�A�&���w�S�{xd��˝��eyy��[��fE!\�Oc�p���aX[[�Ѭ������:�$�m����%�t>����L��3x�&܀JM�Ԡ4����(�ň�(L�d����M�g#z�bz ��HDYT�D����}@*"��H`��=8�\�$t��0��J�#��'�CJ�IK�~*��p��υ��T�@!����|'��@8`
ʲR:�����k-Rcb52i,���aB"��~��Q�z����'� R <�-/������w"�'�٨@E�?M
�#���t����>Wb
N�3���% �J� I�9����ALÁ`��F1�4�F�RzV)MS/}�ܼ�:e@=����|��������D2�P��C���4���Qy��~f����k��`u��6�<%�c��j�{�s�p�� �S�����^������ j(���d�h�5�M�`�>��9���5l�����|��}ɝ$�HRJ_4��R-F�@TH�1!ˑ�����H�f�"��|�)>BX1��AZ��	�9=C
(�?<C�Y\����$O� �3�B��Z��0�s��-Y;�:�S  ���We��}���^{�{��)ڑ�f7@e�%�pr��������b %��z�/�"�B�1j��f&C�ZC$5�`g���$AD����w�J�����|�����Cܻצ?��?L�N��{D����Q���>Բ,��:�?���j��^ԯ׹c�t�/ƣ[���6]Ssޥ�b��U����9͂t@���ɚ��x�� 	xI��	�d�j桳�>G-T�}^�.�7!�/b�buɠ{>��$0 �å���{����YХg���E�S�o��E4G8�^�AȢ�s9J>t
���7�(��S�l"k�9M��S 4���ߗ;����N��ℼQ	Ў��.�G���G�3zC�Bm��<�ˍ�DB�H��kP�ް7(0̪&c U1Hs � X�a�9휛'�M1��f��n������k�ǵv���_z�Z����?���P���f�I��U�|UYe���{WO���@���������G;�3�$�I�C&����x�sP�$����<s�g2C�lmd�lmhj�"U�7r�%pp_���(2U%��q�lW$�Ār�b�)�zCM@J�q)�.PC*Mai���[�O��9����>>�=�|OR:�?�~�i0��%!�Z֒D�(g���>9�5JJ�1����1�Z��LMMU��_q��M=��PcX����l�i˦I�9���{�6#��b8���1?���PN���9��O!�+T~���]� $� ��)��E�C�K�zj��2��0�xD�$�PR��PU6��g2A{ �(F@�$g���~¹��Ku�����x���>�}_�$M�8��  �	���5]ZZ�JsM�z*�t����5�[X`�����Zk��i�A�ݙ;����&�K�K�{��ճ�cC�ʘɬ�N<�Sdx�Z�ڵUw�xA�3��W�(g]p��
z�W���=&=)M�i�(�@(&�2]xW*���R J�4p���A����plK�R��� �O�o�7_Hi� e�'J�H(M
r�/��%�U)�V$S ��~��`�2�%�(sd#«��=�eͅT���|��ཻ��JUՉ��P(�m�ٔ����O��(���<	�p�% ��q�����"������ �vJTbe�bS�ff��K/�}��K��E��W�뼼O.�?�������i�nEq��/���@�����h6�xc���j��+�DK�2)�f����%����1�U5�؞xk�������_j�;�w/���,@�"�4���b2DFԹU�(��>���( S��7)B�[��\>�p����d=:���B6��۟W�B�%_�9�V��+~�' F��U��<1�A	@%�	/#��@�����0gp�Ǣ͢�L�P��'ffYf��Z��i�4�}cr�k%P$""�}���������Q�rހ�F ��*R�
�@�+�"�i��٨M@��N�D��LE�k#��	�Oϋ�9 �ZG�������6?~������}8}�[�n%D$�>��'���(��*����n���A�wι�|��-�{n!���^P�KD�2\$�����J��LE�MB**��9���ІN�S1�|�J'�4s���=JиG�E?p�O0dM�=�%Xz��Ӊ{��O+�2l����X��3�SQ@�T����  �oL4Rk8!B��������6��$���ݸ�_K��1H�����|��I���z��I���\1d#Q�K�ix ����ݹ�G}�A�&%��Q��ԉ�2�!��"H���ߟ��+�7����Qg
й�{?���؜{;�5���WVV *
��0Q���6��
�]��?����Ng��O^Lſ,�z�<��1�a��&2���	D�1�|/E�i%C��e�Z�����T���َ0Դ*�xfIxYF����TE�u��.�]眑7D�� /	������c�N�ʎ��#ߕ� CqJ8��
RN�(hd��y�(ɪ������vD�&�������?�����i\��
������dbz25L}uH�BW��U����r�ji9	��D�74r��g�!9�q����G��0 c@��?2&I�ڋf켢�6w@��@c@̤��r�*�9�Ƙ�׀�`�j1�&S$#���&n��2e��}rޫ5�s,X/--�
OP����������5Z\\��g"Xk�O�����x�#�Z�_��ɫ}q7T�*H/�1g���Mdje���<C�y��A]�(�v���{��}6Y� ��s�LyI��kƠ��b0����5��e�h��W8|���K����<�7ns��GS��8�!�! y�#�%RA����f���O�]cRB�=Qs.���4����xa��i-^{�kO�mo��u�`(���^:"��x?)�6���� +`�N��ޣ��w�G��u�ZE4��H��9�A�%Y� "9� �.5iF�$9�)F��b�l�rNo����� jPL����J<o������y�;?w��� <���UȲ.S��+����P:�7�V�|���`���߾?����綏Z���$�_�(^� �1D
����(���4�ݏ��	����ԩ.R��������d ��L�|�JN�3�d�� �0 4�s������:i������uұ�|��i�u�_�e TL�5���3�@B $"�ŹTR�:��"n��5 (�b����h�}��.m9�[d�M�f�{�ji�@����;:˪P�2�� |V� �W��b��t�-5cЈ"^z���`@II�HȐ0�#�$lL���"QDP�D�����kw<�y��{o�ݟl��X8z���׮]K�H�8��B�2�f��^��-�}�v�N�;!�dڱΩws�݅r9��E!\!c^2L/B�BYk�8����j�d�sJD���u�Q��-P�l)�6��,^u,4Yv�c��ca֢\:���^����D ��`��z��n��Ϗ�!P-m[�~9��ӣ��b�BW�@�y�Ļ�;����/���U �1���=r� ~�������$=���C�!�њxaf-�P��Q�e�:�1<Nw�+������ٰh~�zD'9��~�̟dT�6�i���):p�U�ECY�w.���AI��A�3\���|�03�w3AwF!��O�|�_���Z�w����t�ڵk��M�ːD7ue��۸�[RQ?���q�&�_���x�i	�z�����NҾ��d^U_��/rQ	��y:k��`���k�e���>B
�u���f��_�:�"'�K-$81�k� �agF��8*�i�Nܙ�uȥ�y���G�1v!�PC�8���:n<!�������	o(G
�O��GK���������
R�'Ā!(GC*�D���R�{".1=�+Cߺ�l�׾�5`m�
 k+����*����5
�Ը��u;��G^�в9��) Q�Bh��\�Q�l���������T|g?��3قA4(�Ѱ0���P�{�@[:�Ë�i(��i;¿I�����`b���*��I��M�����3�r4�CZ��W������˗��Q�~@eϷmll���"�����ae�CT�����7'�n�9�{���ׄ�u��:T���!�	b����aB+F�7.G�H�')_]�DO�y��Q��b'a��W��K-�0�?��MH�R�Ҩ���"*�ꇇ����a��ND ���R���<�x8a�4P�A�:����������LePe���I�A	%�0����t�J�y��6q����6�����'U ����a�s�^�0=æÆ;lL��7�8~ߜ��YOǳ�g~Υ��_��86m�ϲ�Hѧ�����f�A�,#�`�"�r��<%�6Du�T�U��$��s���}{�ף��#�ao�j������7��zoV��#�<��n2�K D�����2{���O�~�N�+����P�D����0�$eT�lM� Rbʸ�T��^�Qە#(���Pr�!WJ�oU*h<j{A@��>���4��1�"����P���q�	��#R�����%�]����t�?�uOi ��\�@� �N �x1ec��F�����LײI8�1���[�[TC��;U	p{,��P��NU����OZ�e��1�N� �<��3jPI�D˩J����s�2�>���1�� k�K݌w�z�ٻ4�Ԩ�zjm�J�b��>�%�����'���(�d���r��������?�X�j=h�M���g^%�W��U�tͰ��sqd#�&ਔ�� ��rZ�E�
�c�� ��7*��@ץf�A �}�
	t�.�$���O��OX(�'�q@�1���>aDI�N���/C?��]*���yQ��jW勞TwKKK�f�x*�nݺ5�4�����J���uggf:3�ӝFc�G�ceD�*4�B|v��ԕSʢ��W}�)�2}�ǧ|w��1\�/����7nQ�)��p���T��{a�<;�ىP�C�� ��0�� �|�ݵ^��b/�~������t^�?��o�������ka���B�Z��1SUZi������_5À`�����<�Jo��*�K��/{I^ 7��E�f.��Qǡ�! ����^��,���8�����N�㇠�z��X>Xw�ZYHZ�0�
��N\���h��?:���w	.��R�84g-T0>��@9����8�8�f�TW�0����(�K����p��p�L�� m���V����&n����d��\2Ŧ���G�H+ui'�I/R�T�B��sHi��S�̟����	��A�7��z,d8��	I�E�),v�^b��!�XTjDN�q�L��7�{ ��I�>�6̙�hyykkk�ԦV��3xgs��f�x1�c]>HL7���ߞ�9ؼ��%O|��F��
�J�sD4if���{1{-fd¨~�T}���h�����~�a�\:�/�.�����Q��'����f�Q�N�#2}� ��~ �$���I����/)���cDm���!u�fSOKYў�5��gg5��Վ�:�ޞ��#u�yO!�6d���D�%�)����AG0`��?J6�X����2�(�Y�ϱ�,H'�����n?����oL�;�{W��2� ������g?@IO6Czj�y�?L������a�b�׺��{����uVz	D��$[��B
)q�Q6ιVQPâ�	d%Tu�O������b�!�������{�& u#�m�Q�H�7���4���2 ����^hp���w�����K�IG���ԥ����k�̤�e5ʧ9�1����%�����s�x���YlD�dBǯ �0�Rg��i;��Ć�c��S7��M�����v:gvwϛ��>��ڼ:wi��믷��>��WVha�gāT������nll ���1 ������h�����B��/���{��U��i�s�@σh2Uq�r鉙�F&���|D�U-����'ץ�}HO��A���'5�臍Ɉ�������q�'�<����\?g}�㐣j	%!$�� �'�wi����@�kɶl\;��F{ff�[��:f�z >��]^^>��ND��/�J���{�g��p/�����~+M�4u)�H���U��(HT��U����� =㑷�ke��^��GE�O�K�Ɨ
��ڈ@��l`�EG���("6L�b�w�yg|֌e��z����Q<�D��˫�4��N?��v��˽v��{��7�Z{��[� 5��	��*n���R�H*X�YN绱�A������cep��W�ß�;�uw��V{���|���_NĽ.�?G��k.�Z<����C�/���FD C�L��8pVIʎ:+�x�Kk��u�嵈qMn4��1�1�8ǐ���y��7�����z~�9z��a��x{�G�x�4@E�����1�#&�"#� !�OS��]m�pG����D���z�˗_v�U	���ZN&*�n�x��̩��Μ;���я����n?I�^|j�Cz��� ���U("�#� v~�8�s�}8��|N�k�K��rm�P� J"��P�SND�i3é�Ne֫N�ȌW9CJs�d*M��������k/ܤ�.�j���M�)���C��S ( }����&������ݩ����xv���b�������B��h��s�qd����"�=)@��a������1?����W�c�c����8z����H � ����o�1`Ơa0�*f�2�<�y��]����(�E�ӳs��W�ܻ:;�O�Zy*�2�����o���T��?��no���z��*�\����#�m� #��T��~���	7�\���0��K���ه�1IP��W���T��`E���S�{���)w;:8�(_���|x	}�(͍W���_�7�T�ъ���?�ͳ�:����^q�\s�{�C�C�]`���Q'E0�ò3�>�Ā�-�P��نǟ<��nЏǺ
)� %UG�j1��D�qpa��������q�-����� ʋWUimm��k�)��\��	�K���+JTV��,��O�~r���N�� �S�Ǐ�?��s�2\W�5�RM�v���84J�$��rA""G�1��OS�b��n�m��q��kڝ}?u�j߰9�F�٤������j}�nҕ�
a��E^Z�!��?����ar�����N�tA�:��3q�F6� �f��$�R�aR��|LI���H��{���>�C�U�)È'\���g�qⶡ��xA�>?n:9O3 �HD� ��.-"�{����Kח� �buu52����}e������df�׃.��r��$L�re�<yT���4��4��?��"g�'�����lF��*3o�?P��Q!l��	���Ѐ�4M�R�= -^��$"�g�y�!"��p\�a#;a���5��/���R������ᵿ}�[�w���VVV͡h�r�O�5ˁZs�ˁ�����~w�RW�N�����_R`�/�۠�F���p�!�����&c��b�8T�e����s(%�#�%}b@���I��~��?�su܆<�M)t��U��*2��n���fr�(����g��"�{1�]C�7]�88�����ۜ7�>̀�S?���@�ssC�^U��t���X��>v� �qp	��<��
��٢@C�f�5B�@����)�A���׉x�L9EU�9dn`f�P��z%U��~��>x� �7��ͻｻu�ʕ�[xK^_{]��%��'�i3]��bɯ���[o�e��Eo��V���o_|pt�sxMU��5b^��pƭ��XE����#�9}S~�-)*Q�z)'&Ž+"Ô���������w��'���F������U�;F�c��-ڑ�R�ݩ�v��`�Xȫn��ٙ�Z��G�7�5�LHF����~�TR<.�3�w�@A?�v���í��P�[^	�~��)�@���L�2��\L��T�,��e5� bD��EdNU��NZ�v���pfs���?�@������~往A��J�O1����Ҙ_��o�[�n�[�5�g�gi�S��sq�/8cn�Ef�_j��l��R�a"ϑ��½$�K�g�b ��@ć��,8(� ��V�I�=�ӤQܟ�Z�dG�(���x��8��w���aI�1����D���"�Rf>��)�M�gս�g'���S���i[�E�mY�H(F��Z��&��b�r.Ù;k&�A�?<8f�9Y�J7��O]���O�G���y���u�zS�*�k6)EAU�&��&�@đ]/u�L4�`
9��"��6p�Z�a#��As�=���O�Y��B���>����܅�;�g�D�QZ�VVV�̰��
~
�l6���=3�9���˺���X]-���棿����u���^J�I��������l-~�2_�q�q\ �a�DC�Bv@�$�W�e) Q�]�pH��$����N )�?�F����:�q��	�|s��c& ��u�0ڑ\a�m{��g�xY�ƄS��
hP�Uu!��Ӯ5�.ݱB���{�\LF����E�F |j�y����{�칳�$U�.� m�0��6 �$xyPx� ��ٞ?��xV���������PKes(�_��JF�O(S���*wi�z��� ��(bQ��3Nܜ��2�D�GDV>��v�O�T���ߡ��f��&�r���������޼�Q~���o��F��9�<^���(��ˤr���t���4�l���Gb��_��x���H�q�� ����y��o�c2g�dЧa�yR@O$����8�2��0(�  H��  ]��wY���=�t�ƍc����b�
 >����� �Rb�B��@K���PU[���j���E��м�O���J)KF��Z��(�\��*�}[��1�����K]C��"I��oI��=oZ�_�INU[̬%����C]��}~�tuuU��?�G�#\������H?�i] ��$C����i��g�P�b�C���ɐ�=���7��	�b@?."���}�oU�i����SQ �h��`�^���^'������z�P��~
�֭[���:�����J_ķ����#�]ǹ�9�T��o��;f�r���4�*�CY�g��w���(W�$��.�O�������� �j���q#�bXc�ą���5�f�����E�sp�kh���h�>ш����j*�F����a��j��Q]|@�Z{j6C�y������FT*+5���o~�[�Mܜ5"}�^MSYRŗ��MծD��BT���(���U��f�R �I@��H�ߑ{��(�E��A� M�)�F��r�j=>�;�����+���s|�?n'�)Ӈ��F>1��#�[��R�aF@=��w�/!�NU�`��[3�fk�ҥ�_����'"]�Xbm��O����	 �kkkؼ9�س�}��R�?��~?�$���$�s��3���������ci�G��RБ�@�<��lO��31f�f�@_�^t(�>�1�GeY>��^|L�Ps�X�8ۀ�(�5� _�e��RـD����#�{�����(��m�������w�/&��j��;�9�$I=���~!4�wAU�<nĕf�n�6����#5T���Go�:�|d�:	}QA� }���J���j�z�^#k@/��9�E؋��rNЯ:��4t���{%�"�qE��&i�\���4 x�j/�;�G���gh]�8���i\}}�����}�Gt-���?>�W�-r��#A�(]�`ӲH@~���ʨc �l�(4{�h��m�(h������W��Tt�---Q��<h��(�>�O�;�R33��G-x� tA��0�@K�c��6Ą�~�90(~����B^z�T�����TEkL�`��LyLP�)!���PIq�ȥ�bc��7��<�<{R$��V��?���E���� t�*V���Z���S����
�@�ƛ���{����f����/��Rw��l�܀�0t��y�FQ=�c����{�|��&V��TĥDx�eRq	d0�d]�����s"�=����~�}-e��Ig?�w��}�ߥOrt�)v0*pd�
\꠪}�:*�6ƶo�/t^������������2�� `�MB��S��"�ȋo����D2y�{:Y�{� ����h}t4��O�������C����g�l���-m�����``�*�((w���a �bb��S������t�͸upT{g��э��n]��ަ��=L�J|ȿ٤ռ�P����ɿ������L�w0�n]�ѳ\���dk���R�^o4&'EQ�!�W�DQa�ϧD��#���)"�+�4�h��?��Q� �g |��?f�d�Dt�Sʔ�^�	��Uŋ���:��M��^O��e�� ������)�����^�u��r�TE���C��A�����H1�Di༆74�UOa'ＥO�1�yj�&��(dZ΅� 6Ym���K��B�ē9���2���<��=B�6(����&��b	�^�7�$����é�Z-�a�o]Qi��>z�7++��ռQ�����-���{�xeee0��?�'�������ٴ���?�$}ѫ^%�K�ڗؘyc�t}���V3A�ÉgQ�B�l����2�IJ��$�����a2�c�0����Âs�M F��1��'eӣ�f�m�2��q�\=y}�(4��׎�����\m�$U��D�t�����@�J�6r��HBӟ� Jދ�8$�D�ZT�cD/ �ݻ��3����/9:� sss2=w5������!��Qhj�2P��;ʋ��Yeǅ�F3����c|�̀Z��<��,�9��,Q�	� ��4A����)D�RK�e��Q!�"��3��R�qޱ�0Q�Z�Eq<�Ƽ("�I�|���}��k����{�wߚ�Ț����V�c��?ᚿp����icc�xՋ�x���t��]�ɍԧ?�UQ������FW�Z|�>�0q#�PU����?��kQ��KqO�#s(;�h��-��dl���Q4hLe������bh��i�-��!��l�Ƀ��kq�������~��:�}� ���	 e�GAa�Wi��)���F^���TE[�؃�:N�ccKK:??���Nm	`yyY777ӿ@����ZN\KR�x����z�Lֹ�����cee���L_�"�
��飖��q#�b�|�]�EpP�z��y8��IDP����UU��JFL�8�'3���8��Z���{?~����_��_��_�Zu?�ݺ%K��-]][���H��������}�W��M�ބ����2>c���qT�����P��T��ϲ&	B9;/�(@�I��K�u�2�{͠��c �5�1գ�Q������O�����x�V��cP���	�!
����*Z
= �P�tc��3Rڳ���������?��#�ݡ��i[	=�]�9�Y� />Ӎ�ކd��A�F��1R���[&�)�ǲ$����� '�'0q�s�]z?UA�kl�y@P��M��g�U�0)��n��WU"�A��E�Z��W��t�G�Ӥ��v�����/���{���Ygp�?��.h�D2�*+��o5.M۳}������n�p#2�e�f��iD�5ֆ	A��H��D��:}��%��x~�g�#���x0AGtg� �:�,:>*)A��r&�  � <���&�������g��a��<�/;~�͗�:�C��<�C(2�0�≵'�P�S����{i����i/�=�%�fs�<%e�Knaa�{���Tc� 6�a�'Сw.�!:�:�޳��r�aka����c޻��_���TD�9T�Ϣ*��	�ឈ���Y�`�y���j�z\\@� �k��⥡����"�,ld�f�4M���H�0���)Z�3
Jo
%��α���m�19A6�sJ��O�ͣv��݃��|����(���ů��p�fI��x[[[�7���Bv93Ì����z����ګ����+�t���\T�&덚��(��K��w��w��	l�
X߄��	����F��
�Jk��@��D2�
����wh��_r�l%� 3�q��2^i�0�7��?\y����q��O�p�s�\~����\�ʉ�(7�H�B##�A��XlUbt� ���5SuL�����mCuG�C��� �[|������� �s��l!2V $/��R{zj� �E���]cxOD{>��;/B� eb5�asQ�~��:��z��:�?�;�h$�\l#?W�LeD����O&5Z*����c����[��3*�<X�6�G��H��sAS��J����50̤*�_ R�K#6�1��r-u�N���><�������~�LFq�@��U����>�z�Ol�ˋE��Y����oO�����\˷^Lտ�ƼJ�/��[s6��z\��X"hĻ4e��
)��A�`O>��{�Z�A)��rV�R 0���$�B �E�f�a�1EA�0~�4��e���F�p���l�rý	'8����#s��))�W��!@;�𐈶��Q�p'��/--�:�p�K I,܋/��?����A}ϋ���y�Y 5e�\˫�(=�9n��:��\s�q��Z��K���J}�:����¸U6�A�}p���� "���|�@�Qbl�ֶ�@A�Yلۈ�1�x��/��T�^����y�o��=����탹��-
Ҳa�}�hU%�P�7�xC �*V�����۷'�����I_��p��Y0�sQ�&�`�py�'�ވJئ��U��)'��H����Δ��<��}	@s�.c1̑�qc���1ddSY�� �6o�P�� \�K
t �W���r!SEIT�&)T4pd@�`�0��v/��Dr?yV�� VVVhcc���֠��ű���[�j���Xo+h���)h�@�@6�h�`��%��rD_t�2
��!�I�,D?���%�:��%t8笊���	a��D��
�a�Ͳ�<�ҒpO�r�j��ࢀ��iەa��ik���i0?2fP�:�}��ڀ�]K=�C�­!fÆ�6�g4�BT�Ij\r�8lN��oߋ��Ww �O���2/--����{/$}�M����3����������w.����n/}Yٿ���Z�׬5���F&���Ϻ�Ur9h� ͥ0��� 
�\Wb e�N�po��P�Gy�_^P�LN�����6K�B "c8����.�CHC?S(�u�R�0�t��^��h�������Q��E��BS��]� �7m*WA���+�r�!���H��NϩH�X����T�q�̹K]�����n4xBc�i[�O}	���Z�����-//�r��}R;2�����Z?�mm;2���SfVÙ��9��;��zY�fN�0�5�v �!���2_S�fr�
w��g�v����љ �f5�,`"X���E�BGDE�z�*�2s�_�n��<f�����q��23����_��$|��F�':JAB�,�#f�D�� �'�]�p�3QXʀ#��/��	6���q=�kg��uQ�r7����Q�wZ���%�F4hq}��do�QY�ҭ۷���W��S���흅V�y������_N���'}L&�3q�fLd3,�$�Uaf�0�G��yyO% G��d~*�s�b��'����}U��R�LF�2�2���G�{����B�r��g�3�� 3�ck�h)���T�,֏�������?�c<��<�1�0�0�# ��KK{�fL�P�?*����	�pi�~��~���uz�V�U�͝9s��{������]�^5Tb@?�2@ �p�4혨�gk��Q\�E��|@L)�5&4��Ʉ?H��=������NK
�y��=��}�k��&�RƑ'@s�*+�����n�h��Z��G�'D(4k�*�h���94#��^���Z����64pY2J��gʂ"C����D<9�H|x��F�ml'�ڋ zū|IT�<�ը_Z�p�|766�G���_���-�����2�?�҈g��Rq/9�^s^���z��ȚY���&s̙S��zb
̓&��T���:�d�=��T�V��?���Bx�q��¨�Q������d������w@$G�h�[����p<�{�Ʉ���G(�a.;����� i�^�b
a�w.I�.u>I�}�>4B_8wq�ѵk��)�v�� �s�K #PK1�n��|��o��	�i12O��u�e��v�ȼS6��n��Y�A����rF��j��C�p ��z�5F�a*&%L�U�lcFN�/�}�ئ���\#�*��J��*�<�1 6Y6���(��&D�eԄ&��a�d�K�e�,GMLO�w��y�����~��_��[[[�YН�s��y

����A�t�𭯯G�㿙��c>�r��0����E"�3�'8��ds� ���%Ψ4靗�hPŁ��������lZ$���@x?D���]f�=F�DyPj�̝��1��y',,;�zV
��͢Zj��A����y�,iiD�$TT�mF&"-���b%�L|h��<�}R܏������F��$I�L��S ������2k�����ڭɃ�Ʉ]K�~�=띻&�����\f�X5
�"+كd����?v@�0)�=m УJ:�����(�;Q�:�J�:?�@�́*g"�^S���Z��1G���[|Z��P����F-m~�Dt2�-���L�M�C8�|Ș��)�pTЈ�>���!���^&��q��h�/���$����Z4懰�l��s�J"�����յ5-=���L�|�Y�A�U%�`�K&��i�X��F�X'9R���o������c,�"L���A�|/� :i1l(����,rLB!9n��'l��(���HOSJT� ��`@""XR��d�����KS6AQhSi,�J<�:B�OO���֞�ȱ�µ
Е�\d��i"��Xe��$��v-��X�q��Ewk�3;�Wf;ΥC�0�nݢ[�n���2��F!�S ��WVVV�6nӛx�VW�����������Q��M���.q;�����F���1��4��{�P�@�@��(��B��E�3�R�9r���(ԋ!�)/ėY�$`�YZ�ĚmjZ׋�=��@cQ-���tA��1G� ���f�ݠӿh"�!�ԭ�g�R��k��!�a���A\�AS?��z���J��PU�{)�N9j�X[�$l.�ښ�&�@��;���������%����B�W \%c.F��f-.����g���|�-Y��~d�<K�%k�C���9��z����`fFP9��|�P"��݃8���!�=%♹#�m�][T{�{�ʨ1i�S'�ka���R"�`)jۣ�����'��O�:���8d}��Ly`$�]��$-�?iN���D�ޣ:��J�OP|�܅� ��2P����d������� ൅����-Z]]����/� �o��o�t��]I�P=V��dx0�C���F$�I�S�!Z������Mnh���h�Y%��� $"&��<��K(L�EPuL�A#��'o'66�@�ZB7� Fs�a}p1J�#�ن,NT5L8�1�M�{����(M(�T�mU�Q�pG|�x-�˗(����T���ţ��k�Kn �NL/(���f"�"���P�ި�*Q�w����tXn����l��=Ȅ��@%�|�
���P�A�y�PQ�3sj��1sGA�*�PDZ�K���	ciF-3��@e?�'��e�T�yP>�z�d�1��/���١=�A�����3Q���RjltX3�(�ݙ��iLo�q�E1��l맚 �Y������~�E�~�A�H�i�Ѷ��wu��U=�g�B� 8L����P�%�4���ŕu>�����H�'BKU; ���Y(jPm��:[C���Zxh�O�Q��0mP��Y��&ҡ���hxI(u��\�s�+!�Dd%4�i$���z��K\�o��lz01��>������9={=�U'�����ޮu>���=x���~����23] Д��#��P&1��|�����]N_��?�ƋQ0�$6���@)Y��u.�b����MdL�i
�\
�1B��������(��O[�K�{?	�Pc,x���ga�A�g�.Њ��$��`@����H16<P�C�l��Z3^��?->�=�7��q-~03s���KW6g�̾�r�����0�^��rt �llT|ei�������e�-">�#�:Bj�B�& ���@�(�0#L�Y�"8�����>�GA{R���*�D��p�!G��� ��0	�Y(́�q��Y-��9�V!�S���o8�����Y(0��\�CMa��Rj,`>���IXJ���:\��H)k��R�f\� ��ش�A�G��n��&���>3���:---�Z	�<�c�� o��A�����G��;�{G�/tڭ�zi�%��k�6�����;Up��L�`����/�h�2��R�Ph]�g�����^0e�`��As�{���@�1�]"��C(���C�r ��I�w.�Eq!��2�yh�À�
^�<I!@��D�
������NRz*n�R��D��YtЫ%�,��<g��p��'|�vET�'%���BT��N6j��r��C G �q(��R&U}j환I^\��&H��A�o��T|�;/��٥��4��dE	Pcl�1o��$@�K���cs�)�"�QｺLM-#�� eS�y9LS����]��}�cЇ��}C| Q���5ʅ����AGɁ��U~ )x0������PP8]��
`�#r�z���t��DdQ]c ���RO�t���/���j����`��~�ÅN�3��PI d�����DϚ|p�x�5��ffx���=��{.t�G�{I������\g&6c�Bꅡ��
�������M6C> {*_�H3�{*��{����:]$���;����!�@o��7��oI���v7|���?�#sh�u�Zf6��y��	�➥�e���Y.�,��s��@E��y��V
T54i2�C'i6�����E�@���Nv��.�W?/���3c �
xZ2�f�I�o��N��:D|@D�*:�*�1D�1o����p;rb�1�g~np���
$��2�-�H�4�� "ns�̊]Ut�7�>u����@,�T���Ԑf�!pF�B�W/G�3�BPY�J�ǛA��4��HּE5U���/;I����������3���?�q��:��}�!�Rݟ�཯����s��^<�^�����s��ʋ ����Q��ȫ�4Sy/1vQA��O.Q��}�:W�:�{U4K�E��R�@D�i�O\��m�����#6��a�aD�}����lb�5Qm֘z��kL���@�1�2bѩ�/��C}l��(_��D�HO�\:/��{��	�%>tJ)�Ի�A��3O�� `aoA7�Y�8��ښ¼�0pd�w�]�'�@q��-�g �<��H&Pg�?@�C�س���#�E�uA�D"�݌�遨�=�ZĴ�J�,�Բ���b,1AM�ns�8�٤�������a6�b��UU��Kub-��d0:h|�3^�)�!�l�0sD�!{��@�2I��E��v��i��x�Ы���P��r @�֟��jcc����P('"�_��w�`����n��"���(�W�8ő�q&.$PLy�*>�p匏�  �|�|<W��{(�<�1ƅD �=����'�,y�1����&��T�%¾@v�顪���w=�]���]R�׈�v..���q����07��DfD���Y���x@94 ������|D���K�]���4�ɠ#�:6x7ys/e���)�N���W�#�=K|躭���/�����hee���8�R��> X__�{��������|a���:/�����mo3�"��� TLղ	��<�H�J (snc@2��
�i�޵bX3�`w�HDgB� ��zI7��bl�׮5
�Ɠ#6g�y��ujl��2� �,1(s+���=s:�P�����ե��)���@&F?K<#�&��0f�*�f�Z�̨
�{n�߇�= ;5�!�^��~��_�y|��C���4�Mz����1x��w��&�/�^K����/�����L�ȕ��9��)���R��Gi���E���9�����0�sa�������Z�����p�#M���w�b�-�a���Z����>R����~��{�ɳ�����= ��<�}��uF��U��AįӋ�|@%��@q�A�60�^ *��T�~��F�r�h���(aI\���o�����%�$H8��HO��{�[�� !�1�#��?B�~�ˊu<Sv�����a&�,:�����r��iK��Br���{�3F��D��J�4JZ8�0:o9�/�ϟ}�-�끆��P�9��%`��"c(UG{ʸ'.y����[�GL�l�鐕�,8�tV���������B-��+�u�1Y�GJ�p,#�_C|�J��Ob�,5JY
��R�����j#�Uk>u���U��[���&����^1�~u�:?�NY�!��䓖(S��ù�����g����Ի�N�"7I�rD\3�P��g�ܤ^Y��E�l�_�pL�8ġ�C���1�rsiq�"�P�
Ծa9xQ��	-�d۫���?���Ɠ?>{~�Cc&���Ù��7�B��[�ѷ���/�O�)�5 _ �*L4 R�uk2�j���4�A���
����q̘�І4��m�nsm���1�r���[��HWT���M�~�[�-aqxt;O} p����\������m�i+��8�[����(�쐓+Ծ
^�ϱx;����DD6��*�0�I.��/8��K����}k�� rNA�r�Y/Bq^�Ί�$1���od��m}D�D���":����+Dɱ�7���2��7)JɁd��ް�b�3
�h�����|�Q�|vv���0F����͍7����{� �zʶ�R�_��3Ff%��������:l-$���/3�b\�q԰��D�2q_����PGJ�y�>'�u�eI�PIs���L R���]WQ���G@a�o��|���5x{���{��W��{_�/��˿�i���n������ѫ^�_�dn2���:ODg��(��T2�2a�	}8����ϑ��P�3�^iL3�H� �i��CR|H�ħ�Ӿo����l61�V�Sb�ͦ�4���_��c���_������|���������{p9M�����Ǫ��X���G*
��0�ϛ���+x4}R	�Y2�l}�6���3:R:��f؂ja�p�/:�+�X�b�pǰ٩��<��:��S����W�S�������P�}談H3$�$�����������11S�f �AI�r��Ҥ����<H�`lL	�� _��I��0Z��":E���d���tc�����㤿����!�dd������d�Ԡ ���A�닄��sv�E�����ك��J"��T�*]�֜c�q�"�� �/2s&20P����s��C��T����Hn&i�]���[*9��"�sTH��0��6��l�Mk�GB������N=|-�x�2�o�����g�,t����� ]��/6��`�Zc�[�:�2�R�H�9'/�(�(������6����#�]1�q��k�`,g.��(�SD�S�/���i�y�a�U��=<<<<88H��ֆ���Ū�F��(���׮}�(~�lo}�̡��I���*E| ǀak� ��R��A:h�*���P�����;���'� }L�R����J��5[hzN�3BTS���������^�Oaw��ӿ�������uG��H�{M�8qI:Gı1�lȲ����\Lx8��r�S� *���,�b(��Ǧ"��ôPH��9�/���C_ 2���Ac-�z�kQ<U��/r����Q�I���JF j6�t�֭|,�Ԥy��"��6��'�'�[���^���L�)���ڋ&26�`�)5h*����1������jѧ�	2��L>G��{=��t6BY�T�KAOY�轇�v ��wH�C��Q=�39Sߴl��m7a��}(�z��4�������j���/ӫ��f�(�^ u�*�U���zy��%TC�mh䕸@7���[�q��IԸ�/��Ο��G����ZHNԔ�D���&�a��Ξ������N�����666�H����곅�� ��l]�Cf�w�u����w�}w[v�Cy��_0��D���B��Q�y�l�t���� �3��W,E���bX�k��0d,�G�F]�w��[��~�����o���;��V��M�^%Q�}/�Ǡ��0�k׈����|/(�1�h�Ȳ�"�	`��T�6�<s�y�dfEԂ^t B�A/�P�Y+֚:��������i�qx�� ����X�r��͍7�"."w�P�_���>�WR�n@�[�f6�cÆ�r��\�O4�ݗ(zCg���2D@\���t�0��A
0H�g�����z���x�� �~\g�?}v�΋/\��O_�Ž̴$yOGvܓo�d�r��}I!_P��#��4KD5PVz,#l#V�.K��$�ĳ@��	�Q��n��,Υ*r@�$�k��hrvz�?��������#�x���l��sx� f.��i��B���**�ű�'I�2��}"ܵ�^tкx���d���Ā2�".��Z�g�3�J}.�"���R�kH��,�'���<=0�z��n����~d�~��{q���w��A��I��۪��].zN��Bu������)}���
F%U��졬�0r�4� ���c��Ra���f�r�7[٨�f1J̪*�L$��
.���qr/������o�>-���d�A��VVV��&⇭��Z���#}Y�^��h"3e,[6F�FU<C��.���3j�f��@X��Q��;��H1�l�!&�{"]��E����3�C��K�g��Wo h�*R�|�h|��q�޽_hw�/C�U�
�W�3�ښ1ư0!&@@`�)�l���Z`�%r���4��b�ҏ��s�*D˨�o����s�˼w ��1>0��Ǳ�������8�ʝ��b|�#)���y 蟝�ߏm�pb�v'n�>��h������@�H6��J�y� r�2�{����ߧ8��I$-OD��#fCƘP��^(�Y6Ơ֨�#;k��켻vx�{���;�y���~�l�R��ɯ\�ŭKs�޳h�[�[V���1ߴ�����ǆ����d%
���AN3�Y�������@!p������c�#'��3��J̃�XD6Bň��D�]�������4u��n���Q��������s���4�:�p±���#�yOe�mee�X4����W�\i������~��+�4��L����0�"[;g�m0K�	D�D:@ �c�nE��y�;��>�R�N�Ѿ��u��Z��!��#�
5b�m�@��Hԯ�O�)�������3{ :��_U�?n}o�'w�\:�?��&����%f�s��j�zq�K�Z6d�%�k,�1ٜb�9�|��NJ���KHF�st.����bz|�`U��)�#'�9x�]�n���bc߮��'3w��!>��V��2:�9ʥg�	��&-//cmm-��,?�я:��c�Sw�Tθ�M;�Y�類Q~2 1�Da�=d}!�}�C��H̻@ t�� Y픸��]� �x�,8A�AdmM�?�ɿ�$Ikww�֟O|t���^��S�7ڽ^w��~���}�۝p�>4��
LKI��(�~��)�3����:hңqJh9�9H#�[�s^ �:�����1A�iÁ>���$J�����$N���)��]pN/zc�}��ww�w	3{UEV��(��#i6����3z�֭�����vgg�玮�ν
�/��p�F֒	|���j�9.����pK��9M��me͎\"֌�L.7��f��aA&��(�K�-��@D,*?��?�T~�k�3�g���gâ2ܬ�O޻�΅�~�j�뿜z�� 3ˆ�(�`m��JLy�
L ʝ{v��C�1�� �|YI�i��Z �Z�D�+�����2�{ƚw������ss���N]�^ǜ��*�^4��7n�������a�'S�vg��O.�w/ �!bkm�QJ=7���g��肎e~��i�PFE2�5B4+"WE�O�G�w�[��?�3��u�3qW�)������~�K��OS����+wUqΥnFUc F.O�XIhd̫t��ё>VĈ��x�K�S�!oR�B�5����i@�m��Y.�T�e����am""Gd�O��L/�~�ac��gw}��~7yE�\'�/XCslL̑��e��A�(�,w��_�ע|CÛ����O����, �DuT������<���U%a�X�����~�^~���t�������� �����YYY�{���������慮k_I��u/򲪾 �Ơn�%C�yC*�D��Mq�c�6��T�ν�E0�?+3A�9�?"C�2�6#�w^�s	���8�}x����R}��/\9�����u�~��N�g. X^^��_kkJD���iml�Z}�^fS�Wz 5l�"��������-���?��8�KrHF=[d�Ь2q��%�2�2�(��U#�I��x��/�&�6ݹ����Nk����F"��{�������;w��^��N?�KJF��W��%�r֋Nt��ڐ7��~�|JPi�/���G� �I�lTh�!���I�O p�Pg$��gصd-�L���ֽ�,T/z�W���������lo�����~�7~���_��I�	�'	c~�,5�=\\��������ou>Iӗ���*��l�E24i���:�B��`�X?s�9ԝ~��:���"���	�/����*ʔ9Y�<��a~`Mt�X�яҔ?"׿�*y�������u��fܪ���<�o~����A�#� ��^&1f��⬼�P�!R�b��aq�2@R�4AI��8�A��v��mO�Ń�ǜ�AD��,���m��Ϋ$�����\���Ss��W��]������/y |��m^YY���բ����* 8�k�hf����
���e k��k���ĝ��͎;��?k��7�{��@u6W���G��#A�!&�L�LT�̕�>���T��Q�A���`(�Cs�]��`��Є��XR���Yu�^��W�������\�|K�)Y�����;����j鑷��Qz_R�����E�y�����Ի�"bDŒ2TD&|!!t�(�7E*e�C�D���9�}2�yP� 4p.������ �}
����p�\�&��M��i{I��N��&�9��t:��2�% ���R�h�L�K� "lllЭ�E\\^νP�l�۽�AW������P�h��q���� ��CēQÖE���k���(d�_X03$�� �A@Qbe@ތ��)|��Ry��R׷�nQ��n���D�'��7�N��0���^�k�[�����_���Q7�px�,�\�1^#�W�����y�eW�������#r�ȅ[q������U-uO3�Eks�d�H�?�L5`�� �`�t��1� �1`d�)�l��f��H-CKW��ro��Y+�d&�L�����-���}��9���^D&Yl��U�[��`f,�����}��.2�S&1u���O����E�F��[�pIc��� �W��Z�����T>4������q�@��܏CT��p��>s\�9M�"�����C"l\�9����Cf.���g�j�KǛ�� �`\H����gf�����+K�x
P[3H���� ��$>sc6&p�xV�`n.e%� �I��# ?�(���n�o�R��bs��H��o d���H����d����j�������o�͝�����p�{���iˎ�vJG����,�=�-��.��w~��2,.j�LX%��^��e����b�vGf�ڳ���"�&��sT ��(x(3��aa"�V�1�3=���w5K�*f����M ��~yy�pX���*�K��*�-��� * �v�;�����3�^�%���S5��/^�y�`v�U��:s���wJ}/����K���n'J*ʹ�~�M!"�
�����z����<��/=���a��͛7��w�+kkNC������[������ɳP}j>C��>�LÆ-1S$�z�T�N�j)��/Y�(����V�Gy�?R�Ǳ�iNEP���U&��~.U���5�_O[n/J��$qE��� ��|2�����?�WW	s��%V�@�_��W�~�[*�+�\�Ք�U��]V��C�@Yi��MތO������w
"2ƐS��8�
+	�:\���������כ���+Y~m �PT����?^�^���f�|��ʜ��{"�J����s�BQ[��rJp.��M�㖯��P���
���Q���-H�>[�,Ѣ�I	3�X	 C"R'�$��BZ�h�C�V�V?ɷ����6"]��_k������;�3i�{���g�I2\Λ�T)��L��-&6�(����׳�vW��u�td�*�b���	����u����
ީև����tk�>��9�"s��v��F�(���4�?��<��t�A�V���92|�ٜ2����=4��*���q���Sf_#�)�.�Z��.���e�f����*
x���S����^�t-����&����v���z�=$B�`�P\�CT}���1
JK�xE3R�#�c��<ל�����я�lQy�V�>摩9���K f��4��A	U4�V�HĹ�w���M Y���cwS���;7}�vǹ�w����:	\;=�37N��X590�(�MY�2K�yqW��$�	��2�Ws�@N����Ǝ�X�0�h`,2ð��$F�܄�a��0؟Q6-b]3�'��͵�5�`�?�g��h���1���ڪ\��ۛ��]i_��N��a[��C �#���UB�����1�[��,A�B4�qT-EDho�UHT*�0S�^A��$�&��%w�#����~���df����\�3 L��j��kt��:��RU_��Yk�%k�if5�Z6f0���1���D��-���7��h%yT��V� �w\]����PV��\r�A�G�fN�?����1W�x��MF�f0���'m �:p�O
��ȣ�h诽�N�Y��D��������(�5fs��C�X�$�X�é��4��^���g��� K���@9i������F~�[E�mpK6(2ZIP��խ2h����:�|zv��������_���� �x�Yi[�u;7:�i+#J�@��|�����Mp���D,
aR�i.&��&N��q�h����XP1c,��A�0e�uV(a�s� ؟��L:��^$j����cb��=EL�I�E�D5  �z�g�O�����E,ut�a�����5���:��\C��<ʉ�dMA�s�S(�M�o(n� R��]�~ٗ \�!0ZA}�R�o�e�6���;9T`��o+�M%��<���4�,�;�Q�Y����.ء����F�\�e��%<��3l������bnW�{13i,�{6�(��ki줥��1���ф��"?�A`kE���k��d�n��m�!�@u���[�Tn�Z��PRY~�T��]i}U�>5�4����U��8����+Y��O�ݵ,�n;��K�l#s.<������݇��a����2��L�T������m����G�
�ʪA�YrH_@c��* �U�K"������x�o����C�j!Pf�6I��8�������J�v���Do�6�A��"[���Ϝ�!�q�B�uZ�x�R��(�̄��m�AGC��8F��hdFlMŰ6��h�ZMF�F|�{�����֑����q-8ji1�7n��n��\<l7/��t�y?ILU6%I�F�@��
㝞�}�^NF�����wڳc>R(S�E.�*����:�z� �p;���Jbo�wah����d���D���T��C����v;���ڋ<����1<f����"pP�����Ѡ�dRTBDy)� �u����������`�!Æ3�t[m��v��nw5Ͳ�D嶭�{�Ϝz��/��7��?��g�4h�?5#����ޭ�����<??�o��M��k��{*�*���(�!UU�
��%n�^|0!�]�;��;�dA[�4����進�Qk}$"P6��H��'��� ��~l8�5s�k*������T��h8���&�_���}��:�y��߿���~MuI�wĦsK���7~˴�$	�C&�&�i"�!�S���Ld<�$0�����ơL�.o��A�!XF�a`e�`XՒ9KyV�e?w��x��L�� �*%�2Z��m��ȍ�}�ٹ9E4�����Z$0*����"������W�R��#�۝�3�O��Fܴ!;�
� �T��NA�H9�@q������L�xF�K9�/ Ֆ�6U���|�s�~��ɪ4����]s ��_4�GF��& ���g �Iu�a�]�N��^�U�I�3��+�$B��(�JA���s>�}d�}ym9����1?��)Net�P��\���6P���91�������$�)���G�=��]0�b�;C���O_����˟o����F#���yR |�{�H�" ���096�bsr���v�UI`�w#*2lT�~R��	�̬Q2��yR����@-��ޱf�,���#�i�7��~���ȂP"��a�~c�b���7�R�l�Ͻ����f3۰<�0ЄoUeRD�@Lf�
���f�y']O7&��<L�M�/5^���Z~��4s�_�;[��>5��ĺ-6�Hf��E����❫�H-�Vam�Z�*�������)A� �9�,���7����� �A��J9���Db��@c� ��1��X;Ɩ��w�*ջp�PUSj44&�i��}�c U��W����.�_f��Ŋ�T&[����ꓪ2ˆ�S�e2|�-����/\��D=�jJJIr�q.ν�2�_��G��Z��*���ؒQV���D\�T��-%�	�wcn'��S�K㓇����@ׯ_�E��' ������g��ψ�ϊ��t�0�'I*=�*�Q1L�/�}��c��F@6|%z$��O��v�K�;v�ɳzV���.\�"Y�iH�ґ������XE!�+)�-�;j�7�-����;����?�̟���߅�MC#�PO
���cqqQ�_�U�H��������T��7�V�pLԏ���L��DX�)���`Y-s�onN����@�!yl��A&c�Vp�!,��T�����jX���3s4q��EuH����FG TE`������Cѱsc��ٳ���T�_h��s��ޚ��F������̓�����v�I���4ͦUA�V��&�ist�:S
T�K_��Fr,���p����<��r��<]0�M4�Q[&æb;�l'[i���X�9
td(͟󋱰��7������YZ���Lp�ٳ59ݑ�Ӕ��`z���1����ְ	�O��""�	Ϗ@� .�m��펞�M$e��
�%���#���R��_���m]g�V�V���U�''j�^��Zs=B��])��� ����w�ޙ��w���T�Y�� ��̦�� �D��Ue-5���G:�<2�X#��Ϗc��C7�z�6ڏ�L
�Α����s����(�CJwX4p�����J��Peh�T�`�w��F<�3 �L��y��~z@ �O硋��������-~����Q���f��uR���!2�y]�r�C����y���%�H�c�)G*��Q.x� C&ҝE� ��⃎��z�� ��k'�f������Vǟ�켈�5�����u��՟�������~�wg���+��ۦw�:��&�v'�`L%1À01SX�������G:�ǳ����3ܜ��¢TCE�w���[���c��X*n���7�����O>��'g«D��O�am{s�����)5�1|����MLb��UT���8/����^b�s>^(�{�r��1�Q��a��*a��Z�z�[�XWл���ӣO<��_�r�l���0k)�QJZ�|x{�����6>�<<x6�f�Q�3�f�ac�Q��T�Q�w�y�3�HE+��G���L��vM�P�s�u���e��s��Jroth�ֹ�g�}�����.]�gb���ѧZ��i/ "d-x*I���ۿ���?x��vŻ̪�x?��'Mb�1&R˃�B9�ג���<X��=��2�A���?�����؃:�^pP�ߜ�L�2�@U�@�#(��Ο�O�H[���M!=Ԅvl�	.�Ԉ<R�J�d�4u{g������v-3��!�A3*2�lԨZ�$ŨDAj(�γ�i
ӧ���x�i�%���s%EJH �$��mn{� C*^��
D�Te4�t�:t8�+#vii�ȅ_���������ӕ��8z���G�#�s0%�;'�if>g�N�J�j�	`B
q�J
���W!���Ո�Y)�7��{q�=@��s;�Su��*���(4s�2���]���
�c��տ�W�r��1--�UU�Y�	�y����ț7�8���|&M���\���>ɠ3 M*fb��$E�BQ!D�NaЮ���yBǫG����)�y�/U��G���2ٳI(����Kc(W�VFjJ�r�ಬ�l߰ل�ÑZ��/}�����2������`vvV�;�9���/6�����խ�u��6'2�Ή�9o]bMk,8l:�ē��RlJq���%W����ĺ����7)"?{XJs�"@?΍�w�|�W�����&"pR����l�ݤ��f�O���|�~�ί�3^�H� �f��J���m�������3ƴ���-��@U/�s*�GE5Il2bfR�!U�X���ii�N���M��Tطr��R�j1�䒏=��I�C�*U/~8ͺ��4Җ��{ҭ���0���8��-����X��LΥ�/%IE�45 �lRgCS���c�\O�	Lb!�8�D����EN�{����L �؅���`�!�f��#�zA&�h����x�����=�W�>s��~Yj� ]�z�'''yy�7���& ����:��p���f���ϱ��Xcg��c�b��\~셔
硞`�X�c�>�	n��T����x2�+�\�<���㜲�J��ZCm�(G�ʎ,�4�u>{ �5���*۝�&&}Ċ����?�1�'��Oӛ=��I ����_����g���ӓgn[����z������fb6�1�4�%c�tI�\eJ�1�BNS93�$Q9Y� �����/�}r�c��%����$�9��\k�$l��8�AV�\v*�ҋ���{����N�gggW�/��β����sg7�_�p�ԩ�+�c�߯&�eR������mgݴ���z�^ G��b�_>��L+���A?��\�I����h}�B�~�<tZ����yWsY:�鶇��f����L��$�ht-,j�")���y� $m`$S?.�J:��Q0U�5��{H�BDI������+?#�1\�7@B�_�/��z!qY��N���iw�y_D�S�ݬ��8H&������.���������HP6�N�S���S��{3�V��N��|���q�]TȤ1��o<��^4G��A?k���������$�9��y�#���Ի9�@�D�2�e�,Mw�s���v7������a���Φ��):����2���Ҋ��0���'�/=|��v�:z_E/�ȘdnX�fC
�����)�ːyϺs�cFMnz��B9���FU� ��_��%���$�
�|Q&��;@� :�zw����M�O��������wv�����w0t�]Z\������+��ճ����z���[���Yե%!�LU� ���ӭ�w3�ͮ���Ϥ�"-��x�O�h(�;L�ӟJ	�a�a�+%z̠����{T��%���P
y�
�R�V�Pgh=!�9���Fʟ�����0��;k7F���8T'��+��5���~�Q����-����G	}�BQP��B��w>/���JL7���!��ūWS XXX�����<������/--)AT�&0����3�{�Of.{�O�0͠	k��ր{
DW��~�)�����@߈��|D&I Z�d.S��eUſ-�߀һ�,�Hյ ���F��������?� 3�]���9�`%�]��D��l�ۯ�a��
�T�ޟCW'ٚ
1S>��`7�"�oW,w������u�BV�eӟ�W�@}?{ʏ��8���.�%�R_ҚRO>G�x�|����F�V�ꮲa8(31A��E&��x������8�8Heu,��/���b���"��Q��������WJ�3U���g���O;Y;����h�n�e����s��JB�I�f�C�ċ�:o��^�!�����{)mQ��Gk�"9�=q��=�{��f�W�A�z�����aaS�T�ç��9����᣸�r�a`����7�=|������ᔃ;ņ'�y����1�]}����(�䓽�~������"�c�N�A�Uaf罪t�h��g�֚��+o�����{�Ϲv�??�<-�.�ٳg,������{�ֻw��?�i����1<��j�j��
�5 �9B���a�����l҇yB�X��٣�i(^���БF��]�PQ!b������?Q�T��W�5�������Ү����j�7�����'��� �wD�')ߚN0�N�V����{�Ia����K�Ŕ�& o1:�ps�\R�ަX�kS�`&E�9A�7�X0�=�7�1cD| �>_����[9R�����
�χ=�����	']I����B�4͆�������wE��F�Gc͙�q'"����ʕ�+���B�&��)�ً���7:�L������������=��i�*_�3D�$���$��KXɡP2�#3H�f�9�= �,g$�R�0F��{O����D�`	肈'�����u�#�Z�6m�&
??++:���D��,-�R�^k44??O׮5�퍋C��ɮ�3��?+����qsbm��W��)i���o�ΞH��v���!�L��ތP
�	A�QAJ�֘�D�f����j˓c�=y���?���ݯs/��͂�;��������a��N7{!���D���d�W��
lg L�H�����<t?�E�P1�ǽ��m�}�%	m1R�J�� �_0P�3S>ME@{q�UEDŋ' U/<`�w�J�¯S�ong��ݺ����0�
�YCiP~R |J����6�ׯ_�����ت�vF��S�n�{7"@]I붒�L��Ð��E~��{\H��`��:����	�� ����8��έg�Z�De@���?�,��i@IT���2��ӆى1T�׸R�t��gt�1�ι�ﰰ����4;�X\�R�U�0��4�,;��u�����f�ngUQ7"�k ���L@�&̬a�]l�h�A�hb�iJR�6�^LE`�%	�s�EM�x�Y�q�Z[1�����Q,c�4�al�P�k�S�O#��^yZ�"c��)ak´$����/�(i���M�Pj/ʹ�q��Q�8s'��Ph
����s�RM�z��o��Ͼ��T���\>d��cggG�^�Zt����ۿ7���w��{�+��1�4S���Z;�lJ�Q� ?5#�2g�\�a�d�ڿn�{t�()4:��A���V�g�oZc������?{�k������*���ߧ��� ��-]�z�������ʙ��C���om5�{]�:��<�8��^Q�lM��������0�)6��	DgP1�W���Ta�G�Fd'�>2o�E�2BR�Dʮ�Z0�p�}Lj��&dL�*T'ð�`��C�������;�;�,��q#�C/]]i(V�����b�ڃ�;"��Υu���5L�0��2����:C����6�ur�Zϗ�$�xL���O?�H�tdB%_W`�0�2�h-���&�n�Zc��<�p	������,//ywg�\�����ޟ��'��1��P<y��}��y�R�R�pE�uOZ:}@O"VH-	�J�7L�tPM�ЖM���ڍ��f.���?�*�����?��f}y�^[Z�LL�������<��0�I�'�Ib�hȞec�*�$���T�gf��J_F�Ɂ�@)����r�#���h,W�b(	DT��g�{�v��[��w>�̙�_���f���B� �\����T��իW�?�A{����?x{9����}wLUƜJ-��N�R-��)A%ґ��H�7z�%���pon^��˝���XȀG��pC�G�@$���V)�x�r�
��z�8��z�ƒ5\g�S�xI�k��N51���SO��a���j��^���I���� �3���]�b9��w���7o�|��S#�e�b S/O��4S�ac���1���б�
�J�\$	j�jy�����#rd��:_�'2Č16�0����hG0�b�8�%,�{�Gs���Ù]^>�R�.�V���T�ᒨLO����c�W���xǗ�%�J�D��Q_����i�h��Oy��%�ZM�o����9�����ɯ< �̲>�?Ά���e_����?��)�6�{���}�A�Hq�X��Ԓj��1Q�^(&B盓��G����m�ܸOp �a��+/���<e4�w�>s5xd �^!�e�2�]Kɛ���O_��g�~i_KKK:��';�Ip�,Ͳ� ���\��􅧓���R���H�$�ͬ^��Z2q�e���a�=��ఈ�jVA� ^���c�7.�6�ay&��������g�]��6�8(�#�Ys�X��L\s�M&֞�I�I/�����u��5�����avֿ�k���Q`�s��;��퉙��DT;]����9@���*%�>ʉh�CTh<�g��g�L�	J���!Q>bc`��~� ��R�Qb�3�8��]��T�YڶƄ���?�/��>��k��"@����&ؼqwl�qb/��
\`2c�d�J��nb�/����NCD@^4D�/�t�:��LT�2A���nR��y�sghx��˗�~��/��o�)�O���y��yQ�4�[�h�7#�?��/ ��f�q�\�I7���D�
�gP_(Nᥐ��S�v�֊��S�6�Z�x҈����ȇ@E��W��3聠�8d����=k�7��Fo^����~闶�����.���N
��`fw���í�������LQﺮuޱ_�^k 7�lY	,އ��m���{��B�@�PO��?������V�Z�ʋ��|.> ��E�O�{Rb�%L��a�b���Nsk{�{���$���s���c�ײ� ^X���9s�^�W�<���bC�������ֶ���ܫx�QpH{�S
T�c�Yx�.R�GDnX9O;�Gſ��H�%�!��ȼ  �B��J*b�R�`Tďz����V$�Q��-.�?���f~����Ս;�޹K
\P�yb���Z"�Wɷ�@��� *}aW(��������l�	 �H����o�1kc���y���� �&6ɼ�DD��^"����9������Ã��Y�>	���96|�X�bck�X
�őV�4ba@�����x�� bP)�9���D6W�D��'��,�`�&����i�0���Fu��ι�����/�Җ5IWU����׮]�k׮�|=*�N���oa�c�RRU�ƨ�;37���l hu�7[mx着��g��a�*Ub����?�݃�l|A�`F.�HS����ivGT*fr�CC�.��Rokg��y��n�;��L� f�N@4�E�۝�ﶻ�К�j5�<w��:�:}��pc�M^�ԥ�%^[[�e���C���?�w���t�n�H�s����xug����y.��Ջ���������D��(�D�_}�!��(	�A"Ꙉ`��sY�gnT��N��m7k[[[�S�ND��G\��, �l6�/��x��[�N�g�43J4a+�5��ͯ�!��v	ym�cAT���;6���Aͽx�*�M��1|��g�������E�T*��{"җ^z�6Ξ�3/�$���T�����o\_���N�����Wy���6��e;n,Ռ�LPC�=�r^��l��J�����ʁ��r�k[Q |}>�g"e6�&�mDU%s�#U�w�y�j�ۆ�.�ilr#1|Ӛ�'�zj@�Kh�VVV��矧F�A1��r��lv?���K��o�z?��Vu
[�'�oO�M�e9y�To:��dY��M��n�-i�B�@&5�j�Uk��d�"_��`��������4--��p����G�ql;��6g���Ҁ3^��'��4�b6L*Bⅼ�쥈�%�֝�S�v�f��ٽ��S{������ؠ��5\���.c^���e��e��)�y#���ٙ���s�n�}�^��	�~����uӽN��,� �!d�C�X�����xy�A0���_�{�� �^R��Dq� ��eY6��ҡ��vmy�^�u��*�юs,,,`ii����˔���1ԓK�ýϦ��s�3^�9�!�,�ř8E^�<y�!�AB$�x�"f�X�X��/8� ��z/�G�M�eY�;�CDw�1o'I��Z5�[��m m���~~��פ>9���' ����������8�=A����>�̗kO%�d�ڤ�6�"�9r��9_�ܹT �q������'k�O��cx�$�©)�5ω�F�5�B /�2�nY7�w��ⷡx�os¿g����j#C�?�r3l���.--��Ύ4��ě�zO�'�/	~����8 ��_m~��_�x���wj־C��P��s٪Kӝ4��.��{B*C^�`&S������N� 8��>���1" =7�8岣!�%�I�ݕ�=��rt+��r��{O�{v��y��C�HFDFR���d٥N'}��M/=X8}goo�ڤx��� �E���./����xO"�^x��?��������ykr|�uk����M�e�Y��vZ-dݼ�1f2��0k�\�c�_1�v%���G���{�y(�x�:�ji�����{�Tonm%���_X���ֆ�Ǫ&��yy6��Y/���N��j���rG�������4N�H�D9	���):K��RD�{8����"��m��ݪ&��J�ֈ�<���Cf���[ez��������N���h���^�S���b��t��6�&l-�J�`%�}4�)�`|
��r�C�a,zDS�����I�|��A��eN�sm�&�="z��|gxl�[�/^��P�޺��]f��Z]����%_���'#��%�k׮�իWUU}����n�~���L��ꢒx�N�p%�Ů7t���$.=}l�!2�ů��'D������F��ge�w�<���x�r��ذϺ� \�4{zo�`�w_�����whh~��OuqQ��򴰰@9D��������C����ݫCi�C��ދw.K��L�0{""���#�b<R�֋B@��,8P<�W�X`)1��Z��uk��k~w����|'���ˌ~����Z__��������N݌�N��T�ׁ$(�:���e�GX������7�/�I��Q'�2�:�$MVl��ܩVk�'F�Ol��g�xmxaa�#�3�9=~�����Y6���'��i0M$���?�X������>�����������<�6����R�C���� %�F�Šh��b���o[Nް�ڛO<�ܭ���g��_Ē��׿����~1���'�G��?��ۇ��{�t��aU2���"5q�"9�_����g��[�����%��� �G�dH ���E��>�V��R�z>T�_�@�b��	��h�p�'�3�gو�L{�g[��V���;�V7�_�����s��`m^�[�Y�'lee��{Q�̋l��y�v�թ��UG�LE/{�Nqbs�9$�,��1�4��5'��|L@}��e2���h�'%�<���U������5���9�}�ڽC����#��us4�z�jn���������h��	��Ie��1B�bv�(q8����>�*��|����]�f��'9��e^�	�maY3l��}���_~��{�H�_������K�2�g+[�[���fD�2f�����$)6�Hr#A(�ɘb��УR��Okz$�"�/��4Df���.�=����*7�D��<�<\�6�]b�f�&��V�?u�/?�g�_��Z���?|�G��W�\�W_}U7ů~����g�ؘ��zo�2|3I�������A��j�f���!q��g�3���|)����b>*-�� ���5�ݔ�Ɲ�؋hbB�� &.��i���M]ʉ_�%hY�1M�c� }&��g����Vsﳝ���w76�D��b���� 4��j4:;;�K���8��չ4}v}jx�����wk�ڷ��o(��o�,��>'��1,ư��N��.����09�ͥ1PQ ���HT�G���a��a��!7��n창?4��z��Y=���y�0<�Xp�7Zc�@Ȳ� T|��Tk�Q�TF(�Cll��I����@J�`��?6c��8+��������䭂�ἹL�@u��Dt���O��ֿ�ԗw �i��dI/R��ٞl�gӝ�]ʼ\ �ic�PR���;zƐ��6���s��~��q��'~��~@�:�MtGT ��H�s��7�T&V"���K3�ii��,M��)8�֮U�������GG�^�0s�������-��z�W��Ύ|�c}O���h<�f�W�r����՛D�|�y�C3��ș���Aa�G�v�ʗ
.���?�z�k��]�ݭ���)�ݏ����~����@qZ/6����^ ��$*�����E��*\�m?�_�޾}ۉ��h�J tqq�`�/,,`qq�H���/7�O^_ݾ��nm�J��N�Y6Қw�ӎ�$��l�&�0�h#�[�K|�.��7�xչ$�"�E��RQ�	VL���v�rܵ�3�� ���"���@���&��&�CF��@N������"������{`d�畡%�I>:#���p\|¼�UuD�1�]&�SI��C���X+%U�.--��R��2����?�_��=����D��=���"�΀1��E�Rx6s�i�qϽ�X|�(ܟ& %H?�/W�LEC�{60�p�H'V	��<�7/�2�c�3�۵J�͡��7/�<�Η���O��H���q���ߓ��v��h���!,"����/ﶷ[f��km�a��D�-�6X.8�&؇��|eӂ��C�Ҩ� ���,Z�hQJ6+bs�\Y�[�S �`�gy�;�dS^�87�ac��a+��l<s�T�+��yiv����uݿ��-�>Q�QN�ynnN ��|veE#��'��Y&�˵�2ng��[�%��x?�eM�$,w�1��|̓<L��N�� ��i����C��8�j6L �W�4��:f`��]����^]�(��d�`��C�f�,[�*'	�����̎��g�S���Qq��h�c([Ȝ�xRxf(ԃx$w٘7�`����xታM >s�� �-?k����/���<����oN��S�s/��!��JSd���0	qL�����]Qܼ����-��qP�OWQpa�Ǽ�]?3�!-2���,S�e]/rH�m���-6�j���������ϯOMc�.,�+WdncC���%>g'��I�Q-����Z��ЫKW#y��vι�������=�k�Nb�n�aWŷ�!s�	b"VY���ky3/q����8J9���	�n������7*$�����8�£U)�o˳��}PL�H+[�f�&0Ƀ��DD5&�6`k@0L�����/g���ͺ~cWu������������333E�P�{��9 ��~�a���*�_I���H&>��˪:B��g5�L�����&c��bG�<RRU���jpT��!&��,�eC�j�@�H��"��c\YԆ�_-� �1�  ��]�^_��i��1�Nc���!�K0�UT��7���`�I���r�X������s���52�z$Jj3c0oc�o�ʛ��~�%�:u��6 ��7�L4��`'_����ޜ����9��@�\�<�$T&��3�L���IND�������-�)�l}�B��B���=uK�s���#�Z��R�Ͱ�G�\��}�Q�mQy@�[����Müfl��ĩ���/"X\�.,@�66tyyY���O6���#��s�W���'"XZZ��������Y������Vk��L�LU�*�U眑��%�d� ~U�sq1��E�����.�Y{3���S���~\�x
�Ƿ6nz|�P�V��y��d�	`F|/xG(��LƄ���	�DŸ,/Ӫ�u"޻NFvwt�����+3��U��7����%Y\\��
�XE���u��������-����97�2?'�w9���$��������`(��~ᢇ��^�+��z���uR�4D�Iq�������an�&�{bei��"��
������iL�wɍ���X�����m��*�{�HvWL��	��·�~�|�'}N�s�R@4�
�h	O�y���k6�kC�7���x��������e��7�7��7�����A�}����.C�g��gI�%� ���XRc
~��)p(�8)��C� �P���=�<�ݲ����EZ�R�!fZ�='fca��h���{�i�p��uD�6�Ax[U�E��Fn%�U��'?k�1⛈Y��������� �������5^ZZB�3� �Tu���Otg{{ȹtBՏ���L�"��ZC�eC�`Fq"����&n�;�5-���1�ȣ�9\�j�������yh0���&�8�^P�T����0��[XX��ۋ��Q���r�玼���Ӥ`�LD��Ο�~�{�e=�v:c &T|=�t� b6�I$!&!&2� J�	.�QQT]b�*}����2Ġ
�F�0A�qØ�cX� ~aa�������W���3dy�S��������n0!���w>@!N
��u�9U��[��^xj������u�z���Ғ9�<u��$������럽2���Og*Ϩ�yfz�V,E�M� ��|,�]��c��h
�O�#p�g��ɗ�6d��\�)ȯY�9�\[���*3�KLo2������������j�}��]^[\t8��t`��)����|�\D�s/~�����mk+7�7	��
��q�&�Zq�UD�{�Z���x���}��Jf>�]~��?�M�/	�� =��b�o�a�߽"z�ˀ9NY��������,P���CDt��Ӫ�H^g�.���͍ʟ�I�C���󲱱�%rg���Xh,�������9��ޝ}��c���ժ�I���ƼK�k"r�˻y&b�n�b�c������(B�=S���h�AN.�AH@����&�?��}}y�V�4G�����4kO;�^�����U���<��ɬP�;��݊M��G���0Ua� ��\�y/��l��l=���^y�?~�����9<U��ƞ5D�����Շ�Q�אT*d�$ :@�5�}����~b�A����!��B�G��h�x/!	�,�X��"IXkAQU��̋�}���▂��Ĭ��}�:ķ���'֎�MS���̠[��q� ����������c�+g�ZC�n��y�js�f�3kQ�9���Z	��0=UQ�"�����L�G�j	v/���� �k�{�y�*�Ң\�Ss�p�$��ҧ��T��Hr=�Ty�+�d�\Q��M����MUI�����&!r�2��g��B���.�{�������1?�@>3�;] �����z'CTQI�,Ͳ����i��~�&�n�;��B�t�U��F �L��H��4f�b�H��B��H�9 %Q�-�D�^*�����U*ȼ�[�߸W�V�צhy{�-�D�����o#c#u�pL�<E��S���~ �
3�rǜߛ
p�!�~Ik���p�����R�ٟx��KS�_��P�Үo��eǼ��v�z~�{o m67��s�J�x�	��T*H*���0�ZA�gx��A�
*��"҇�P�z����ab $����w���0Д<�\�����������ʪ*1ѓX�I���&���\���5R�1ķ���z��Nu�~ghb����]M�{�������o(�گ��E'��h4���>�����>u�����[C��%��ޅҪ���ԥ>u*�a�K�<Z4�g�0p��(wяo���/��+��>=�x8�+�h�Q,�����6���7-wy��q�?~��:�����\nF"B�ydYF�yh	l�q�3i��!��Z�������[�y� (��������.z��'��{���w��\xcl|�����&��W/{Y�����8v�l�̀����СRO+;I�,{%@T��b2qV���[��<6yf�ֆ��5���2�A4
���|��2edb6�#G��?��q��>��T��s����̵�,�v^���^d��I��7�����%���~U�V�n�}���<�L[6SƘ*�Ѽ�7��$VM%Q�s;f��Gwpѷ!���9wq�zj��(h�l<l��(���g4Wb�0�5�%D�������o	�IAb+�8:!�k�:�K3tZ6}�Ͷչ{�C�o&�P�&+��o?u��_������ָ�����O���4Pj�Ah��� �/��9�s[����z��ຎ@*�ԅRG�L{�	��bf2lP6�N�'�1bV�}n����r����w���qލ�DD<~b[lޏ0(>��.&�oĄ��3�J��{}����D�>�!UfC� )sB�1&�!��,Cw����?�g��s� H��.�������y��_י�����_����}yۼ�.�I���`�|]�X�� ��7�z��,�#*-�=��(�!PV�YD��?U�~,��UU�ś7����#v����B��Eb:O�ǉQQ(�w*���_����>����5rO&*��V�[1
Μ�G�� ��ç�y�C�>�@�D����֭[���`W��tvyY�~�}ww��}w{bk�`��f�B�"C53k�$b
��
a����9U^D��~b��X6D����ӱS�f8�裞�Gu�O�1�a.���jz<��d�D�W|9d�Ln�����z�����
�x�A�������{b�3/_��!�TD�q��k7���ɗe9��'��	�I;��-����Z~�5&��d��_������;��kk��?����m�e[>su��ZXc�G�K~�Sb��-7���/��f�����p�2]�b�C�Z��=�{]LP�1���>~��|"Ă�E�Y���0:��`�"�ef��Xky�XsA��v\��V���N�=�`��镵���--���~r4b'��B���u��(8��&�����w��-����}�$/��&���h5HR� D`�0K܀<-�Iɐ� �ϸ�e��,�-�Y�!�t��/{ ��ʊ.-/��������;�;k�+��S�Zy�V*�d�)��N�!�W/^��|�O<��}�]�l3G~4B�^��Gp�˛� �����!�p��H���]&�Y��0	�e���r-�63C���_;~-3�~wm�΃�3�{[��E��Y#zByV4���[��n=������0�ˎ���ATB���k�*�JE�_���C/�+rf��� �28@�(O��i�r�u�/9i�����	(�ML4%��N���iei�&^� �o2�o����m�Qr�¹�/_�ʞ�I�# t��M�N���'R��C *~TU������W�٠;������N�=14�����]��e�Wf2LL�g��av:J*/�lH�r5S�禣c�FJ��>�h��Kհ8.�s����~��>����sXm
.�Ž��e	 ����u�1=4�b���"�IZ��B�J����ѰS?�^��ε����C�.���B{qqE��ᐼ�Yl,*(8buU����a#��s�>9*i�\�O0�DET�3���1a�{URe[^��n7.����h�^�p�@+R�s������`�,\��ŷ1���޶s=ҟο�����z����;�E�i/�Yc�eCtF��50��ؠ�ıs�"���B���j�ɍ�GQ�7:�b��#Ǒ���`#��R��.�kn�*���f.�-���������k ���[}#2��|����`�iw����_���`&&#u��a�*C��3i��/���y��.�//� ���C����}(�zFC�}��r��)����P�|�*70��["<W|]^	P����f
�ܢ9�g#�?�t�m���d6�X[}�>Ty˘��r���6�kg��|�|��]�N�.,,x ���׫�W�H'�'�'����/�z�*�yUKU[ ��ɿ�7�����|�j�Q6$��TC52D�)�����(�g@2��3$ɉ�Ds�A�!��� A::����u}X�#0�>�Q�s�c����2�H���`�ω@-# L(��TwHi[������'�|2�Q>\H��5-���*�����P��7��冪{�ru����uX�3��X��Ď1�,z #�2��s3�X���ko3���]ZZ�Cr��w�}բZɸ}6Sw9��e!�c��TȚ��7���G���T�XR)ppN��'W�����($�N��c��,��F��w���W� ���y���шdQ��.�4��S�������W��TbPr���s��	������c�E�1 Ǐ�J�|,D�<KV>���v�ᢆ�*q�ň%���G�&�v�>u�P�Cdnؑ����#+O_~�����#����XΥ��N4�'�OXQ ��y^__/�x�g�������*uhD��)��{R�N�Q'p���̒w��(Y�=�i����ӟ�!�|(Cc�@��9�G�(��q> �M]����O9�qő��
b�5v'D6��Z�4͆�n:MJ���	v�G*�O�z� @g����X�ovND��{C:�V1����H���e����� c��/����"J4R�"
_�=@��~d#�[��l�26l,My�s���2&<S�LNH�=��@���#���!��PP������N��c��;5�(��jB^�͡�� �{ ܩ�����ɍj�����c��k���<��ƽ�3N�y���!&�	��Ĩ���Q4�y���}��W  %�������sA�hp�A�-�r�*%0��t ��ި�6V41ءo8�}�.N�(�y�^������ ��5@�1*o&��8w��[�+_}�e�^;�z�*#(t>����8) >	� ����d���oo��޸%^-w!���ft���٘�Xgt
QQ�����P�R�^ܼ�dCKa)3t��A�ܙ�H���u�e�"���t�M>bq>vq֬=R1n`Hߗ�E��D�B�t�I�q~���3��Ў�v���15�5so���o�/>sss�]p�/��b����VB���ݑv�N��Ӣ�����H.S�V���)��Z:���on��ŭ7F�f��N���b�27���K f��Y��մ��0<N���$cd�0%I�Xb"f��U5t��CĪ��G� ';���"��CDUTTD� ؠ~��&%ŶQ���ЭZud����,P������{��W^�Ϝ;W�����D��:�!�J<M�g�i�׈�ۗj�e"8�'Z�_"K'��~4�Cq���"~u��ډ�"�8��a+�}Q�1U�^zZ��%[q�U���5��z'!�BB��~@��ņ�k�*�+|��y�V�;*��^���a��{P�M�fh��_����~�� �4��˳'{�I����6�#fV�/��������{�M)�v�����wؠ�����N����A,pB�W)�|xڏ���+/�E� ��p̧�+�D3�/>� b��w}a��#M�3��l�tL�OGiɥ��e���Q�[%P(wp�÷�С�$IXi���tW�o6]�.^v��X�03����6�G���������w���xgU���c=���B`����!3�9��[��$*����w�y�,D{�R�&6L#w��ޕ�'�����z�?_���zǵG���F-d� �ClԆ>�)(U�@C>d�G)g��r�n��'D��M���,X
�N9�DMf[c:	���{ �Þ�lNa�{�������j�� � ����x��3��e�DD�i����ak8�\��h�93���(�u`�A�޿��D����OcQ��H��s��e�����#^�l����v�@,���c��rɕ4�1�2�[R�{ETU�*	1��yQ�M��ίA�>@��J�^%������*�^�|y��d��W!}����Gr�� >�j R�K�뜇���_�+�_z�K��C�oUL�M���7U�m(�1h�C-�j�&�H(Pȹ���灱���������1���̋0��7�#§ܷ ���p�T�8�Y�j�xεױ�"��L���P���I�Y>×R�/7;�������ԼΛ|�(�����% �"��/��5�?��/�:5�9T�޵���[�z[E6U�U6ds�٢�S_4��X\3�R<p��f����~0;�gW�j�����N׆����y���T���VU�S_־�:�h��+z�Oe��>��Ȉ����i�$��79>v�����N_l���K>�)�V��OPTZ��ӚJ[���N�4H/2�i�4l���|�3��Q����}�#(�<�9�d��:-�k��Rcs��K����TK�P����8���8doFC�,���z1�<\�|�IS��=]U��y���޽!�-C�#��.\�������_~���_�jG�k���B�q\O���XXX��KK4��Lkkk�����YD��?�i-[�{}��f�f�&Z�҂`ZDN{�1�!�4La���0���I�3��ꍝ���B;3�=i^t8�)jѺPi<��jr���Az�@�8O3So��2:�4[�Ő�������AK6�=x�[����hο:�^���^�*�W��py����%��:1���ȩ��d�^��y�v�CQQx��7ʸ�E�Loُ���2@}TlD�DΛ�X W�?`Pbl4:K��a"xP�x��hm� 9˜S�X���:���)���<(*�h�����h,+�@4�Q�F����7l6k��é���?�3[|�\�[KK�_��_�_YXP ���c��;TE��1l�3��[{�����Lyg�tt������ַ�?�����^1N%Z/��pݍ_"|@�f.��,Q2i��0)p��Q	�<i�9�U.�%�kz�Fn]�T�
�¡S��+�^=��D���M�x(���}��^XNV�_|�����̴ t�1^D襗^2�?�<��X\_	c��E's���爛�6��igg�^y���ue��N��ַ��jW��C���x�z�S��y�$����W �sdK�R T)l����k�<�Ɣ�������V5��k�R>  B��ߡ��A$�K�'q�/
`��C��$�A���\�{����u[YׂM��>�J�+�K�tاwRE��藕i/�8ܟ���ﯮ*�Z����QU�S,rZ�X0��8�)D��[]{f��� �	�ȣ�J����O��h�A�=s��s� �O�L�N���v��M'R�F�Q�D�DީW��GR��+c�Cqc��87��^2"��n�tF�$�� N��f��$ٜ9sv��s���O�"���X�y��W�n(��&� ��0�<T�Ә!��!.F�τ��nH=b���y���R�#��\�S�� ��8Pf�2����8������2Y��q����3\��:}QI4�����H6���Y�E�x�K3�H��l0�=��[61����ҵV��))�4у�Qӌ���c|�k���Ϟ=��0=;���7����� �i9���i�
8q�K�}���{�5���~�}p�f��|ڍ���C.Vj���$,E�K�H>Z�,D��r67��q* �|�""�^�i�;�c��Ǽ9�XN'��Q))P{ƨqIGء�`�(y_�z!ur�2��j�jj���v��Hk4���r��ɻU�k��7^������3���۬7�a�&j�Gz�����K.���K�k1ߞ�����[��ry�{b-0=�A�P���/�:��P}�^����5�e�y��T�e�z��rO�b�),'��xV��K�sSr6C�����{��%U/��6�������C �~#����Y��;5��o%o��#�Α�e�^f�	ClM@�=�d��gV�̬P�jIĈ��}~�]�ȴ���-!�\7G┢AT|	e�^� ��kQ�B2��#)/`�	B=K��P~A=B��s/
B�fP�7�(��p��e�W�}Rz�Dw��7k��[ã���G���z��w��؃}�S��|\J�Fyto�"�;) >-�����̭�իW��>�	{cL�{�[��~����V�2�^�p��+U��BՂ`(o��D�R���O����NG���$�^`��^��������Nx Q�ц@	~T���
�*���n���hj�9�TwV�z�������w\�z����y�������?��߻G���;.��l�*�EŰe!
�M�k׏�D�po�oU�nV#65"��5���!�.z�Ş��N��{{�t(��?���1sؐD�^�9ׅ�Q�3�}��p��x�V���j�<����|�v�R���BO�T�$6�&��NO�(�G���#3r2����p�D��+�YT.v���I���y1�AQ��&8�� 侟���bT!����;�!�ɠM"��ķ*Tykhh��'�|��/?��z�T�ˎ�r-��O�O�qB��QE�0�4���x��3��n^:{i�V�{�r�����g�|ߐ�A�Uԫ#q\�^�2��W�h%����B���!�%���B8M�X$���m*�T萐Cӽ���u�Bp$96:�C\ 
� P�6U5��%�	���>E���؋������DDxaa��cr��(�S����"6�i��l�JK|L.�^2+��#���.e���O ���^D�l $w�V[�V�U�dY=�Ä����1j�UcL)���	��AR_1"0&XW�Dmb5X_���(�*�U�����͜�˺��1�u�w(��G�Gt�2;;���w�ޭ�?�5>d+դ2�;\�$�RI`���i/ŏ�Hc�������X�`a��{��+��]����$OӋ
�����J�C.���=�*�D��Y-5��*bɜxＨx(	��M��� h!x�T�*ۀ�z��ް�|/�ɷ�I�{�j���3�o��/>�69v�ݽ�#'�	�,�M�Q�/��/�~�����e�di�PA۞i����R�d�1b_a2��\Đ��J�|��b"��=�����9����0&n� �k�9���<�z?���g�0i/��/�=wֲ�!���4��v�k L�I�y�$�C5�`wuow�9�q��ʕ+�ڵk�J�Z��������������J�9I*o��g���w�`��B`(��_wT:��N,�!�R
zl@��L}���8?��(]�btqu�*��^O���?\��4G���p7�ԝj�+ıc6&Qq�|� ���%��߃��Ĕæ���`6�ۜ�*�����n��me�{�q- i>�ʏ��,`!�lB�a��ׇ�����b&kRv�%�X䅋D�lnG�O�ԧ`W����x���ʏ{�1P(/���}�=X��E�(nR_L메;`�h�x��s���ʁK	��@��zi�h_Uw�ID�|ߚ�N��F���U��}��m -��c�X�`1pr� �J���3_YD�pyyٯ��v�w7Z݃����̥�������dBD��l�2HA"��/�A����#��܀��(t�y�Fit^}��v�F�8�O5(����V�\4�\�G �(���W�$F���a��fE'�����8Z���ٹq�F��.?�]�r���+_���N  z)s���$���G^�����(9TO�[�&��J�]E5jd�s����T�<��s�(Wx>ܐ�;u�F���Ϻ�<��<ظ7�u'�.�J}w<�Y�+l�P`ǆc��9�g�OrV7����й�Rl.� �\�2�w^���6���к(v]��A0�����X���"��Wy��ze+�muZ�+d&}%���+90j����K�S�3�?�����}��ȋ��,�8�?���·�����9� f��ۀ�I��!�|�x�Xk����I)q��"�K�mR� �a� �totd�<�������? �����d�?) N��s���z�*��g��ll���.��Eafg�43��o��V���w��������T��B/��:�ōA�f�	6AR]�L��2ݩ�>
n�G>��c|�U{�iZ�[y��Uh�Uٚ��Ԫ��!C4���x�K�;�;��d��/�<��o[�a��v�Y��E�(�j�=3K37f ��i�v�Vu�ݪ�n6&�1e&�����j�QM�2��o��$�&�;���=�+++t��:����g��j4�����2��쬇	��xe���\��҆7�Q?�K�|壧`��c>h$�e�̫��l�}RZ����v�r�K��W  ז����_m�;c�sZ@�֚!�JplL���rX�aYG#v��Y�iɚ�8��(J$ֲmo��E�t+��K�D9~�7!����1 "V��ɘ1�2t��˄&�}�l��Cm�Ȗ�nY��6��Ƀs��=�K_���T*-�|Y��ϛ��Yz~m�����ʕ+�v���� 89���	 V66KKX\ZʍAἃa�z�{���r����݃C[��P���I�,<�r�gT唳��6	]�1`2~%�\c�r��͇͌ 2%~@`#�haI[,3z���1u/��J'������BX�(�}�RlGL`c�<���e�yQ}��:�O]�w���|q�����;��O?���uU������Y][[�g���d�zwoĎh�m�Ҵ;%*`��7[�����^�q�}4������*��GO��f��������7
�}����p&|�C���A4C�c6EF| ��B��{���0�,Ry|3�+O�p���τ�2t�]�i�K��6�k������� ��w���Ƹzԙ ���?5O��0Dju�;i3��2�.6Xo�<��hA�����.���
. }��_�SP�k\�@ʅA�@#�Gܟ�E1tIA
"U�A~����y�\�A��1��uf~@�wt��c��ZMo��Hu�Z��}���c�"�����%������Y���������d�?) N�G�q�2��*����Șvc�ƚõ�N3���Թ�.���m�=�V�̼O�s"*�iz�LVM��j��D$���<A%d�f��+"%�.������opc�6��!g%�����?��,��T0�b�I�H�	q�������K��u:[j���[��@�|�v&W	7 \�2x��c~~^09�o~��W�W��_���w�?���v�gTd��"6l�#c*l�a����>�9��L@q攬d�����:��NNҋG�o��7�i6�'Ax�ӆͰP,�����R��S)�'߇�hD���QO�1�W<�n�v�����X{tx��>��O�����?���K�/ѕ�+Gf�ݩ)���J�d�ԓ�*�&�VF��b�� �{H|�R�i����_.`�u�C?��.;D;�!0��9���2��+v��c;�F�����4���~�{G"��3�U!�G�Nŋ0a��j�a��Iž�$|��ȃ��������4�dՃfv	�����f��AS�^�^��'���� ��#gj4hp���)�V�;m-���ֽNW%s��{ ��	R��D�%C*j� ��O)����yP?j!3��$=^cH�ǵ���iz"�1����qr�g�]#��V�ֽ���N	��ɝ�t��������(̜y�w������iv��pMU�PM���Uʅ���+
V���Sj:��4u�k�*Y�sg��0�h�XCQ�u�����q��r�_�\��5n��k)"p�C�MU�o�w� mx82<��g���kl��祗^��Z�VvV�\��l�z7�d<a�7f�
��^������G��~������Mw<���@ ���.:�c.�9G*!1J�|(D��E��^2�꾊���t���$��N�N���?�+L��q�{�GNˉ��Ipr|�M.X�O�"��E,}�5u��������j�4!�#�!��s�f��qv�Ռ1y_7(�ѺQ�s�n���2��?�v���y�&߿��\v� ��/ vCBĤ^�Hj*2)г^����t�~���W^i����n��_��{kuU���)�z��HD`�m���?�ϭ��o'�3�2q�@C*��
��-��C4%�k̎���0a����{z���tgg���xiy9yw団��Or⧼��Wk�`'!�=/E�'���rR!J�}�[mGs�����]v�A���yzxt�V�������?O;�;���:�h����!��E������z�C�L�D����� �(�4Xl���ܒW���Gݹb��ǃ(���_!��/`	̆�P!��(E�(C��� o�SRJ���J-5~O<oAtCT2p�<ݫ��WO��~����"�y�y~~��v���z2�?) N��j$p������_����񛿹��8��=T+
]ً�1͆�E�d2�eY��a��<G�Y����Pe(Q��@��yP�?��tJ�{2���X$���T��"��1�w��ߘ�[ #�b�i"}�6Sn�>:�����/���W��[�׳�X��6zc U�6�x�{ԛ�$��XmZ�p%�a&�"ŔzI4�4��QgU��^��M��a~`�yHdv�k��h���F����%�
��PX^^ֹ�9�7�k�ټ}{�ۖ�^���	�Y�V�U����89ǭY��L���w�4X�i��`� ^S��8b����$�5!sOU���5zv��9���̮�b��,^{�����Щ��R�z����K�V��W6$�[A �g�j0��3��u�"z��H�v=�`��o)I�r%N�2�P��C�b~GQG�//��Q��a�?�^��$����DC�&E˰��}�&����tC��F�T7�C�s�v���յKKK�0�@�r�����	=N��>QU@�{�W@���3���O�~����7O�����S�ON�gh���a��E�˜{��t���t�N���y�*zT*�z�^ Y���qI|8G�~��}��>��!ӜP��j�8��~�\ʋ �4��y��S��@�ytLO*�9/x�0k�۫�a ��W_�+��K���JZ�o��]���q�{C��}�+��NMݬ����*r��4H���_&U���y�E��L��j%I֪U�=d��GR
��n���P$���A~]�O������u��9��i/~�{_�m����)ϝ�q��L, "!�*�#��F
J�c��z�z�^��T�����ߺ���z\�s42�$1 ,�aq��d�D<�J44w>j�#`��?�����CѬ�����q�����E�($|�$jS��]z���ɰ5�8��06q.�N�i7E��E�ݑ����,ۇ�&�0�}�1l�a�����~w�V����o�>7�'�ӧ�7�ę7����N��l��?3�����bs�#����89>��@�\hnn���o���;�tuI���͞wY�.pp��o5w��vw��V3�vD����%�1��J@�؄`4�B����K�t��������j��r���F�F�Q���S�'��f�LTUC�$�$�uI��%uMn^�~���~�gS�ش���kkk��iO�(�b��[Kxmmu���N�z�vE�q�U3q�SC�{H�R7�f�f���&�l��.�BѸ��뵺Lt�;�!�	!�՞��#��R\S�%^Y���(ifp����:	�6W*�Y�>�y�)7�w� wLD[���Zbf%"�E<{�s
G�L�� =�����<i�����r(N�.��+��c��$��}�1�2��w�-�k����$P��w��ED�
e
q��@�a���63�}&�7�}R쓱۬�J*������ة���?~�.Zk��H~߮����7��/��� �����Qb����'�������,���4�/O�UJ!ށ�SUٹ����߻�L:�öOwL��p���@��Q�Q�3��"�a��ƀbZ�'/��G/[/�cP�ǿ�R��~��cs8V{3�"h��;�\���Q�E�z��#1�6�}���Q%����;��
��P��j�ۛD��ޜ��.]=n�->]�[�Y��g��up���;����݇���l��7�Ԙٚ�����H�F%�k�#�����;�K:�|��=��sz�hgn��Y����T�xDZ��*���#B�XCdX��Rt>������o{�
Ї�p�.L���l	j��"n6[�j�~RI�����m�k���v�@qN�N���^~��#�J���{��w!�v���.�	�\xD`���n��5KA�-
��U��+A!Ro� ��h@`�����O�����N-9[�D�9t�x�e��%�C"{h��Cf: �Q:`2�	�mﱘCfz 2{�$��8���>�s��J�0ˎ��.XX^���i������Vuni�X.sTO�����ا�J[Uu��L��,���`L#rxzjT�7�����&�+�Mמ��_TO�,���b3�֢DdL�a�^��HXE��ͽ�Ѓ�	@����o%��T
9�/b�*�1A�+�1�ϔ4�Tk4���<��R�����ｽ�5/��7]K]�b�9�����)^y����zT77;����4]S��%M$�<��a0�:��fP/M�nÚ��ڇg�\X����711��"���� ��x�e�t�+t��Ϛ��y�W�jS��>�%���%��������� I$6�����X�cҖI�V��<<79���Om��i�A<�� �O\�[�Y�b�ds\���]�;.ud�	my���LM�r&���BY!��2bB.^� ���|(z�-��T�e*�lj-3�5��ι�Z���Fw�(�sH,��<�nݴ�� ���;I�l%��S�Tv+I�C�]V�3N��������.�$5�tm�u�&��x��s��*�EYT���WuP���ޫ��X<	�9) N�pl�Vٙ4@�~a�6��khl?�_���w���Fg���|׻.R�(��s��<U��Hk�$�+�D�0y����9S��͸lأ﷡���}���q��S���#�K��L�@�
�}� 5�L\E��a@��t��kOm;Ƙ}�}^���@D�}����GN������v�״<d$w�1��}E��쩦�S��T���mXݬ$���yrwbb�1uz���9��α��M���cΛ)Kv�Ȍ��!�Xk�_~ȃ�`U֥��ҹT�g��(��J��+Le
j`�V�l?���γ�mZk��@���Y]YY���Q���6˼k:/[�x͋�3l��f:".�y�#D	Y�܄)F1��\"�i_� )�?�HT) R"��?�ѡ3�qx��e��^��P`�L����fفx���.*�^����V7G�G�GF���J�[���Zb�Mjv�E�W^w��.V�{N�66t��>.���3��t	��D�R �����ե�<�<K+++���� ��"$>�,:Um�\���~�Mj�$z �k׈o:�wnD��8�F�
 �^d�@M.���`���X��l�?j��������A.\ڨ��D�2ƻ�lU����$�9k�9���{����q�e4����7�(������U^�]�����ش�uc�kyJc�t̑/�̋�P�V�MQlQ��>q��J��9�>FRJ���o�?�x��7�1&3
�1W�1D�(C���R��>,Ђ��h��-E9��C⼈h���a�V9|���6�nI�~dx>;;��F�����~�5YWHa���&���P+�F��T�CHR&�!~)�s\���D
��G�B�QQ� �B�Z1�WC�	���Pe���3/.u��	�Ś$%B@���m��]����W�vk|t|���齩���ٱg��涼�������,��ss��%�.ϞH�N
���'阛[Q`鑪
�.;�k�	Z�pUi�b�I��4�R/�^�T':��u�0�,�T
ᕠ!iOr38��q�e��>nۢAT�|�>'�~�bS�H�bކ� ��a�
��Tt�J[I`Ҭn�L�U����p�_��fs����^n������w5;?�s1< ߼�I7zj�`�fHFC���S���!�{�޻�>P�� mV*�= m��� ���E�a���e�t�PDD�����ܪ�h�HG��)��󞧂F�E��c8!	�*�I��c�q |�('����4�Ҩx�B�j�����Z8��kR�{��FC��<Й�������[[˒�웤�QI��2
PM�$jj��B�BD�Q,v�!����`�A0�1��p����Lq�!"�7)A
��q/	+{0��:�,�P��dƘ��JʖR�#���	�b�[aکUj�cCC��^~��F� �֘L>X����++X�[����ɦR �?)Gn#��>  6΋���?�c1Yu�Ҫ�u���i��^����]R�iQ=�q�<bk,��.F
-ψC�J�W�z�������P�[K��9	�=�`!���a�V�� 襺k$m��ec�:��?�<<<�k���.
���⢮,-Μ�����;U4@9q�,����7��x���Vm����N��L����wU�2�"-���!z@,;Y- �,�������]l4D������Wu6��|�N��+��P���Z'65b�d#ύ��F�����[h�?�(T}0s0a0�$���\WE��Iж�&C��;��Ңe�\f�l6ݔ�:�r�.=5uX�T��Xuu(���>��,K2�>l�c$jd`��ecyIؒAհ$Bl�ِ�?C
�d8�D̹�QWB�JR
�Tx%Q�)��A�=9"J�(��;�]R隊M+�C�JR͒J�	#M��4ku���a�M�5��[d�Ι3��9�8 ����O�Ӌ���;Y\O
���'e�Hd���\W���W�� 쿱s�ֽ�k�l5�η��-�e"r�D�V�Y"� �!RԠ�;:�+�   IDATa5y OA�ʽ�X3�S������b�؟@=/v��.1�UT��0�U�t&���W��T��/�$0��.�̬֚,M��ٟ����?����N�L�0.��a���1�����y��ᩩ�q����
a�4+�]��s"�ve�V�:Mk^|����p�������\�t#���9.��7(�7D�Ġc�D����N�r��vӮ<b�����'"/")�CŪ���ޞi7����:߿w�@�cjV2���Y���k�$uRe��&l�زgK���c��1�aS�cI@$l'��)�2�:�*N$+����7L�Sb�@�&1mN���Ξ鞞>���8�NcXF�<�G`����@FD���ȳׂ�s'�Ipr����F���ޟ�Xrey���{���[�G�݃�}�tϪ�jf/��	�H����̷�/��4����5�>F�� ��jTKB��'	�S%tNWDג�$�*�L�ɝ�=|�ٽ��ý�<w�H2+�$3����[�ٳ����z=�z=���o �onJ����B�Qn��y~�Goop�������O�T�[�j�׌����%%��_"�).ib��Z:���9��g��qR�3!8�<X��M��!�K`��^��i+��.�dk�����^/;�]%�8�ZlE����g��ܨJ̬*�n�3GG�s����?p�Ɯ��[3N���0�&�mcoߺ�~�������*�V�r��Ƕu��-I�N|�@-Rf���Q!>8Dz�B�Z)�T�<���SI���.nC�;��;��c�n �ޘ��d��јjI��Փ��2<�׵��
� �sޅ=�[��fn����>����>�	`��2f�[�]����H41��h2� I|��;
� �1j�j��:aɲ���9I�;���;��dccc��3�d �N���*2$�J�O[[[����Z���z�%�x�5�����o��DS 4�W�������=�~���-��J��1�������d�L��>�ig�����4yJOen�L.�x�.ZJ�l�D_
���Jp"��S l������v��n@�q�OEY��]jܳjUH��V
 T�u�n5�`��%!*E�QՎ���J� ,��,f��h6�Q�}���k�M�P�I��t(��"kԹ�y��h.��䎜�S�N�J]�&G-�<l�:{�H���w�TZ����~�j�8�߮�P�m�M۝���:쥫�.mc����x�a��Ti�k�\3�AY�M��(����]0T���x�9熒�'B��Di��@���/�P|�� R3���p�4�*
�y뭷�яl�/���d��sr�R6J�=iq�el�!t�t������� ���u��\P/�����k��u�<��׌�_����rk�Vʛ� �y6> ��u���z�m���.o�M��1��[�O�Ƌ@!�_ˏO�;O��}�ʭ���k�L$��F'Nr/��,�$���v&�AѭP�+@��<�T�?�J��Xi����FT� @Q�+��b�Q&$��5nw�S4SPFV�;k�ˌ ,6��ϗ޿���.3d�@�__Wlo��k���MZ�O�����o���F�݅���(Zi�R˶���a��9�F���w�����YG0f9� 3r#K�Ԙ��仪�i�L��Iի��K�GV���X x�X���8���4�-Q4��E�����G�2 �A��a�1 ��Z����f�����=Z(
L��	���>mn�]ܸq�f`17�%t�x�6ax�n�~��97_D� ��u�xx��:^�/) ܿ_������Yp��g�������5��&��Wj<PS���`�J����/�	8�ÇÇ���F~w����r�rYTgSI�Iá�1I��L{�O+����T�2�!��<��P��Mg�������KMQ�,m�0��r3�,*)Dg!�D��'��ko����ӭ�̫?D�?���SW6��������Z�h��/ �`��Rri��-��|��<M,D&jA��C̉1���~چ���� ��{�J��>�A@�GA��5��0qn;&ňTGf�G��W�+�G�b�?C�|?OC �w�m+
!�j�����c�[Ń/���c�C�9i:�&���z�,��n�b�퀜N�L������~��''>9J&P:!2��e6�Rj[�`�gpWDf��UM�9��j�D�LB � �CA�WC�Y�����;-���8�u� ��bg]�bj�:����k�^ 8���$�2�B��:>|����1򋳳t�޽c �3�����mږL����� 0� ӹ�Q k~ggGOc�HG��"t��p�糖wyGD;��ٰa�p䙵T��l�"�3�ׂ	����!ʽCMI�*ƴf
��7��Xk�Ht`��������>V�r@P�ɿ~�O���C2�'|���p��Ù1��M��M�z���+�Y�lnnj=ꡧ�D��&���� ��	8_�
km�ۻ�p�=�?<n&�-�]�v9�v%m��U�	/nY���\�$^fU���	v�D�$"KJ�ʱ��w>�+���I�*g��v j�W8�)�z�<BR��(�E}:@�ˡ�����&�Ջ��SyN��#u��H��#k� &[[[��m����	(p�u*��]U3+3;&vY�4cq����)
�c��T
�p����x����u�H���S� ))S�\ѩ?�Pe�X��Q	�bAT0h��ߋ)�M�q�$'m��&9��%���,�F��a� `��}�h����k*~��V?�q n��k� ��� h��O�l|Q���מ;|�{��1�01�5��ௌ'�Y>Z���8?���ʌ8۲��$P�X101yxb%�֡��j�)�@=�)���Ju�Z� 8w�z���V3C���A�	��l�}�&�h�z�6�!�Ð�KA*g����PUx�!���׿�����G4{笊&�Ō4��LPRRf��6�����K�xͬ�(Ĵf���5d�5v�mwO�g�滳�33�����+���������Դ�&�h
�&��Q���m�����FYa��7@Fࡨ���|��὏��������}���ex\ɼ�\�J�̆M�6/lE,�ˠF�=�9H?�UR�&|:��@D�#�ާ�� ��F���k�E���(�d$�|8N}�gM>ulF! �Ռ�.��2�T`�%�5�T�}uZ_�_�����yY\��}lY�xQbΉh�$����-_�|�pqa�쯯��v���x��q�A\� �a�ߧͿ��#08�^���=����Ɔ��� h���T� l�1�95j�Klz�������褝�H�k��I���nMT���5!��;]4̆����z5t��!0�" ����$'q0@�>�G=��KHMK�Q�o; ���a�]��Q���s�{qr^�ZN;��L�Ӣ,7p���������G�7���IbX�-��I(�BEU =E[��MR
���H��B�a�Ts���?*^��{R��cR�OMkoy~�����>�(bss��w,N�?D�G����>Y���P�~�ı��:z v��M4@���?��V�n���G^x��`��O�,��������������'��WOF��L��.S&���u�D�0�8 �E�>H���($��} �Q���|e�Ԋ�WO8%~ʘ�TgO�� �J6 (�ja^���Ģ$l Rc���u�/��%R�����Nۥ? nܸ��+7+1]��B���_��{�Q��:��Α�Kj����
����Z/ue?���o��K,Y��_���j��"u����w���ٞ�������;�y�.�~��"��3���S�<�'�1�׏��F���� h�s(�@tg#*�i��%E�����= {�{�{�����u{�O�����	��O�K�$k��7���8���T	'r����˫ք}p�E� �QMW�{��:ʝ�`a��ذQ�	�l��N��p||<���"����(�?�}���뿝�Q��Ӆ��L���*?=���prJ���q�* ��g(T��,�&'�x�/.�C�} 3��y�x, � c��
����M4�
nA����������kfkkˮ���^�gN�+D��y��מ���W.^~�e�7��R�U�9I��ҏI�]}L���"D#��a�3_�N ef�L��$r��]z�oL�Wi i!V��*����:T��r��nW���kmb���ۭ�v�uq��%�ܛ��w���*���+zu�������ң>�{������2�ˣN:��t�U銪�a/_��5� ��	˙0H8s{""�w2gF�= �4I\����b����DM4�&>�·�. �ۋߦ�[��n=�*k%w��o>������&9��T��$�֦+l͢5X pA� ]�҂zQ�!��_K?[v�`-0T��̈ijP�����S`ITE����v�<�I�l�5�	'i
j���0;�Y�DV�l��A�+��^�oooO�1n�7���{lWY9*���c~�v�q��Fkɴ۳C/���B���XP���,0�g*)�nN�ɝ��5�W$*�5~!��M���;9q���� &އ"������m�z���ҿM4�DS 4��T�Ot�"0l���q����.чݙ����2�_��KY�կ�bEԯ� ��"2�PLVb"�PGh� ��DY��jT��$~�Qq��g������3T�QL����^�S!�&�&֤mkl����'����㍍���Bigy����'=�(D�z7z,����h'�|��Ӛ�>���%PN c
+e"��μ���I�Tb�U�"T�P$�&f{q#Q�xL�;��I�á��ؠ���yҼ�h�) ����&<��m?��up�HU~����ݏ޾���Ǉ����2 ���C��%�.��Y���(a��3X$�S��?j�Lu5�� ��E2�!ߊ�uQL��"�2q0�1�AiJ�5�����J��'F=L[����<҇�W�y2-Ngr�/ъxY��yM�A�!�[��܃��'(��(3D;�j���c�Q�L#a�b8����_��i��z���5M4�DS 4���cc�vn��o���G_��:k���e�����w�y4��"|$w�'�'t1W,�Ȣz]P�/X4�;I��2m����?K=�J�)e:�F�%H�:�,B+\�߆��6Ld��e��A�����%vz��-MNڋ��g���n&{�^�Gk��sg���iYtY�h�/y�%�|d�VPu�0{��-�Y�2]:�z��N*@8"��#+|$N��ϳS�����%�j�Fk��� h���S\TН^( ���
|�1�A�#��0w����w�6���m��mM�[Z����I6�8r��WYQ/�B"c箰a"�0�v�R�
�
;P����4��'-;_U��v*Ā��DC�J�r�-`�ID�˄Y/~�):�8���=��_�+��8�V���ɛ��{�͜z�h�΋��U�P�%�B�O�<��:��}^�0��0P��*t�CV��=e��Su�>�X_]W���y�5�DS 4�-p*�>>���@��o~�ݸ�|0������?���N�d�_v�[��	����Õ��&6� 1�A��`4��:(��yi p�aǿ�-N
� Q�.\�U �VU
.8��&˞�?����wޡ��M����rJA��U�a2)X�(�R!��g��g����*�Te�����x�h������c�|f�����k�Z���M4� M4�i�������Z����h��-�+�^�mc;S����[;���O�Ól_�y�A���x2�O���$������� jb/oT���E��r �����[��9B���L��� V�� ��(�Jb�����Rc�$�^���o�Ó�&R�%�m��2sP;*��r��UP���P�+�dRUxO*C=0w�{j��j��L���K/�[��7TM4@_�����GbT�`cmc�:�����
~ >��;l��� �L�2llb����A����hHE%U����$�¢J*�aͭE�7 0�Y�^��!PQ%&aϞ�t\	R����o�҃�N���tF��|�.��`_:~I���gr�_X��s���G��%F
C-bNSn�P� ��)�}���+���=��HR�3E!����C|��o��wLj���~�=������-�DM4@_��wq���˝*��c��UDF_��7���&�ht$��#��P�ݥ�MZ�4M��V2��I7M[3<OD���U��z�m�\K�����z1"�U��`!%(��&D��a�L	HQMT� J*
U"���(�"���!3jY{���ڭέ�م�s��Gs�����g�<����fO�s��ooo�?�'� ���s�e��I�D���r� ��bS��E��}��TPj+�z�q9"q�B��4P`���M�{˭����<�c��G8w�h��� h���imJ�߻�U�0��ʬ�[@��Е��9�n.1f�O���Ω��<��޹�,w��E]'w�V/FrgT%����5������D�*� �W��\N��">gň,P=���?��ޚ_X�}���������$�q�3�k�qkU_�}{�k�P�I\~�8u��X��z���f����u� �W��
�Yy|h�	>ILz8�������W^Ɂ���ͬ��7��&�h
�&~i*�m�`yy�nܸ��z������ k�~��33{p������H滃�hƁ:��v9Z$�V�[���^�fVH���UZdLʠ��4%b�^�B ��؃)�"W���z	��z�b?IZff��]X�C�?8�vvv���nW���]}�޽�XA��s����6ji.փو�"T[���Rb$˿(�$��( �}!�bɜ(�J���&��Nڭ�������W^� 4b?M4� M��Q����N�����cww���I�9k��y�������N�Zb(���	�d�@((Ȼ��Sb/��Y�$%N���I+Im��&��&$���K��{!�Pɳ<Ͻ�'��ذ%)���V�:^�. b�r&�=���S�@u,���u�Z_כ7o�|�M�t6Il׉o��2���`C`6�(
 �B�����l��` ���窄�pͽ1��5�'��V{�_\���5����h�) ��ULQ��g��{ù�"/�]���[��|���y��2�6 F'D��yҮ�Υ�&�m�Nt&IZ�4�����6%M,;��0oZP�s�3Vr�K�O|��I���l;�C�_�vs�?���M1~n	OT���Qi�����133 �?��x�;�jufD��E�I,�bf�e�b�O1�3઻��_���b�>� 0��֪MS$�6u�g��h��� h�W�(���:����ؠM ;;;�����~��뺽��@�Rr���È����H �CK ёP	,@�p �1Ƌ��X�yn �N��$�Ibg3o[1lL٭�i�>�x�\�f�T�.#�$IB�v�:���;j�~�h�) ��U�j���������������_Z",-��o�>��(����T+���s	8tD�a0L&@]t�Sd�[�����x� _@��b�? :��x�A&If�Kڒ疘�Q*���?���UB��*D�U��"��˱��O�qIb%m��B�B���h�) �h�����&4N twcW7(a}��w��[�o�ܨt�
�<ư�Q���n)���k��~�zbK�·@����f����',��90wȰj�W��} ���w_�����@̑��. \uT�;�������k�IJS4�DS 4�D�Pҙ�3$��g�@��ٟ�j�&[��}z������Qw08�uy6�B3��"f撟_��0�E�C�~Y���r!��@��Hb���~��3�*3�Mnr	�>NS$I��h��� h��Oյ��9�z���W|��!Ƶ��ӷ����@Em�_�+�kwq��j��M��
Ӊ��Ͳ��<w�o��-;bmg�qw�O�^|[����1�D�kL�S�{��W4����a�DB��������J���x6F����h�) �h�f�L�_ޡ2�q����C+�с��?m���M�����P<|N�u��]��ƹ�����J!�-��hiB�l��16 ����G�"��l�@X�0_"�A!,p$����@&vr�����UL �Y4��'VN_�sV?}&9�w���K����777���:mooO�ӷ����[���9I�a�WMb׍1�kV�v�rb�l�Wef�LA!Q�;x�>+�3�LpDԠ� "P��5�#�Z���l�@�����^'M����/��מx�] {�Z������t�a4�D3h��G���ο����ꠜ�Ks��;ֶK��Z�v `6e�%�h��O��i�鏖˱�UP�&HS��BPr$p*p�4�&�h
�&��bT��:�Q�ӵ۷�Ebc�M�M�!�0�� 8D����&�S�(�8  ��z� "��*^�x�x��+��&�h�) �h��

�x�IZҨ����\����ń9QCD	��l��D�g_Dཇ�'V.�"���G�X�����Z�A8h���9����xv�� ��D�	@}s�S��/`�B�=�����t��&���&~� (}�`0�1��<��~���1�a��f���e�z">��F��`�x��\�M5��Z߮��c�D!��#�"�6�h��i& M4� M4���+f^~�pp�Ur�F���t��+��T
�{�S����o��:���iP��
A�CU��x��x��6�/��_A��&�h
�&�h�3ba��r+MY&Ψ�@�x��{5P�C`&�PT;.�~��"e� �&TV��P	 �
Es$���ӓ� 0�*��u"�V0�^�z�������JO��N���ܥpT������m`���[[[�����N�W�xtgsSQpTˇ�;GT���}��DS 4�D�kl�ƍWOW �o�ش��H!J���8g�1�ޑ2f�a�@��n~��/< ���k%�P�'Ja	$�@���eU��T���zx�ޫt�w�z�awc���cwc�~�6�'pko������	@��p��m���U]�z�b���ښ���Cb_��[ p+�+g���{\��
�k��^�b=���o/��_���Z}X{�[��׀5��K�t�����}�X��ѭ��@�7]���M�xMQ�DS 4�D�O �4�\��*4Ċ�QR	cB1છ�����UO (�p���I@�*���{���R1�������Ztǽ^��=���`;�u�������b��w�E�� �<-�;��w��/.*��M�����>V  +g����o��w��:];�� K��^����� 666�,�	�ֵ�;�^Y��'��5E�h�) �h���n�bCl�(QՄ@	 ��@�Ty�Nu��RQ@�8��z����f�+���9�ֈ���i�h�\Y�v񺽽}z� �v���d��n>~��g7��͉�DS 4�D?�����o����5���&����!��]�"���ո��pSN�R%���/*f���e&�D�j�M7M�'�?��
˃��]*&�D!�1������&��r$�����r�ٞ��4�IZk[���56��ra�u D �$"TM �������\+�VӁRC %��C���DHS����؏- C̏Jr�����Ab,ka��a��_��}�on򫯾�7�����	 GKh��z�H+6�L �h�W�@�x�#c�r��A��&�k�� �T�����5��GM*������"�a#ޥj��� �,ˆ���6,T�*H�P�0��2�~���n���A��A�6�<�Ff<�G4 ��-�6��.=����kO8�Xke�X��B?���}�7o�^I�?۬�h
�&��L�1)���&Y2d�l�`��9��T� I�nkT��R������e�+�@-���z2$"҅�sY������{2�w����^������L��p����̖sf���8OvI�d�̺�Y&6�|ʙ�N$��N&��&ʞ=y�������`'ֲ�V-c��7N�B9 $Q��M����?!g >ϝ����,Y�AĨ�#j�;j��΅��Ha�F�ܖ6�%3��t��x�sqn6�<�����s�����f��i�8j�z�:{��B]ݰ4�
�&�h��J�
F�ڢW���k7��������t��5��7~��w?���a>��B~S�y����i2g�Đ1 ^=��P���(�_on�DR'�S�"�1@$DPH����d���{L����?����7�꾽|�����'8B������af�\:�g����i��5w��+��nٖM�)�"�j��<�ܙ�{v���;ɡa��Pe0��ِ!V0��E���!&/�`���ND��D�NK8a��mM�TӖ�����J9؎��q�݈��x���Wڳ�W��2����5�����
j��x����֫���˴�Ҫn��Н�=�u�P
�h& M4��������/N�A��ڵk ��ܜI;�$S�:u-�R$t�$␰���a%�2��W��@53���OF1P��爌�tU��ybٛL&�xp��o�h����=����#>j��;9e]3�3�Yv2G�s �*k׫tH�P��-%��aI���$J��������BH��*$����Ob( �'%Qf@D������l�L
&!��C3�@<V��r"*���`"� �Gv4><�r��7^-_�(_Y�잹�,s�+�F�aQ; >MRq�=JF���I/�^$���% ��H?l��f�D����JE��a�|��7����~�G�ÿ�e��P�5�b�i�5D�`� ��ا*"�D�$��W�R��qzBP>�0Pb�� �dp�|�"��m&�C�Z�]n��,���z%��L+W�x/3��*s$~^U<��3l��.3� h{�m��z/�9��;r�ë��(U@��H�qT
��؀3 p\a���� ^ԫ����d�&I�J����Zg��0q�H�N�˱�r�}��ʡa: ��,�f[s��-7ם��s�ڱ%��qf"��n����d?}���nqq1�W��r��5�MG�D3h��_��f���*]�)1 t;�������@�	�:"�5�F!�BjԀL���s�T5��OY3��k�@�s"%.��Z� �(�W]��̐]1y~�;f�����Z'�
iKD:*��Tg�U���v �j�!�R�UR&C��� ��m%�Q���K�B�X8#�G/U����c,ذ2���)��J���sC�8!ȑ�A��	�Iq�9�5�l�7h�]��H�x�x!�$s��t�g��˲�$�&?���1���xh����g���$I�y��/��N��� h��/\���������������a["��0��OA�QFW�]0���OT�H�(���?U�}U���#�L*q]PG� �T�C1��!�QYUgzY�G,;VgD�Č�U��ZUI�#U�Tc��Ԩ$�HdU�2��!2&EBV�)������\���?0&⨒��(�� �b���pi��� U��N��zq�B' Ƥ4�b��c/>q6�����*���L�j�N&.ϳ<�#糡s2̳Ʉ�����������OOF�{��,���$�ĕ7�-�z�4���"�) �h��/H�S��z��
6�o`c������T��GÙo����I�-8�y�� �!C��@UU��;?b
��b�Ϙ��M����g(�LZ/!4�.[C��R�U��J�H� ��Qw� ))�(�� H�z�'O�(3H�@�'�����`9��WM-�叙�&\F07�`���@�� ��W5�����XHU@rAa�!�9�D�1��"�87�s7q΍�w�d�Տ+0R�'N�h���''w����=���,�$Iz�ܙI mmm�����&H�'?M�����4�D_����֖y��3v��W:�n]�;8~a29�������k
ZK���;��Sl6�;�j���� E��<��v ����J��&�F訡�}�0�1���Z&S�������!G�4�}�fEJLZ(�)��4n�����h�(N �O��BE��D� �pkZ� �()��Vg�xL��ī��P���DD���8�s�e$��u$*y�(0b� I��v���3;{�ӝ�۶�=���x��>����4�r>����~@=���DM�D�shm_��n���q��}�ϒ��:;��b����<��<Ⱥ���s�&
�����L	�+*��nj�t�Z��5 U�ɸ�/?��c잡���0�10ƀ������?�z��&@P7).,��(`
�B�A�ᛥƁ��2�
�p� �hs����GQ^�DB�[��X$z �s� ��{��p���d�:��DU�:�E%tL��Ĥ6M��{�~�g��<��|���}�Խ��+�}��_�k�V��K��2�S'!m^�Λ������^��6�¿BѬ �h�sJ��^�"Ə766t��&�ї�l�a1#ϳ����7�4��81W�d�c�z��,���N!��L��0P
��T�r��?�� �q�
S��P&R.R�	 �"3+��A3��R��T�J,}�C�&%��i#���
�G 1�QFap� �+����
 �@��P���!F᱀�_�ǯ�G�V��,�N,c ")D�*�""j}�<��ɪ�d��ջ#��ݶ��s�w�>8N�� �N� ���{_�h����o.���>p��n��:�M4�&�h�3>��ꅂ�~��[������/���+�8{NE������1|��5�Z��bcj�@د�DK�n����ҷ�
A�@��H10WE~��[�L�����x���O9*�;j(�b�ϵUF����o�H�q����5$�aj��T��Ԧ~��/W��Bi���i���W�=��*�*�*�z�����n�6�I�=���ŋo_�r��O\>�0۝x?�<��}b���ȕOI=���a{{��4@M4���~�xUU�w~�w�����#��m�ى���݅̏/��+��gU�%%z�eclפQ�߰�1q�_5�!�D�Ԝ!"��H���DC��Z�#���LoJTc{��+����/� b�N�W@�ӂè�Ɵ �z� �3 ���W@�H���S�"�A����L�RK �JX��1�h	������8?��2�X�x���K(���R2������֛ݴ�n�;s7��8!3̑�E�؂���Ot:'_����O����/i4+�&�����mllP����g��w��霈���\�|��s�^�lV�e"ZS�+\"���0piy!�\�rp^�k�@�@==��u��	Zs�rG.P�{�*��}B�k�M
a��z��Ш�P���йc��Wm�v�a�?mw\���=�p\5��+��@�@$@a�h�  Q5�*���F���U����L��D��
X��hI��*Ĺ.�̬�����Ew��Ue �(*��(��g�3wU����y���榹��N+������^��h
�&�h��e��uz ������:^}�U�y�&N� ���_ܟ�,;�׼˟T�U�_5d/��.)��f�L�ق
 >1N�^JZ\1n���>��?E�����	 ���0>|�Sx� ��*��������SͦE�N8BϔտNg(	>�S��@�����_�S�(�9�򥘀��S@�|1�h5Q@U`D,Qm�
����)`�֎0v*�X��H��eQj����zC��=%�b2sJ�Ϳ�q�T��9j����"��v�����>�z�8�h�ҿ�c�&�h�8�w%"�ݸq���}�V�d�v4\�W'yvU%_%�&��ij/Xc�d8%f#LP�VW����8L s��
�[}:�������:�҃�0�ܦ������g����!� �k;�w�/�P��* ������g�[�>.Yuj`m���
�Ӳ�T�XSX��}��
g/�z�xS��~��-� TD�{!�^U"9� =$��d��͆�5�~���և��7&�;;Z` ��
53h��&>yǯЊ�DX�\D�c������[����LJ���}���Sdh5���^"�E6f����V� ��@�ԫ(I٨QmPC�W�r�SS����S�rўJ4*v�Sr�ZQ�*��zB?�HP-��@s��z�`o�QҴ-q}�0�0���S@uz����kHu�j�T��<��N� ���4���\Lg�Yka�D��"��dϪJ�DDƐ�a �-�w �	�" ��<�/���ɒhn�4y�}�}���p���=
�Ie���4@M4Qy��z=�o�	׮��7�asS��ٳz�������#?'N.�=��~�ɼ��Ț�y��ghC]�J�&���T�S�z�H�ㆦ�e}d�J0G�m�KGA"�P9�Z2�A�3 �)|U�C-gW�.O�1�n[%H�)x���vUcԪ�S=�SBA5P��ǩ ��t�T�`j��O�}���O��8U��^����@�4�њLlȁ�Hqr'#��/�4��^�@[>�E'r��n�9��<�oR|L����>����'�:'gN[���d\���k��a�4� M4�+���9E����@��Vu���}U������sܻ�=��pfBX�UOxA��I_f6�	����d@�"�z��.\�H��Xu��L��^�>��w-�7�v�q
P봵qsɓ���O��E(�9�e�#Rr稜Hc�P��8թW�t���+�`�j��cz2m�����0u�2������A��Ms!�DD5݃z�^��)�T�� &T<]� i��@�:0
��m%]���0�la/�E#�s����?���&6;?�1����������$�_��9M4���B�ƿ�;��$I����A�%un�d<��F���b6qk���L�Ϧ�t.M[ �D�3�*K��&n��Be�L��~����)_��c��޽��4��C"f��p�ˎjwA��]z��0�ӧr�PC��Vu�_���[��&{��
�(�]t� 8�8�9M�����~�M��x�c�sy��&�Ĩ&t��)�BAgLP,����/꽏�����a� ������q�ݑ�K����e��1���~���.�����ۇ��Ύ{�F@c(�L �h�W'��n��to��>�� ��+K>����ѝ��h2|B����_��_��"\�*V�i.i�0Ɣ�<�Ԁ�k	OAZ\}��p���Zn�G9=��J�1��j!�[W�J�5�[i\L�U��̮������ReGT��j�y�=�
/��XU�@�b	�)�9��J.��^��ϫ��s
#���
��PBulQ���b�p�������CV�I�	L�t@V�IE�9Kkk�|�{O� ����f�h��.y��|���8��ڋ���ǯ�?��ia���E �6�@S 4��/u�wc�6�o6�> ��r���Ȳ��Ɲ;��'O�'���`��(_�V<d�����sDf���0ω�>�*�	
�*����l�:��Wb��씢���������NQ����t����P�)�<r��_��b�,�x4�f1�5A%Q\X�~ͣ��	
��N�1��
�fb�zʶa
�@StB��������tD��a���B�5�t���0L"'3ꃊ� HF��chu|�fTt�羕;?�����٪�z���ܦ�ďo�y���w��;�Ƴ��kk�vwwiqm�766�q%RM�D���~���T�rl�����~�r��[O�=?����8��W���-�x�sH�EL	�a����=�+d|���J�ut֣]�*�����T�::�*��͋ۤ� .�& +���׳#x��)��xu)_T�|����$�4]�T�|�9��A�� B5|�iu�X�T ELI �fIT̢�F��+�S/T�	��l���T�/{b:CYdf*d�������s��D8�3���I,��3*��,�@|��.�yѫ��L�]Fnv��=�{��{��o8�b����N���v����׳�4�ħz��~@T��o�v
\hg�h���E?ίh.�9��g>J�_�ޭ��`�I�$I��p�t	$���0�ff�*�x��S)�L0��3%j��U�?�M_��k�m��/��o��s��!���D!�N�H��̭Ժx�5/q���0������{��]�B��g]&~6`c�� �=�������4Bإ��� -Vuc� \����&p8����I��K���� 0�1C����c��*�x�\J�^�<�s� n��Q�L�0��@q�l<�d���ˎE����X~[=�����|������짼O�b�� 4�ė4j�aܿA�vv7n��͛���P���t�d�������ȭM�{�W�4]%�ef^�����$	�$)w�"�%��K$?Q��^!�N��k��t'�8E�F�w�����]7E���r��nm�?5�`Ias��v��ڃ8n�8y�kK��P����r<*�� 11H�*�]�8!�(\qdPI4В������g��� bPq��= �JX�V�i]���XĿc�FT�T� @�Ɉ�zPD�I,�-,<AN�e3�!i�@�;�Y#���o�,���w�WK�ޑ���Y~��\����E mnn��k�M�M� M4�%�������-޾M���2�����%���Y�3��?z��U&��D��}����g��U�W����f��n�IbSk-YcJ1-��� ��J@&��3rq5�6�i����_m#$���{�c	pJ�γ���
�^�FɟݞS��.�f0q�G|���B+��p.�TJw�BC3j
P�-�
��e�U%��RҠy����ċ�F�UI!�˕���%�/��>a���<bU�g����8F��BY�<>��b2�� 1�`���9�S�KB�00�\jZPE�"��<�g���@�T�1,&O����IU�s.5����ul�7hkk�X4� M4�%��W*g��U���~{���J)M�`���px<48�4��U��� =�'����.�%6�$������{OE��.�>g��*���S^/ ���I�ik�j�|Q�����x��7�z�����	D\�R�E�S$lP�K�H�G��C��{ŇT�����@��jZQ8*��"�ѿN�+�߮MY�§H�u�!�
�S�S&GaM�+�Ht�dL�X�T�!BTY����V 2 ,&����1�01��eH����w���/���k_�ڈ�$�g���:7��Kt�kA����_�����|�[��_\����k�y�t���<[�]�l���sqk^d��I��]V������(3yQ�;rΑ�P��C���W��Z}P�M9�;vD���p��{
�Zg�qJ��Ө�J�� $[���)�3��u�Eࢋ�Z2S��ڝ��)��N u�`�����l�J�`S��l�&������8j�����k�������2���1�P�[��੆(i���Ac����%���a$I��&0��H��.�!�))	�M��&U��J Kr�a2a<zU�c��'oYc~°�X6��{������n����=>}~nmm1 <FC��f�D�۬�����ؠW���=��Fb-�x���<<9�ϫ���%f�@�. zD�m�\&�D���������U���4��Z*#=�P�P��-��Z�N���9���W�A�^�����c��ta�[E���dx����Sm�A�#��mH�%ԅu�0�)��+�B �,oq�t�J�U��Wt�A��X�z����H@�I�)܌�JV�L�+P�<4��J�%"�ӈb�����E0UE���Bc@�"pΕ�.䎍50̑l�d�"@O|��&�t:�{���'��I�+*��/�l��d�}����~uk����.�ikk��>VUm����&�h������{������|z���<��׿���F�{Q����<��'Xy��.�0�0� %Gı�y�ܻ��V��Szz����|V�S��s�{�h< Ӧg�Ae�п)F�T(�՘r���K�N.DX� ���!��mdQ�d&\#Z_"c`
�Xt�8��(~ �@b�x&#�y�(��01�x�"�" v�Yf6 ��G��p.��&AT�9H�z�R������P��TDF��	�^�RD�a*!TEP�u�lʂRc�W�H�,C�T85���X��/^(b|�D�"
�9mCq� �^f�e^��<�,���]Y��N�s��֚)s�h��/_���O�����s/��3�f<̽��OV�����ǿ�瓯z�3 ^!�Y6&affK��"(��v/���s�mPU�w��!�Z�>bpFA�o����j�,�BY���:���/X��k��~�)&A���N)��K�}T�:w"�*�E��/�*�B�*9U$�.R��������Y6��&�
@qF�]Q�,*����-����g���|�╈��456��[!�N|��D�fc,�q���QR.ϼ�%n ���R`�a��M��!�pE���X�@K�B�xj��8iQ�BK�Q���2�33�U�^�ɞ��G�s��.)�`a�����v��u����ɯ���4�f�D���_�
�^��v��g�w�����}�-���d?~�B��ef�"�g	x��<k�� �6M,G��
����8�#�k��z-��龞�Ǘ���әj���A��/��*y)���쁦L}H�@a��&N@D�����A��+�3�CHҹ!d��1X'*<�B�":����"@E9H����(�g@X! +	���]O	BJE���
&(j��E��`Q%e�7�k�i%�v	�Q�Y(��ˌ mx�ªUo�I��&��/���4�D�B�'���rAV��흃��m�\{��5Ge�\ ?��1@tT�rt��I�-$d�³1���&�49�d��4�r�+'D4����}��*Ds5j
�&���& ��ب��[[��4g��`�x0�̗�xu�q%���O[�+l�j��ek�"'<kmjm����P�����RbQQ!�tQ���$KZޔL^����鬚��N��K4��B���^}� �2)T]�4; �ҵ��)i0�Ȑ���x����O���;7Q�XEr�ʍ13�IbG�vh>a��
���P�{ѣ����/ީS��5�QB����CU+ث�T�DIM8l@ ���Ay7� I��W�L�uB%eO��ڔ[�V{&M�f�4��e'��E���.D[�>5ƶ�pWU;�ea�5 c��Q�����4����3��/��#�� 0��m"fE��c�`*V+a�P�-*���+q��͠��ϰ!ffo�G&���$?��������Q6��R��#���j�) �hⳈ�u���ޯ_�ʘ�B Z��1�{��O��,s�x���>'�PZi�cP_���B�7׹���\��� R�o�����'���
=#eT)�|���*t%5�,��/�����P��@��넔�P��C�d ޏ��U��$1v���	��ibOZiz���1v�)كʡ��c���`2���{>��*G�G �����D`~q>VR.~L�;'�'|�`�U�~�}�����Fz)@)����՗���\;�\��&å���r�t����%�e��x��m(u4Ǭ�Pt��u�e-b�C\LT8:+��1����Zf�����L�@5A�c�Z5���rvS2�sU8�		T�`���!2KL��}�eG����I����P����~��_��+�3�t�Y97@M�����n�YU	����h��7�������d����eq��@��s��y�>͆[�6�4�@/ ���.PU� :����S��+n}���y���S���1r������}#���Ӑ��L<$#C%������:����0!��&�b���e�A��=���;j���Ks+��掟�|��;�u�_|����?�x�O�����8;�(���8Y ƌ(fq�f�a3�df�uF]Qt$�m+S���#���)���5F�h-�#��R.���O�J�A�br��p�Z|�b* U� �[ء֒�̀pID��n$n�!I���K�W�#c�	����6���\����&>�q�������	_ ɟv��÷.}|xou8vk*�	%z��/��2�&	�����a6\�7���G�S&�)�Z3�����ldkJ������=��O���E�'�����er?��Z�������0����2��*���=c�}�|`�=f��7�3?���	��J�����D\�'�MƳ33�s��++WϬ� ��/���DU����G���Lz��Y�e�T�Ib;֦�N��&ik!i�9&��]�������w�W\0o���	��$�D"�AE� ��@�8Bpr,�����Ri^(*��1�>��H-T�Z���D �R*��xy�9��������� ���ak �����R�Y4@M������^\����s]�E��:�5��p��~v|Ս�Y�=��_�1+��E�v��#Cs�k��6�=+<Q�	���&*� �&D�uaM���GܱkI�������#��b�eQ=sU}=��J �14],l�(�+�$އ��	�9�ȉ��g�G����M�w��ÙVgHL��1���'����lp<���8c��81�g:�sY�/P�=�����/����TU����$գIB4N�V�=�ZZXh�����\gƤ4�^;Cͺ�A6?�.�����S��+�|�J�8Q��5�����EHj�c8�R�n_�&pT���@0p	�,�$
�0]�R(a�@�#*��aX`)˽������[�ޒW^��2 " ���Z��|Қ��� h��O~QF����).02=!x+������8�<�O���kL��2�	�E ],[�Ƅ}m�ݥ3��_j�6��Z����Ȋm���Y�����Ԋ��1q�T����!p��;��}��'������;��)����ֽK��GO_^�����֥<��8�ɏ�s2l���ի9�id�?:=���_�t�x��<�a�  �����m=�|��իIv|�jY�>��:�h�����y0�;wi2���@���� �%7o�$5�:bB&�.HDL�Kj�X8U .�:]T|L�<p� �缗"P%$���QP�gR"��3�bDApy6�F����ћ?�����\\���: "��6��\��0���4�e� 4F�hw�N��9���[�9�}�po�x-��OO\��$Ϟ���E��UU���sI���!�1j�Q��N^ȋ'/J޻�	T�ز	<sc�WN���B��:�)1�SH��p�h&�z������:��u
T\�#af*Eg��-"@j�{��NďU�����	��'
}��⏯�^������`9JU~d�v�;>�5ks��A�����/� ?�?����z�_�	~�;{Kz7���Yw�zc`��x<N�  �������y�{w��W���`~��UN�e�f�;g�5ֶ��R�[T�Q�_�E��'>��P�J��?f�RHA���� ������@�{� ����!�6������m�.u�o\z�»��W�W�8�;:���k����h4�&���2i ������]��K뗐�a�E�MR s��t��`�:�O�����3��6Y�'����	"�QG���2��P)�WZ�Avՠа/���EM��b\����Z
���~�!�z�'=[���S@�iy� �p �C���@꣼�Z���3hh�p·�;��[�ͻ����oe>�{��˃,d�V�s�����7�=�~_V��������k{�y�v�4w  ������K�:��~�M�O_zI�|�ͩ��zX���wvw�f��O����C� �IƆ��d� ���F~��5?��C������W��g�)��E#n��mC�6��� �`pVT��J��P�
������@\;��e�������m*c������(�˴뽿��'����O����g00����Vlmm���mnn�MhS4@M|�Y�NW��M�����)�t���O����x<X�'�,s����Ey
L�ƚcm�,1E�[1j�A��ؓ3X%:�E@�\�sL� "��#w��*���j*�<���lh���Xy=g���_.5 s�h�6�Q��9��{��0xD����J���4I4?���܅������GGo�ᛓ�W���Sz���^�5�8�M�>���~Z!�+��$�,^$?�xQ.d��v���胶uIgn��_���:9�*GP^o.�sl̬ϲy+��Ơ��J �V|4H��� L\˹�:�fI]���ԩ2�*�%R��7��{7��?�r'�l�Qk4~���O��<[�dŴgwwW�3V$rI�i@S 4��'���.�� "ɍ���wr2��t�h����`2x2�����Q�2Ѭ�֚ĀKi,�����և23���x�n�C�y�R����Y?C���)��b��9j��qR@��ѡ%��$�����[�g߸����W���� �/*����NU���#��ݥ~��[[[EBߏ]���քc������?����"㤦0���K�G������ID�֖��veT������x/�y`�CX,�V�@D�T��w���a@ʪ� ��
�^8M�N��wƩ�ϴ�r�X\� ��_ʂ���P��(`�֐��@tY���'��޽�^8q.wL,�!�@�s�~6���/M����GK�2p��~����������+-������D�M���㫙w���I+�$M�w:A�T�²�؏kP�C	��_������,LY4�x'q���6��%ma��jCKw�9���@ͯ�����(.�ĕ�me�Sh�3��;{�;dՠ>�s�hߚ�N��5��1??��'/_}�o�گ�`�#u#�Sם2mnn���=��k�׊?n`���Ɵ�^���"�sO����3u=��X�]�~����`���O����Sl�m�٘�6i-��K�XUª�^R��α����+���R�D���J���[��
(Xs�
4Ϻy1(�W*@BJ�^����sd�q�ǆ�t��?]^^y�ʕ����卻��[h��N�-U������뾹�5�&�8w�z��׾���xu�U��=m�kȠ�j���wﮎ���/�qu�v5M[��͢�\ �E&�eJ�8 �$$��bKZ�ۋN��|��qj��������#�c,,q�ؾt�Ca�s&�L��ߋ-�(�.��ϧ8�Ŭ�&KDZz���Z4jD%g��a�$�Z��;ss�o^\������m G����vY�~?�l�m]��9�?���2��z�b���O�K�. n�n���'��v��Q�I��m�<���K���)����gO���C�_���ġ[Wf��XAd�8p��f��ֺY�)&W�� ���X)���ݨ�'�s������J %*:GJ+`�:�<���w�����6:�6� UE�ߧ�����f*� M4q�U��0���[�z7ˎ��<�S �����W����˜�J.�+$��<��h��R0�1Gm4x�1/d��j
����+=���$7t����� @�
~��85^���e��N�?Ui9'�q�?�����D8K����P�ٌ�1�ij��t�,--~��o�t��� r6��#:���q�s&���м1��L���������g�=�����yx�k_�Ó;����{w�/ݹwk�xp|�2�ϳ �\d�X�d��T@l"�BBtھ9uLQ���#H3��a}�k��&���XR0"Օ-�T�T ze2�G��Xi,vu�̣x{JD�����D�) �h�Q�Jk[z���|�}�����?X���G�O�'�;��1^Pœ
�(��a��j&�R<�D
I��k��@+��p��Ǎ*�T�O7�Ѩ�b�vV��$䩆�+�$]����_���6�68�R�8�1�ߢ
�G�5������uo����5, ��777	���溢������M�~�_���3��,���8��:X[[���q�k������.æ��x<:<y�������q�OƓ���M@�4V:�'P���Z(M�'�w���C�J<hJ2�m#pJaK��%��!�Z�S�'����	pD���o�����3�ó�����ͦ�o
�&��Y�����.�����}E01>�oܾxpt�ɟOOgꟁ�i%}
Ƭ2t�ؤk�du$�
��>|Y	PF�V�&���Y/K
����+�Ko�@����q5��v�)���+A%�D�A9e(�*��h/<E�b
O��,~�G����J\ymbGT(�jYР�΋��*������!X���r``ؔ�Y�ߧMl*6����@{�����?WvW��*�z�D��t��l�ٕ'��� K�|�������<%�5]V����	 �u;)؀A�Z4�Q
�*L����������1n��A9�LJJJH@�s��噅"O(�sc��g�; �q�:�L��E�z4@M|S��C�ߧ�߾ͯ���޼ys� ��"wy���g���`<~r4?���K��E%<e�\6�٘fj�5D�-@�MW�p��"{�����,[Ϭu
`a�Z�W�[#�P�qS��%(j�l�T@��b{x�l��[�גx��& P�!��]��0Y�
���NUD��A�|PU��~$.��I�f���Qݬ��xQ��A���K�]顇�t�W�b�����jɅ@����ac�����ty�Ɍ��0S>��h_{N���:�^�B�M�y@"���a*��JJ�b�D���GJ`�/(�bV\͟
�h���`s��*P�!�#�E;��I�и�����hrk"?��W髥upq��XM�o
�&~E/�gd|#���ZǷow��?���;�f��i��E/�+��� k �$
�"��"�+�)J�Q��N�8([������SR���z��WН�L���B�) a9���H�C�3�c�)C�:��z�um�r�A���9��=(F�,����G>��=mM����@�k����[[[����"�_��W3fμ�㝝���wO�����"y�P�n���P��S��e �����(ش��j���H�,���� ������Ԕ�JJ�DL�)V��S�rw4���~�#���~�8ZKsJ4@��]�#v¥{؍�3�����Ň��%L��(w˙�<���D�Y%<�Uk�b��F�$!�B	���]��q��Qz�>!p��990}O��P��S]�W�LZ�2)Lӏ�a��}�C�&Z�"K�ZR�x/
�ilZ5��� �B�^��z�(h�=��@4f�Q�v��Or��x<��s��إ{�ޣ�7o6'��{#�V�G���to���>��� �Qf��۽��~��?tGãL�sO�a��\��˪rAU:"���Nx1#�SQ�P
3������S���z*�A~��$�N>��pE�8��NRo��`��2���D���h
�&~�?�ѧ�����֎"���֭�WN���s����"��i��T�V6M��ER'Qt�@pP-�n*���O a�R��8#}J��B�3���LQQ��x;1���I�T
�bd�%c;��R�ĝ=��V�RN� ����E��LH����ƫx%b)�K\��ox�ֲK�=a`Ġaj�0�4���k�:� ��o��m�v�mookC����/l��V��u����.MUq�p��ŋ/��'p���8����?yw/W���eO�ʲ�̻�u�*���|��>es�;T�a�%�*[W����
�*���O�2	r���\V��y�&�>O����<��Cc�z/���D�R�G6� M��E�ߧ�����n�>e����������S�,������^u�3Ĝ2�6�l�k�^LzE�\���9��Z��* !����6VG��
�|e���;�BdE��:�;L�٨WO��:	��t��*\�b�V��R�&����{x��u��~k�?P_%pyxJ��ݰH��X�J�Ib�Qj���ڡ8�E$�x�����+��֭[���)�aaS�O}t�@���6��7��?\y3:�����������H2��eP8�K�.Ne��b�5@�R�<o��7ϟj%챥���/�`Z�$1y�_�'E%s9�&�;:>9:�V���r@��MZ���@�M� M�r5=�8E�+��7n�0ϷZ����߽��;O���ⲯ��B�&�[%RfVbc�5�Bk^"R�R�����&�g���ҽ��D�9������\��V�Z�)���0�8d�
�༊x/���H�eP��c*��烨G���k�E�T<C�:����XC�� �X@EQ�J�q;m�f:�Q;�c͉���~V��IY���x�a{{[)����$��eC '���ׇ���s��	���NDY �"��`+�V���2�^��9]�.TFR���t�D\Y�!1��("c�;�>��ݺ�Y][;�K�K� M������-��إ������T��ܹ����f>�sr� ;Y�4��σ�_nwZ���q�'�`���hz���7��E��8%�]�gx�1cl�(���X�k�AS�+�ݒ�����;���E%S�y+K���Z`J�LDBa ���N��*ŁKP�T;�����b�9�
<d�*8 �H �f�<l�Z��V���l:ʼ���������}��v���)z^�/c�s$6�.w_y�i�;��9��?9��PoD|K�R�$�Đ �'"R���G��������k��<*���@��n�&�
�D�af��;�hI�>�/�O�>z��Fk-u�e��,��7`��V@S 4�厭�-����&a��������?|�4q��7>yr�M���=G�_`k���\H��$i��R ��B*� *�^�B���c�/(pA�τkV�zU֘��6�B������-����$�p��a��g����S辊�(����[��1�hK̆C>���@Xu���Pz�W�����zz
���[��;T��ʱ1�O{ؙ��pa&;�u~饗�Y��d��������o��o)��LBt�!I�I��{d�_��2��yx��Nݨ�� mR�1�B��t'*^{����`&b"3���骄�)Z�\3Ɓ�.�-���\be��"2CJ���K��h���[����β�����z�k��M��/Sloo��^ӝ���Z�S:���7�_���˷��_�O���s�ψ�S�z�	�q��9+���
%-G��z��W�va@�K��ju�/��
 ���p c�]`	J�4���0pPQ�Ur��*��� ���G�Ƚw-��7�%RRfJ��[�	�n�*���n��e^U��Ѹ@P��D�E0��������.�yq�G����^����L{p�B��`ggG766� ���+UZ.����p��	.w`2?6���W�~��׳�o��h.s�l*1�M&$m�R��)�p<g���R��Q�j�w�%;����AJ�h*�`Qx��a@��`F�_�FOL0~x�w�d�a���kY��P%�~�OM�� M|�/_�S�_�>��E�|����޽�}��˓�]�O�F�3��W����,2�6l�Y�Y(� ���BgoB�M?Ud��i�ˎ��0�O�GE��0�c)aU�C��u/*�MT��=R����TpGIp,�*^fH针�o���IJkW	"B�^�ο\A�	@���5M=��U��E��/�wC��}Qw_�>���ğ3�m����~��6��w���~�u�>y �@NTn�O����ErXq���ᥫ��bP����Cİ�f��(Ϟ��sQ+oJ"Rb��tE�R�eOO&~ �D�h}y�(S�g��&>�PU�R�W�^5�s�Z ��������ï�����+�l���21?e�Y6��%�M�4%cS�WSR*���K���~J.�c"/ƕ��`w�=T"�I�
��)��"a&���W/�
�9�+ A��=��C"�a�?������	��9%���<������˱*M��E�b��Wa���N����{�@Hu ci3�(ݏ���/v���,�<'w:�s/5� �� `��U��ooo��Ύ2sS|�Eu܋c���u�]�U�k�A(�I�/�=}����[��s�O[��cя��G>wya�S��TU��p������¶�B�[�K=�X,� ���dPL�XV�c��#�5QyY�ED�iQg镹����RS4�&��cK ���������8���eY���Υ��O�&��,{y�g/ey������6��M�IZ	��e3K1��I���%�-{�}��a���ҧ"��i�t��?H�q� ��*Q�*C�T�T"�^	�{�n��7��r��vf:w�X�.tg1�s"nD��/Ae�"��kv�	� ��P�J�g����RCu%��((�\a�慠w�sgNr����û�� 28n���/����g_[�8;[�N)�yq��_<��<����LG��,��D�T�[X"֢s��5hJX6j�Rp	����Sd�x�!�53,ec8�p�U����S`��V?j=|��a3��J�-0�M�� h���#�Ye����T	�������_^��0γ����x��
�yc�����*# 8d]%�Ѹ��.����Ck]r��OA�<Z���W�ð	b&(� 	�)�00AO����(& u
uP�P��J�0��I�����������"�wU���o��U}�%@��fP�*\��;������^�`���������7�^��("2��'��ǃ��+��R:���r��\�a�u �=(z��i���6s�=�w����?���C���]�D��	�Y6d�`$N�DU��ɞ��� Z�� �D�	 R"�
��8��©xI�������dx����}��!O
����ݩ����y� M|Q�M���U�T��?����|2���.�/u֘����%q����g�b�d��$ �-��l�GSx��-�ɝP�)��{�t֫�c�k���	l�����]�N����&\ܔ���yx��@G :�ܶl�aC?��]|�?�������u����vČ�"#� ����?�^�O��L��F�>�5������-E�\���d4�S����J���ͨ���SU�����q����-/�^�M'�e}��8�w?�mF�V�!U��	�D5ɨ<�7K�+ɪ=Eگ�5_�1��ՅV��<wK\��p<Z�����?_�w����p�)TFSh6@_Ȏ	V�7n���7oj"?������Z�d�'&n�T&�gL�<g�}���X!�si�6`�B�E(t�����'���(G�Ur/T���ڧZ�*�� ��A!�M�&),��z�UE���� �A,�MH�>�[Yq����11��-bܲ&���1>��������c�4�� ��ܫ��@���Bu�g uߴ��¦�$TJW�Xy����_H ����� TH3�f2�8��������uB�x���e� �7� �ë�}k�ܹ|��N��嶊MsQ&�mQ�6��a����������R����R�T3���z�Q��Nb����a�%2|u��?x���0�O< pR+%4D6��G3h
�&��qrrBq�_v��������g��*�g�9y�$�	k͒�v�&	��m9��2^�T��(|aYZ��*�a!�K�}��Dx��2t��"WQtM#$��Z�6PE!��&�>�9 ����=D��!���o�I����R�~���;��s�g���W~�Dğ=`cؖI-�'
$�0a+T+g.���Z*,�ą@Qy\J�"=5 ��h��jx�d��f*^��Yk�Z�c�=U��D�\��z�  {�uaO��������CfT� ����M-��r�!��IU�Vk�SS��)U�(U�X�T��P��%R�ӕ̻����8m�|0�?V���󸷳C��(7� M|Z���믿�������7�n?��d�����_�$/��)0.������$��I����e�SL[�>��X� ���R�T�8��bf�l�p��*�s'�D<�� 7d��=���1�Mk���vZ�-^^��o|�7,`�����Ż���M`}'j!�H�]��[� YU5?�xϑj�d�J[T-,w�څ�Y���1������=�f&@聰e"�����_���w�z7٣���d��sY���󎵆�a
 �GJ��:��pi�%*S�cY6r��A+bl�$�g�^&��B]���j��ǉ�ݛi�8 "߀����/\�W*�H���ѯ���ߚ���4��''�L/6/ا���DJډ��,�p����/��U�{�\z���L�A��@f����̭P�W�����)�g�����/
��)�1��:d�}k�=&s71�&�a˶?��Y��ͯ���ir�rWN*����{fqq�_�����K�􏾗�	��(����j��ejjk�z��޾��c RQ  qD��S(�	,E���L�-7�k=�Rse���G{���������o|é�xp0�f�Y�,�,(��,m"�b��(� �
 ��d%�s����AYL�#hA�e�B�XISQ��*8��o������Cq�'"��zz����k
�&>�c1�~�:���t7��(�ጱ���n6�˃�ѳ��KD�Ek�獵Oc/��<m���	��`0��r�����L`�Z2�L�
��)�^�\%6	#���'
:u
�Z6l�aK&^��쉒��J������۶u�&ɽNb��������J{�� ��T���������^�6�o��5�������I`���-k9!��K����OHe%��k+���R89|٭��J�Zr� F7TUɘx $c%ͱ�H=%j&�_�7g���:����hA�df'"G�����d>�dV�d�*�ExQH;L��=��~�z�)�Y�V`\k&��y,���d��ÆSR��wX�N.�q�H/	�ŏ�>�_XX�x��ֵ��� �͋� M|��k������JP��$A�e���^�5f"nC_a�`<ɖ/c�����#�ϩWU!Q%�j���)�>���j]P'#��?�;D%�4$�(SVZ��Hp�sRc� \� ���'����V���V���K�?za���|���.]�w��/��W^��2mm��zZw��i�@���Ī�D&�l2a;�%_j;��b"�KsY(��N�j%����x�Y��T0�Ҁ�G͏NN�������*�+�e��- �3Ą�w:G�0���Cܬ0��5���fc�8=HC�9m Yٵyy�TbT�;�ΕS�&YC��; �A��^.x����3 L��)�����4V�M���t�Am �H�����;���y�C_��W �����.'�ؚ��T�E#�̋�Rt���
@m�]�%Q �(A~Ep���O����H�3J*j�NY�G.�����]�����4���3?~�����o��;L��B%���&���ޟI�eفع�=U53�c��23"W���%�� ���iAcf8�!<�C��#�P���/�9@��� �	�	
�t��0���T$��F/�]YU�Gƾ����nf���ˏ�TM�ݣ����*"Ko�gf�of��޻��s�Y\ԅ�U����M����=F-�)1��1HT$#ጠ	&�Q�]�l�z�4k������Q�W"ċ:���x�>
�͓�bƵk׸��j�ۥ��%%"��?���&��&�{���x.2����szR!J�\�JCM���d`���#���@�詪�V)��jG �ι����A?`���$ M������B�2��  1�}������g7��^���D�4ּ��%0�"k�8�PB#��F��+�_H � ;_���T��D@"* ��j�8�����f'L�f�$�_��\1uۤ�a��2��(M�:�ΧgO���W~�Qq�5��|�L�r%W������BZPiA)%bá�\!M�����Z�P�Ҩ&Tm�o��Pj�40����������B�ɝ������^k��7p�ڵ#�gww7�嗷����l��&��Y�s�q�X3lC���#�e�IUN:���&6��6�{nUU8q�#*UwZ������F���w��+_6R
qԪ��	pLf�D� 4�#�r�-,,�2�}�A �$���w�n�n����˻�u%\ak/�pRC��F���0*��LO&���8���Wz��v�ac��P���T����[p#N���X�T	��/@�0 �2C@����sx �����6}�o}:{��{���_\����%S Ayxo���͊;-6�ܦ�s�D�@��r���ՖD�
fՠN�0X}�ɣ<M�: P����Wu���Q�.��j��ĉ#�������|�@��й�Jd���5�w�'���7:;��3N��ιYU�
+1M(1(����,���Tk;Qe-��y�V�Z�M`M)�%Z��Qi1t����罉'O1��˿3v���c���d�|ڍod	�8P� 4��Q�{�I���7 &�O~gvgw�Jo�`./�y�J�g���a����g��Ć��#a��'�Mm�g�B9���c�������VL� t�+?<���A��νP��R��V�OS�O�f���ڗq���HI
�h�t��
ﵳ�ɒ�TDZ̦��)Y��]�T�$��cPJ W�5��ᅡ�ɿ���H���趀bD�J��^�!��x���{8�|��>ω;��U���9�IQ�b��ٍ���;R�S`�!J�e�$61���J��O����hiՒ�I��I �Q���M��'���*Z�2�ϋS�Aqz���yog}�-�%}&V�W�I ��qV�k\	@��ڭ�>�`v���˻���r���Ž
�b�cZ�ڒB,�^�6e��HAU5P��+�?�E�#����W��%N�ze-"�ID�٘'�����+���(���w�˝�7�_���O �'6Q�=]�v����k���y]^^��� �r�J3��Y�ψ9��$����~�P�0�A�������G����?� ퟑ�X����&�{��?���{y���u}}�Y�ivf\\\���UZ^^�@�A~�ʅ|�C�&A; �aRc63�Z��w�Cp�b
���u���g4xk�c?Xf(�6������'\�����$?Т�ۗ����k���Fs����I�C��ׯ����K�P�0���o�������]z���ڠ?x��^qW��<3lL˦	Ȅ���F�J�B_1@�Qя��"]_�T�bQ�+f��4~D�p-��*�+0�����f�O�$������������ޓ��c�����3��JD��E�*�0��!������ʊ����HZ��k��V�����v�R�H�&c26d�����Bq�S%J���� Ĥj(��
��=���b�-&�c7��GGz�z���� ~��2�?sss����V�s)�֐n{���$I5�6c�aca8"L����$C�h�,�5-�	��Px�Ô��~6�]�M,T�-�g%Wx�w���Tv&�����A8���~��&h⇊��9]]]�����p��>|�dfcc����Λ����]���T.��,d8+5�)J�&�5�
J��X���r����G/�h�[Y����1��G��� �S<��V񪐈�z%�=��b�T'6�ؘ���x�c��ٹ��}�����Z����|vv���_Z�w}�׾��p.���2���IbZY+!g	�9�D�t�KCU*0?LA�,)z���5]�C� �J��x�*!�>�l�6��[c���^��G��������4��n7������䩋��[3����@MRxh�� :��1C��ʪ!U1LB��ۄ	��S`Qq�
A@�����`���Ie�����;S��7l5w�I ��1F�ͯ�dܾ=��O.l<ݼ���+/��D�@ϐ5cd�FR���~fEn[���������E*��d��	�絪�K����7�4�diMċ�����}^�ιu�L}�X��ɉ�+��k��4�-������_�U-..�y�������+RQ��(�5�y>4>��2j�i�����Qj�L�yn"r
���߇��~���̟i��/��_G��@���_��7������`�;9�"i�0� ��J��<�7KR�Ƶ7L�`jn���%�1�i�$i���L� l�L�;S���4s�M�ğ/dH]t)�l���u�����Oܹs����Ϋ���o޿�Խ��9c�D��@�%f������ٳ�NY�V�m�gX��k<�+.�Ht�סy��3�F �C���s��w"�G�ۤXc����@��O�K����������*��v1��0q�L�SRb�Ȍ���)���p�/�׭X��M�x��0�T��a�0��*�ܓ�D�Wzy��//�5��-X��,���7�����͢8�r��#�>����R"a%�`�Uys�[I����q4��NE�?�5��Ļ)&s�&���T��|��c?�u��NNt���#�VCբGд��ops	�8|��n��ߨ='&��?��l������������r/�;ɯx�3�4f�6M�7I<ƉD��9��W2�Z�����gL��E`�V#��*��(�H���IE�
��7�+�]��#�~b�|+M�?Ȓ�{�v��&�:�=y��b2�2�������Q�-�R�� j��R�fJH���*U{���x*��9��H},Q��2Ѫ�R�l�5&\c�1��^�
�:�]���~����U-��y�&^��^C����=�Ƴ�b��z��N���ۃA?��I`�36qvTUk�T�����9/A�#��5nM,("��pE'.���$I���Vv�����?8��n���@�pM H	v�]jd������v�]9��J
�aVF��?��������~^��\>'�_Q�,�Ɖ9T�q6�U�G�/�����V�Ve�S}D�����:���2�%-����IQ�4nFEQ ��
�� �p����Gi{�ӱ����ĩ��ggw�C]#���f��T��X�*iBh�@�^�DRf�k%���p�.�ʂ�Ep�,��?
�	f8�6Agի�ϋ�;q~�^����+-��&� �������Ɠ'����AG�l����@l,'���D�@`�ͣRl@ӿ��5�j	pP���+��{RQG� �5ƶ�5'������O� -;�|qq�84����y�v��$ M�0BFc ��Ń�?���<ټ���uy���|�H'�MB�q2-ΣS�0��#Nv��5�G<�k������,_��P⺞X": ��>�� ��z��ğ'�|��Lr���w��/���}f^���k V�WuXYXХ����6��(�oU%QE�+>#�i�k��W�儵�a�ފ۷Z�M|����-�1 t组����8��B�U�����I��m�$DaJ5�p����E�qݖ�T(~6�����]}�g0Aɰ�A������=�����-Vv�]�����䚻�$ M�p�> ����˳d�U�����?�y��ӽ�z�ޛ�����c�9�ؚ��`�W�R����]P���TGYhv�3E�@�Qm�����<q�+)��	Ñ=�"py"���^g����]��{����x��_��_^O�� X�'��x����0?�ğ�}����XF���Έs��>U�̰�����S;^�R,H��0h��J� Q
�����*�"^� o 1�j��i*�/X,..���*0:ġ���Z�cl��5>	Ŵ��9�Rbf2}
ka��t�5\�C�cS̕s j��(��jq){����hq.��9�f�0����}e W_+++�"`� 4񃆈P��}��u���U�~e������'綷�_��,�7E�*1�g�5��5P"�Ч'�%%��8��s�x_`Z��22ώ��]	5VA�)��hl<�RQ#�Q�9�s�f-1|�&�g��g����7�� �ےL��9W� ���e��� p��^�?sC
�{D����{/����#yÉ�����ET���ܗ�(V�"�F ,��>vL����+��ދ�
A�K'����K�#�����|�=� \_�������&�=>6�&E��)� ӌ�N�µ�Lb5�G���I����I��I���?��6{�!ƃ�U%e����i89��'n`ORˎ���)��H�۴����?ˆ \?�E�����o�y����`��F�9"�
�b�2Ƥl�pe-+�j���XID#�:�P��9�6�Z�D�;*}�0^ �(|��E.Ч��G��h�������'S�ݶio|�?�������u��b�CU���"�׏�q߻>^銂�wV�'Ddi4+�~j����Q�>�GG�C�c~mTf��C!��AT���bS+Y'�l�虙����b�����N�mn�m�z�G�"?�{w�yw��~F�"kB���R�[9XyK��E��@���[�{J�n�>$���ɘn
�3D~ڲ;�&6����8���D� 4��8䦥���>��|������yj���˽���p�;�0�y&�fc�s��$ �� R�����#�9W����jlӡD	��!90�3�Z�=(6	�KğY��'�>���Ͽt�K���HC�����n����[���䝅w�j�G; �	�U�D֑�U��~1jr�:����hT����FnM��Q�bPC,��$6�N6�':��S�E�SP��^���o��T�����6g�s��y/N�0��x��d��a0)��\ZGd�E$ Q\K�9*bT�BE�+\K��ױ�Ҙ���8H�"gf������f�ү2�(�ñ�E����V�Gk�6����?��r�/����bVU�ɚ�L`��>U?/�{���Ԙ/���wH�T�����&C��4@�l�'"e
�a���p�<�̟'�|d�� ����3��t�KO��c�l��˺��)ςJ��꣏>��{�����+�V6��PGL��$T�-�F�Q-��T��]M���i�?A	ưgÒf��2?31�Ϟ=+��/�E�j�4��A�z�(� `bbb0=}n��K��u�;�X��������1���1E�nbR���Tף��@�}��{8�jH�h[E;"�PKh7´L�ϼ���.-1<jD��	�̻:3��mm�<�ՇϏ=Yr�пz0���ο)��)�"@�`NA�@�,|	�y��HR� !C���WJ��
'Pn\���uClYW�S�S�$�#�s�A��n��2�~��a���l�6g��_��=|����	ˈ��?䉯e7%�����bq�yk����"�HSli�Z҇�+?V�#��O���!�p�MP�N���0o�uY++�Y�M������ӗ�C��W��@�q$����vｇ���٧7�����蚈l�w�yN�	 O���2���Wj����X���Uў�*��`�L��-˦��mI. k�ɥ��Gpº0PM�DmՇQ�� �h8����8�dg�R��(�[}�@��1e��C'����ؘrі&v��|��ϣ��X�~���qP�g�*�
Ｘ��(�Du��{D�if�GY��i���I��k���G����o�m�?������?C�#������~ܨ�Q�v��V�z�e���Z`8-q(��PI�L�(ǂ@�xk�K�:c-7=3�N�>!h�?�������29(Tu�,=%�G*� �s�:���q�fÇOY%b%�hZ�U+�ce}bi����HA�&�i�Y���v
 1��9W>����$ M<��?��'����s�����͗����
�׽�U2t�s���5a��DD|(�UQ�'$��L J�?Q��W_SW�:�ѐ Rա�l3� ޳+��Ȟ�����.)���4Inul��X��]���]"���q��%́���1wzEi��~�=�x�G���˿���4;7�'�1<����W�觠q�p�D#l�C	V�-PKY�ژ@P\�_��Aΰ)�5EֲE�n�q��8d���&��3o������7ۆ�?�dn	hZ	)@���U5+�zqLDA�AR:pNI	����r0Q�(
c@61��2ʝ4M;Y;�X�- ��������}4q��j�����#�^T��?~���G/?��~�7���5�zD'����ݢ4M���� ��U����#�>%�]k~�L�`�x�3&��#�!�,c)p�f��A>�E�F�&l~?�d����-[�^b����I3���@E�~�x�`~eeEp��v��>��/�ɪ�i�X^Y�p���i-�H��1f����#'"J��#�~���H5_�!�L�k�=�RnUQi���n��'i�OLe�>����IN��� EB�<�?�G{l젝��L�f��%�~�̏	tPwQ+%��\�C�?��?e{����ԇ�q"�Z�4MLbm'͒�V��gI6�%Y@
�8�����k�A � ����ٽ��o���No�B�p�z�7��:.1''ؘ�M,cʅ��}��IT�F�Q��p�59ߒĦ4$��JB�7�h�W@��8%qy���S�cW:�쏦fO}x�ܥ���q_��X��"����E��2���#����ˇ����~��_�������n �9KDSlLB�C�0�Gu��D�h!���ƄBiH���Y�������%'P��:UЬ�/v��o���+��/��l�����o�z�+�8��g����]Q��D!�2�ƅ�{ ���:IX�T,I����������6iAm
 ` �$ M|�xwiI��w�.�y��;�_���������A�J��55r�����'��	�>��K�DE4�*3���^��& �k�J~�b����t!	��
5l)�*�{_�B�l��=b����g��?���)��49�v�袋%Z�����D���?dO�Sr����*�`�8lx�A4E0TP����}G���p�K�n�^y�]�w	& �l�?}Q#��¯��������ݛ���6����7����%U@��~4iN��1H�V�	��|F-4E�̩%EQظ$4��7���[\\�G��=�{��f'��h��'�?}i���z����U��Ɯ���H��k� �sp�i�
x�P�0����٫T��a?:���p��W�it��x�8Qq"�yՀyk�`�`q��˞�>2D��c>k���~���#����ƿu<ee��<�H$H�~O:y^�8�Oz��dK-�R�O#��ZK��R��.�kY��������'�N,!�</\^��?�z�<w�O�uh��_��v�Z�,yC�$K>??�����v�ޱ6�cczD䆓��K'�H�\���TX N�k3� ��
$$�d��o���M�,6	@ψ��E�����P�y�����w8a-.������+�&^1֜�I2��Y��i`� /r��}\xG �9,Lcl8L(:�x�� ���I�$��ӐҞV��wN��.��
)\Q�eG�<bЧi�~��n{b|�N����^{y�=?K�a?����5~������`���Ӯ��eJ������0�����P5/P����!��C*�ќ�J�F.��a�֭�y1�� ���`��}�g���o���f�b���^w�K�U ���<me}C�O�}���%���1i����Dh����دSY�G}R&��.j�������^�����nγ&h�p,--��ʊ�.--�	Y<c��=�+λ9(�bk_�Ir�$v2I�$IR0si	��+P���w��S��q�%�^��G �L ꕂ�P Oℤ�NY� ^�����urWT?e��v�}wfb���Sgn�t��S`�=#�h��bP6�v&Z�X.n�pŤs2��g*jP;�c&qD/�~� 9!������
sm#�7�{/�{W�y1��y��s�k]q����7�,�1<0�=&�y�!^�g��AlL���|.����'?�
;�m0�v�vZ֟d��ɟ$�y�����EM�C�Ne���4�S>)^�2�%G�Uf\16������Y��`�J U�:�pޑ�f呼�w������V��W�u�*�c�A�P/��>������d��v������W�\~���������`fffo���t�;�X���?փ~~^�?Ëg ������=Y�p����8�c�L����$�$5yպ�b]=���?����GG�x���"����<�Zz(��_�&~�� p �i�
1�:�jОx�D�03�ג��=��ѱ���k�|K� �������������z�i�bHl�A ~ze~��5�}�L��ZE/����
��e�L��ڭN�l���!R
�0�J�:҃>,�Yg����#ٿj$�H��V"6���S�Q�;*�mR�;U�}f�N����/���J��޹s?�_�v�///����>x����]YY����QĨ:WVVJ^<!��'�:�)ciZ�ORL8�wD}"��V�?Q2��A<�qM�C �H�uTf��@�CD� u�D��sח��>���� �����P=_Ǎ6��ő�ܛ�dA�>T�EeO��h_E�F:xVyH��Eɰ0Z TI��9�ܰ%"\�v��S��މ����{Oǿ������}t
���G�ۥ��yZXX(����S�����ħ����.��e&�d�9g;��i�f	Q�(�
y�� ����zI�� �S����y$���~*Cy���bu�I!��m���T��!�������q/�kƛމ3'z�������;'ף����R��Ct��s?�T���R�T���ˤ;���!�%���nY��+/�cda�x!���&נӪ�Z�&�s�xv�s�H@��6���A{��(D|�iϭ��W��V�-�#Pj�'��WW	�!�W����j|O������>1�HB̆��8�	,\�V�>��C��Q�:��*1�w�(�¨h[�L���T��<�Z�ݓc����a!�&�������1���:��\��콻��g�h�Z�2�	U�
�9qaΟ	���-��ȟ�T	A��J�@��8F������&�^ՋR��c���S6��	j}������#��b��w�UUJ�}���'}�[vg�ޤs�T'�:�@�vX� �keЈ�����W���j�G���a�f��jmAJ�5<��������t��f���n*Y�ҵA���E�w��	�c��ޏ�Z
!��JH���(+0�<0�za(ڪ2��t"�{,�rc�9���"i�����2�_��@�q��O66:�������A���yЗ�5���Y �y�"*q�Yj�~�w
�����]"�<��=�' ����|#H
� ��3`�]fZc�mb�(%��ә����/��� >�M��Q����j4���� ���G���`ҋ�T�H�l�P9E�R��+�º�����FZ�N���?4�Yk�g�[km�@.F*: B�/��R�5�j�8��^Q��
�SB��T%��Vj>� �C����QlZ���Xtǉh0ML'H1#�Ǒ�%ǽ����Y<h�`� |q�a]Z]]�C��0�w'r����^��sd�5ɥ$�3I�$a�_Q8OEQ��g�8���5��F���)$@�*PbpL8C ��V�� %K���g���c�z�U�G�-=���j��4K>oe7����y�E����������O��/[0G?��;�$�}��Y�Y�8�ߟ��O�t��[�Zcl�@A��Z� ��$Z�&�1{t5UM��"Ъ�{0T�v}\���C��i�A�6�~�8v����h�־h;
�\X]�e,G9i���+�����zD��E�zUغu�V�@���q�[�k0Ebp���c�L�`m�`��!C�I�A ������M���7h� |q�f�#���aI-�$2��l���w���� �Z8����u�d��6��6���%�+����x��� �q�j,P]<����V7��jT����w^H���O�3�&����''Μ����_��Z�נ���K�oy~�Z��Hw�v��b���'��8��� �icL<��a�b(�Z�"����u�:5��c5{*c�J��6�ᘹg�n��l2tǴLo���ǽ���C_�t�_��! <+����烁'X�_��Wɾ���z�#uѪ!eI☈�I �԰!UM�e�)0M2�QM�=�ܜ���6	�OQ ��g<�_?j�|�`jm}���������k"z��/��Sl�[[���a�={����U?:�}����>�q���7=��%*a/�>�n@���̰���٧gΞ���[���ھ��S�ioto`~~�����!�����������:^��y�1b�Ȱ�ւ���q�
*(���pǈ�ϱ�N� !��єE�9Ovط�<ɒt-1�d8����k�3 d{o���`�I� �.x�?/���6TUV�Lȏ�cLU3a6�}��E3�����:��ͽ燻���n�:s��+[o���7���$KN�i:��[��&���Hc�Ol�b����缇s��ѫ�Z;D%eG��DPfRc���XA*
W8��v�߁�w��ѷ[��'�N�|�j��S �2�9�<��^�������s�I���g�W�{���I���u�Mj�ecMH ��U�he�,�D~ʃ���/���Z���PhIF����(܋@�$x睊l��sol��p����\�q�������.,,4	�O�B� �t��s��\��R(�$�xO%
6�V���Z'�������_�x�;N���E��ӊz��a�7	�lE����9RUbf$I �;w��^zi{w����7��b��fY6��t(I�^��
���2%i�$M�$eU
x��<�+���� k�&��DQV�{��2�2Xc�9�"_x��p�>����;'����a�A:޺��Kom���k���7 ��v��~�Y���#y�ٗ�_$�\0�Df�R�q6�c�k3��F�F)G������C�0���Rj�'be(J3�(���9��{�c�r��J.�b ����C�����nԌ�}�cqq׮];�!X��lzq�*=(�
T�)Tʤ�<�EU���7���kS��A{�1��%Jj�/ZyQ�
_��X�"#g�2�ÿ���yL4-�4D$·a�myyY��`6����Vo��A���`0�J����2��c[Yw���3H|e�]���VC��70%J�
�x��r�<T��a��h�0y� �C�G����>��x�	���O�.���5A�����y�o����/���������:z��N���z�'LӴa�1�c���Gp����b6t�l���	�ʵ�S�eT@�2���fj�G�M����=��Y��/���"�Q�.����y����!����[�����>��*^���p��~�yL�ϫ����7��1!�%�zUE�p�r8�����x�T5��I �HQ������KQ� &~��o���z��1] �,��Yb���k��ITXK9���5�y��0��,{AC1 �*��^TY�VHE%aK�PQ/D�(�*���Mk�������{��9�w����b�8{�b��������m���C��x���0�x�uȅ�p�P�#�<5������؏�B�]�TD�k!N����{���h��������M׳'|�H�0��>�J~�R�P��(k�q�����rW�8C0J�؄S���D����Çunn�A������&߱�[��ʄ��7�~��?<s���s��.�,9c�d2m��Il��%(�I9n>��s:
&�c�{o@S�x� 0��ȐG�U�G�S��vj��Y�;�ӫ3'fn�u業���`e �;�|ne��0W�L�@p3&IM�S;e��s���e��6�p?T�eS5}aj�=(�2t\�7`t�*�Z2qp���������[���6�h���.������<]�v�J󞓖K?��}y�_8ap��������$��4pN|��w%�(<�%i�r���@�yQ�N�v�k��#�Ũ�Ĥ�MZ������ �+�:��GZC����j�/D�?���
p�}������^��~�^��]acΧ���&Y
2,zK���f6��ٳ���@%��q�C(&�1@DWf����D�x�"�#k�����qglⓙ��������}�+�q	���_YYy��S	�� k��?�R�e�6ֶ�aoU�ҵ��!RE��h�U�� ��P�p�
5^ ǝSA$�����D���5b<&�f���������������"�8$��xn���b\9Z�����/�����{��{k[���{����H�#�"�@NU"
�t�ҺkU��Q�
����8��`�)KS��;�6�6*.�g�|8�m�$�M��ǃF*0U�o��7Ɵl>>{��+^�U��d,�����6�
P���(t_*�!� ���q��!�Cu?��&��2���3Eb[�2`է�zϒ���d�LOM|���[_��{4��N|C5�;�e�ߋ�w���@;˘-��fLT'�y�XN��>�9R���ANG�������ÿ��:�*�)�ē�zPl�cb~l�7[IgЬ�&�_����ɗ���t�������!�Eԕ�?Vz��'>�Õ}��j�|Y�;9<�Z	L�X���z�`���u�� ��M�Bǈ�m���o~����J���G�z��R��UQ�j��[3͆3f��J�����!�:mT�D�	D��Č���P�R2�/p�*���{Fi�X�01���������~�v  �}�k��o~S���ueaE�������u��"�N��)E����[��Z��[��*��)��y�|���B�:2A !�x/$�a=`5�1�F� ,,,�w�yG���;�ț?�N�䩙���G;d̮��E�=ܢq �M������U���娀H4�%
l���S �"y�����G�xABU�OI�X�E�N�۷�~r��7�X���ſ�U� 8KL̜�`�հ1��t�ǿ�C֧����0�Z��F�?�ټj@��M�}g�����D��X��Xk�Mj>�==u�<�� ��̌����t����>�swQ�Bו��y�p�5Zà�e�����afC�T�D��u;d*m�+=���Fс0��UuU��6�F-��26`�.��N�$���u?ke[��ig��#�����2f_��L�*"t�]#�E��?�˖v��{"�ԕE��?<�����l)�������`�ы$�b�Zf��a�Z�')�ݶ!��0G^w$P7L�&xq�}�����������<�y\Q�e@ρh��2�a�<�uT��j	���x��-f
(��H��K��] ��	4Q��pyRl���?���w_��+����=.��#�z��u��u���$%�L��d>�eR�W�����-��v6�L�M�����J�������ȷ(G+���D�ʍ��g6� ��Z}�d�0a0l��fۭ����<��_�>{z{���  �k sss:���B�.6�#���r3h�\�$/�E}_U]��V��HT*���𯓇c�@G>b��<�*��*ba�
|r�S ��S|�hZ /( P "b����3���<3p����+��2���2��D`��\U-F�m���P|��<<xV�)� I��UՆu�T��O�0n��~~j������WF�}�~�m��?�BX��Z1)�X���"w�]�?���proo���I(ƕ��.jM����A-$c8<]Q%]U�_���L���*���v/I��V��555�s�ԩ�]}�e���� ��Z�yQ���^�����zit��I�(�9���t��F% �YH �kr�����E,E�]��l|2�Pr����?�����\�L��T:���s��.}R)ƕUe5�G8(�d������ŋ��P�|1�sn �?%�����%�I�ton��������ӕՕ��IU��^������|��o������x����̜Ө�B�P~0�& #�8�J����C���s� �$Tz �Km�3�۽xav�՗�\{��k`�&�W�[Q��xʝ��:@�VV����X�z-0�*J�N�^$J���`���X6���Ea ���y~���]`�������/ϓ��s�d;�;��t6w���U��e�0q�X[c���7�Ⅲ�_��=�)_���d �o���a!VR�
�s��"ϑpy1�����%��%�n���l�x~~�8���^;-�[~�`���U������n������ݽ���x�{��c��- �'aix��H�T%_q��8YhT��V0��) /�yQ��n��;���?�n�_�>ݟ
Jj���S]YYi���bı|�k�zD���8(�`%
-GY���t\.1z�Gu����G͋�{Q�b&b6"6c5�>s<���D����i<�Q���[����v����3������|����$1LٲU6M���,��n�f2��101�&0�c6�<��ӏ	���ԋB�OJ�J��0}jl����h,�n��l���{G���Ȼ�w/��l��S!�v���T_��W��/�$���Y��U�̀*[�b��d��  񞊢Pup�ω�޻8�O��r��K�E6��j�><V�aq��{QU��~=��,�!_�>��*-����_d�^��%[f(��	@M���a���3�߾�yksswʉ�f�9fs���m�d6I@�A}O�T,?ʒ�?Rm�3t
��
�
 ���K3�T 3�K`�{ nB�C�A����4{��� ������:�^���������x���ZHܴ�i֫�LD�p����LP�����1�h�W;����p`&�[�9�#�T��o=�0����Y�4�=y 𩨏> �
>���]�$��	��W|�	$	
5{�{�l�9��B���g,..��3���������:���s���4Y{*i��Y+�u(�R�f�N[9^FQՏ���'Q^6��5�Qj{CE�J�$A�e���~b����#c�;��l�S���+�W6����n޼)��8��y�%=�q����3�󟛛SGBD)�������tB�΂ua$s��2���L PQ:��G*'�X"�� �G���]I�*^ ΋���b����~o�U��0�1&����afm � ��	�!P�#����C���E��ڿG5`@�Ve}��JF՘"o�&����
�.�3��U������;�Om��u�SƘ�$�:Y�m�VI���o͈���e1����k��~�ș��Q��W�^�@���J�X�4I7�4�<�d�m���=��p*�������~�����꯺�ׯ���7ffdeeE���dii)��?��BI��H��m�������G�;'����43�d�Ibj�1#�̊�Wz���G��Z�$Z�;D���5.�c'/��"}������;�%kw���XX]�ʝ-��F��wϜ9���):�G�1%9�2d��$��X=�CӰ�$�� s(^�-KUV�x��9o��}������д ^�yZ�7��_�(؟��\�^.&��Z3a�I��`fH`�SM����Z0��P�[���#$�f7�T5���R/0dv�ң���[Y�q��g�'N=x��_�%"���o�V�i��B��c��)������nmܚ���Ny��dp��L0s�Xc���eh��?�<���(l:����U��^6T���TwE�﷥(v���Yc/�	���5Bx�͎��3�0R �a�2���)��g��������_M+L�4\�s��@4�ܚ&x�U�!���uie�,	�][[���7������Kū��W��Y�4�Q��	qD�II��YoM�wx�c+g�+"z<YH	**�5W�A�%wR�ݚ������G?w�ڶ�~t�x�cu~��|�oo�����{�N�]q�;9k�O��1f��8�!�HI�t�9� �LR�.gu�jJ���
�ab%�(�^k���D����0x�J�ꊝ,���ÿ�&�5��Hx5��X"c�YX�kP}%���VUlXɤ�T���(����P��󼷻G��lZ M�����n�v�z��u��� ` t>��Dgl������:�I�P�S
Lzф������W���mM9(X�'������?N�0+!�{AUT������'�����w'�'־|��s�����)�-..Vn������u�]Z���n�K���̈�����<���Icm�Xc��U��k�����9��K�^��OݡP��^��}cx�����I2�`��[ι#��p׀y ��E����!�h]�f`2I�$����<��I@���#x��t j��fI`�9s�F��I ^��v���؟DD� d+7W��l�p�2�n�yJ/3s����¹�d䎕�~�Ϝ� R� ���@��c��]����a��RR8�WŚ:��^>��ϼ�37�k��!(�j��Z�v+7V���uhW��.�ꡗ�˦��Y]0&=g��٘��L��Xf��W0=Y����P��B	���dS9��])�R;�Uiײ}���[�Jo��w]��}�����gǈf�P�7wHS�fY����'���Q.�"�՝�TG*��u��8P�Ñ�T���_B�y��m�W� ��i��p���;��������\���K�l,�g�3I� �J��V���G2x ̝Wưq�I�{պ*�td*}�-5A��I���|�"�w�r�t��xu+����{����)~��f1�ao�&-����&�v���14k�OkǬ�����ڊkH���5x��/i՟�`@=1�x� �Lj�:�����ɻ�fOm\��_�ն�����?���&�g��R��R��[$ ��>���u3� -ɭ�P)�,�{����N[�M����|�h� ��X^^yƙ_��{�7oN�y��쓧[���EQ���[�6�,���d��q��J;[�c~�6�W�x�[���ѐ�K�X(�A\�{﷼��̲֧I6v}l�W~%'���y�����~ƫX=�~����Ĵ��'�x�$�d�&mc�1�����N#w�*���Kf,�x �ȟ�fX��+ƿ�T�D��c��^d������^{�Շ_�ʫ; r"���E�[�Fm�� ؠ�Ǯ[l�Ӎ���(�m�v�$͌1�K�C%U��T!���x8�?��DJ�ߚ�U�C54�D�
 o�
����i�I ��$�L����z��}����8�tk����ޥޠwދ�a6�M,�5��/X�V3_e�M1pE�r���,}����u�od�L�(��b�����Nj�['O��{ffv����׉< ]^^�w����(���Jx�U�;q�Ȧ896�i�갵'��36I��M2�
�ѡKZŬ�5�N�a��C4�
J�f-���G�$�����9�b�����S��sB�?��'q���@n�O8t��A?������ h�����I6<n����Ѻ�4�R�|�%p䣶OU6�^F\������gE���a755u��e@���Ѵ �?�V�r�f���r2G1����Ӊ5c5|xx8+�*A0̔�.����.:��Ê��Q� A��w^�(��S���0�&k�LL����_{{�2.��jA�n��܆6���ӧ���q��o�`��c�Z�6ְ;�h�L���(��A�@��_[�9%q�	�Y�j];E�p����AT� zB���$��&�=f������VW�oSE5�Ʌcv��w�)�Ov�&����S� Q@B�y������qݭg$ u[l(UH���)\�s�';�9��$ /.,���Ĵ������rF�����*�K`�23����c���rdB�"��([K��v�W��D���P���ogO.��>b@A��˼��X����E#��_������������ٝ��ԍ�toߟ'�`�!�[�`.��F|Ϲ8�!dI*���wQ//N��	������L�A��YkD�9�����Ύ������&z�IW�\
j���H������·F� :,�Q����=T�����頓pu5�&�����jp:םC�k�m�N�����O�����6%�����X�<{U����&V���<�2(T�*�2?��aN��@)Dt��LX!�4�՚;�K��$�y�2x��e����Ŭ*iqq��Ra�U�O>IL�Ɠu�)u�����sD�*���ڲz/s0=T��)�%`��_�εN*!�"�4*5��>�6��[��ό��i���g��ޏI� �. Xn< ���R��^��Ͻ�V��h;�O������'�����@�u��	�c���Ͻ��h%g]S���/���#�9����];n{ \�f��EB����RWj�Z��98Q�P�G@W��8�n=�5A���Vk�f�/��4fk��$�nk%�6e�UF͕���`y��E�d�{OE��J&�x��p���T�:�>ML��N+��٩��ܽ��~�}p�P��9]<��_����Kt@�������8�=�Y����eW��!"#*� >\߲E%M���CW�N���R��_�;Cth('���0��=�恱�fˤ��-{��u6��*l�Ͼ8���S�=��sŤ���HK)� U�V с�r�����u.�c��A��= Q�3�@�V�^|N�\?ߛ���ģ>pR�d����<d25Im� <!"�E��P�hI������}�hR�M�5Ӊ�	ft��k�U�EHe��]M��6���FE��!�q!��ќ&�Ȇ�����9��S�u��v���d���>��_��X\\���UZ^^��v��� �S�0Ëp���a�)k��^�%^�Eb��9s ,Y�z����Oi�RO��~� ���6�5� �h�zB�c��v+�;��;==�h2i�"�IGb~~^���6��1��`���d�ҁjLm�l�PL]G�~1��¦��J=�C���*�k���^�~2��3)/d�ۥ��9B�jyl4S ?ahm�G��� ��[���[Sy�Ϩ�4�q"Ό����cc�/|4����@��5����]É&R���8�F�`�+�z��*~[�?!�q+M����ʓ¹����`���W�>��?{��q"�2�\b�W��ef>I�YL����O�^�� �������q=	��H�F�J j�i�~&�i�[O�&O<�{���7�~�w�X������B�I6���R��~o/��A��ޥ�X&b�&��QM[�j=��/#���2TKebfXc԰�l8w�~j�~�G���������BC�o��+������U:�������l���������8U����+4%U|8�)��D|�
G��h Ǿ9��}���~�=R� ��a5l�Mp��w�A��Ȗ�������M�-���������{�(3�x�j��V`a�����;�|��{������f��,[s����֞�֎3s�jC� ��G�$��>�q�R%4� �09�8�Q$�HB� "��Հ*
%�����t�ܩ3ۯ�xu���I��##Q]4s�Mcii	7����B9q>�\��ĻLESYcYka�E�Ј��𹯊�r��Lj���1U�K0�X�%6�ds;�=�;"g����͙���F4-�����{�I��)Ί������(��48y���R�-��a��9����*�lxH�՚�o=d ~���{�"/D���c"}@�G
��$y�����Q�����!T�:���ϭ���ʊ������̎m>����Bf�p��d�qc�Q"��*�81V�zZ�@���<�:��FSB]D}������8O�S���+t��[c��<MS7"����&��»�����P���J[ɾ��ym�E@j�1���1��Ľ	Hx�i(-^V�P�X§d��R˵�
�Dm2T�'6ه7�0t A~׎��� �/,��X7�$ ��"�u��;�,������� �Y24�� +�*i��Q[�*Gr @#J0���Jʑ����K��
����'O�q��o'�����wp��{�=�����1_	�.@��U�ȿ��e6��'w��9犋��!=��1bX����bb��5��� �õ	s���hf??�A���0���g`�mx�q^�=� �oF���a�L ZY+��,Ӣh��1&3��1lx�Gg�r��C�WT)CN̨OI���T�i��y��M(�	S��V�)�cs	~r�������#~n��?{�tG'��r����]R�f�Q������"P��fB��?��F>PInF2�;$dE��Et���<I��:����ƀ}�= >4׺]S.慅�]B�����12%~ק/'��
�W��e��im�7�Ђ�U�8�4���(ug�D�F9�TVB�ט��r����p�*��� �;}�"k�~9��Ƴ} �����EZ�>�u7hG#��*��h�� �wZc���v�O�l��a愙�θ��TG��H�Q���H�UR�P��{��}"z�0m��#�]��W�4�t� <GJ���
��Օ��*��Yu
`�X�y�E���f8�CD��h�K"�%\|� ��q��C<�R�q2-��М��{�\_D�����I�|:>>���.�>��O:3�����4���Y]U"
�?�7����2ekkܽ����őu��to<�ݬ�z�WE��rBTҒ�DL�N���P��Q�_�G�f$����P90����5�]�j�IUDEt���b��֠��T��þ�Fg��> ��X�����U¬ڨ�51D��j���Q-���,��Zc��V�=��ɤ1f�N�@�Q�)5HS��H�Pb�6��R5�6��`�+wPl+�n�u���>��}geeE_��Օؾkb4���3��]�nТ�V^ZZ3�y�;;s88e��)�!�e�SdذaR��i|��%˸���ص*Z���F hh�k�ǅ/"�w�ɞBט����i�>�p��ݿ����_� ��L���@���զ�a����������R5F�&���U��D�%�%�1%TU=�h�Ĥ��0��7���Z�H�&-�"�+%܎�ʱp��C`���<��<�7��/}f�z`.�I5����	����]Z*�6z��mҲ6O?A�'��m��0뢢����#m�
���]P�C
A�[��� S��#��3��yjD�U�RO�k(kM�\��Z���yo���VT�1�)M[�$%��Dw?��5t�\@QnVTj��2�eY��n1A+�.W�-C|l>����N�y�so�i�E�++�r횿���2����������YQ�U�3�f��^U�H�Hp"����R�T�wJ��b��/}�s�J#r������ 6���t�{������^L:��Xm��� k,
�t00'll����1fJ�5��'R�����U�#>�0�ڪ�d�xԃ�A�di=˲'O;�ة��EM���bw����{�s��'���Z�S�{�g]�;��� :ADmcMP�"T�u���X!��х�C��A"XUI�U�����=0ďɘύ1�N�'n]�t�����+�����8�y�`d�	�(�]]�v�v�����~��R�%�)Mg��23\�P0���:�~BRSa�8�AC�PU
�C~F@n4z�KD"\
&&�p^|��W�c����^g,�5�j�{t�����zD�oneE�������Z�;B����B{�{�yI����mK�0��P��R�.�ɥP-���1D
�Ϭ$
Z��a�C����V��5��9=q�`�~��1�?���h8 ?�X9�B���G �o~�n���G'���f{��y=àq6l�#3���R"c�A��9�l%SAm�e=��DgJ�/�@ۆ̓V�~>3>s��������i�뎳�y�}��n����Tʉ�o��~��Z?�+pى��՟�"� 2�X$Y���!IS�	�O�sȋ���^��zؚFP�q�>�|l%ԝм�/<�s/U*Ş�C��x9��T�Yr�ԙ�{�ɯ�'�/M]�[^^�50 �7Ȧ���3�~U`q���@���������W���B2cjF@"��T�4��Y�G�vƕ�"�q}_��_END�Ԧc��^���/�R�vP�����}oj�/z&��/z������Q�4-"��&QX $a�r����_�<��1�}M��Y��U���20l���>��w�����sO��~���$��HLk�e~���۷>~������ūyIUOǪ��yDH�B����mn��Ў�ч�.�S&o���ϡA/��*Ն�4�>�>�a��β��޸�>�����7����_X ����]�B�47�j#���<h�ɇN?�}x�僓��)/��P;�`	����ш���K�i%њ)Qi�M �\^�����p�=6x镗s MK�I ^��1�����[���T�f�h��ӸH<DM
�����^�͇~��W�Vz�H��"���)@O�Z������t����PZXX๹9]*]�^��v%G�~����3���ߺ��'������;qs ��ibjQh�x����]�ћ^�C�� j��(T���-�`.R(r6���:`�M!z �����V����_�N����_\\� �[O>�ѿ&~���ƍ����3��;_H~YU.�pZ6T��j
`5��hP70��K'@� $��^Ļ�A=xs@�^+K���O�m��?m��\�?w����.u�ƍX�r}��ķ�ma�;/���IQhFj��O�C[�%������P`����Rg+6D!Ϋ�]!������o��l_>uj/���P��2��s��}�U%�pinn�fffxaa���?��d�w�����O��~�z�/y�/	�*s�ٴ��
��(�'�<�
�F�l5�?bh2b�2t��ђ��n�İƪ�V�IԲ&�^��@U����!�<M�ϒ�޵j7 ���k\����24�f�q"$"����?������o�ν�;��X�e�x�G|���~���<�J���11ʙ������o�s;��fi� @��Vt�hF[��y(6I�]}W��\��̌ M[I���8HG-UM�`@���uT�����}�hiWt��@,X�D�za�B꼈��~��u�Ie�{ Ƚ���<}��X�ۥ.*�Sp�C�+vof�㧶6�gEqũKD��.�1�6�	3C�R^T
W�ODD�$�"h�����(Ñ���9�	V"A���` �s���u����,�4mg7�Z���� \��,u�Z��&��oO#s��.a�6 �zt����s�u��[Nܫ"z�NL�r�(a*=�CpU*�DQ��f�� �{��窲#�o{緼�]�� @� �z,�����M���(	5aa�HLB3� mȔ� V�����Q$������0o�-���T�+�z_$h���{U����߳�'|���SwED_�e"�5I2f&��@�}@h�@�����|38�?c��_
U�~E1�T����'8Rp	��PQG��$��I�&;w�����S�C�a�6�gZ"�;�w��?.����zAI^��@4Eʬ�iT�<D�8J#O!M�g>zgk���x�����y`�(�~��> �&�B �g�A ������^��}�'���an�����1�)��q��G�}�_���6�����أBW���Ii�X��&�����β֞t ���P���9z�dnܸ�7�7��c�������=�z/{W\��M�d,keH�R��RQ�Y��U�8G��h�\i4�(����cm*C�� �!eZ��;�s�/�"Xo�Ƀ�<���ݞ�};'"|��_�f^XYѦ*j�X��(�G�３��֍�Oo�<���T�ς��L�4e2�+¶"33�#�%J�G>�aĬĤ:a�-�KU�/D����u��}��> _zk @��mĭ��9:��A� ~ar�-R�ƚ�MM��i����1���~()�cj#���P1��<o��U)�k������t��jmM�OoMMN�Zm�Q�؄~^���\h�Jo����̑5ཷ�nZ��������LD�1I��J�>�4}� fB��O�CZ1��pM�#���?� �_�����^U�@��8_8���+\�9�N�I�$M��_}�l��������*eFG��Y���},..�rO�81X-/����w���퓛�O���Ef��I2f¦�1e2�[��Q��Q�d�l��ǖ��O
���P��v���Nv�=ٗ�V5o ��bPG��h�� `��v-DS"����	H�5���_i�=�
�a0�Q���q�@��z�@���$i��2ޙ؜81���v�eK��/A{�%.��f?��Ù��!~�O~sF� �◈�<3O�5v��T~KU��?U2&RA�U0��j��g�� /L�y��� G1��n����ӧ^�`��]�L\�v�P@�@�M����jmt�]�X6�Ot�ww���.z/t��'٘���
��梥�H�<lJt/"����}�4�@��C��So�񺷻����n������������@-&d�d�1 3F�r��{�G���iC9�������q��~�j�o���;y�0��|�WZ��K�����c����������_�o��᝗��&/1a�����C�,S)ʘF��Z�T�����[�a�C��#�� Ｊ ��1�7�;�t?a<i�Ξ�fȈV��"k�OW����~�����}��ܟt^ϫ�yf>͆:FU�T�AiF�"�����A��C䀈6�C!<�ғ����{��T����h��P�(
`�w�$�Z�|[Uڪh3��Ī�K�2#ER�c �*k�Zŵ����,����5"��o��dc�g&[{W����R%/T/���*}��_������[{���	����n�ysw�ˢ�3�}%˲�I�M�4�0Q���^��N\WY���:�#j0��G~��ot�Sp�^	����l�6���evZc���8�v��K�ak��&�����*���Ȏ{�i���N��1�}V��8+�j�Ԑ �b]�^�@���b�}b��M�����  D�ދ~����E�(/{�I�w����v:���-^;
m�I�便���z ���O=ZV�ش��T"��J2�h_O!�XnO����Ҿ�/}����|�>J���_�<��v���{t7� �=����FgWg�����&6yäx#M�K�&�JH w���	�(��	���𐯸 %�7;����7�j�3&
P@�*ix��T�V<J�����|w,�h�3�i[��_�K�7�(�;��@�M<smԟ��������ʘ&�%��HOS�qx��js&T�Z��GR%��rX�+��	A5�"��	�]&Z3L��&�fI����'����?X�/��8�X��eM4	��]�~���"/�h���	�� �o���j떎 gTw�����9���>�bCDE���왵+3Wv�~aa��̭T��E#�����*l ҇7W��a֦�U��+BxM	��t��i$}�W>�C#���7:�լ}i��9$i�o��N��ԯ��j�� �����o�۟N��}|���O��֕����C�4V"뿑�m�Y���,XX ��%�c(|�����I58��*r�3��a�6h�C5����đ�Z�rD��>�j�?~$�}�B����2�`y`,��d�;�s��𿘟߯����P&.�:isW�����������(�����2��*p(�d~�W�����%"J������`�:�>q��Wf��>����Q���a� P����'2����3�������JtRU�^�!� ��>�"=��$ln>NR�*(*�qdF�t��N�I��*�n�PÜ[6; �g6�7>޹}����?�����l%�檊���l�f䯉�LV%�Y���H���w&����^��4�N�%ֆ�YU��$i�S��쯗,� b��=�����c�uf�O����`j|������I͏d���cU��[^?P4����{����t���Pe5�0l�ʱ��:&���y��Q�p�DD�԰}��>�&}��ߋ
�Gbqq�E�7)���W���#�93����������\V�W�1�X�\4֜Ѹ@m��E/^�(��YK�&�L����r��jT�+���(@ظ������H�f�����Xg��Xg�������N�����J[)5������|}��j���q�2D��^�2����\�:�i2�6��?���Q��ҷ����X��6�2G6R��!�� �6�N����Yvk�3��W/��1fd+ss���$7	�OG�}$�>�6��L}��[bb�@�+a�Q�X��=s���}G�	���LD{�̚5Ƀ$i=̒l�e�����ܜξ>��"���o�R��������g6���4�W\1�^�iz�ؤc�!�=�<G��� ��E�$d���"�@T�� ��v�#d��N֝�Fe�詊���ۧY�=��srz������9�`��C,,,(�W~�Dao�aAOU������;7�<�z��`�_�K :ML�d���(P����(�nXU�<W�X&�T&�^�D�GLkIjo�[���;cw���l������1�>��[��i�3�;gN�� �D��)�֎%�T� `L�c�Y�3����}��IB��A��b�c��*2���ʞ|���׾��J�^X[i��?���݃���^5DW(1�ؚS��!ì�b�(����l�q�	%�ad��B>4z?F�9陯�ƚH	Px�z�`#K���c�wffN=������'��ST�l6�&~��[��̼D� ���=9���w���_�Eb�f�4�_2��:�2=��ռ�ihmW��+��y#M���c���'�?qz���K�7	����t0ձ-NRU߲�fDH��M4�)�bD�z�1����ї[U��� ���;!���d�����I�35��t�+��n����˺����/O�Y�$�SZV�ݯ�=���?9���e����D|5as���6Ʀd��������#z�;��D6AŏM����:�3�AG�T����T5�8�i���}q�����wV��l����4�S�J�n���KZB�KKK�s��ǟ���:ؾ�������u�rU���%ĬA�'l*������w�<�cɑ�Ą�䇨�*y�UUr����������7��=}efv�/�Ȼ�.�H�g��M��uŁ�c��~&�֣�q{,1�c�fL�2q��T����Jݧ��Z #��ڬ���[}�@ G�ki3k�ONLNn\9yr��ɿ��L�z�z�ϥ��J�/�.�W��U~�7����$����Ho���`w./��@�+ z��}���c�lb����1�$6I��	Op���w��"Xc��)�(�j���������U�F���9�:��+�~�{y�|�P��팷��N�|<��ϣ}⪱.m��M���n�K����]���Z]]�E,���Jrk�����?:����K���Z��/��"��2�8c���8�쯇�U#{Q9�4��a2]����y� �9����[�I6OLMo�23�`��~yyY�����ww�k�I ^�k���4ku:�f�aƙ�E���BMP&J�P�����C���7�p��&Lp�[c��V�sjzz����>x�m�� ��(��� (�̙3:>;�%Y���7˟��T^�sD�~II�B�9��
>��N��$�,�3_8����L*r��s��* 
�����e(�d@9X�K�02Zn\JP������/�]S�|���A�A���m �c6�R���8+�W�����ܜ���iw��u }p��ԣ��g7�6���k޻WE�%Q�%�1g�b.�*�k��ׯZ��]�}G+>�����r����^r��Bd�T�@�k��������h����Ѵ ~B���/�>Q�d:�~\T� �@�![\�'܏��ʵ԰qlL�$�������� g�y��a}�w㿽���o��}�v�8�_��3�-6�e�$���cL�c��|�`f��;�1����Ò����J�OT��*։�>�;<�-��̕�*�//���כM���K7�d�W�s��G����?�V�tk}z�wp��]��U/rY��߄������G�=I|��t�ԸhmT%'���DC�/J�`I��PU�{���۾�]�I{ �!�#��  /@,�� �<g�>cuc"~"c*���	�|�R���TV�ub F��z�p�	�J�G�pj����<M�|r���\�q���I���_+ǲ��t�O�T�.������g���켼�י�U�؋I��L�d,�2c�	;J���ʝ�#l����Q@�})���%i��6B7�ЈQ	�dh�/}�J�����Ș[	O����j=V].n��B?�QV�宰��T9����E{k��������W��9G��$M�Z�m0����bD�Z���U9���|_0�^��=�	aA�C���mq��{�N�.Μ��J���E�[�6�W� <���+�rc��U�̰�(e�1U��^Ɲw-�$5�x�@��X��'�G� ���!��x�ycLn�)lb]gl̏c\e��<nj��E�v����6�_�0'&�*/��oM޻�6��d��`����7t�{!I��4M[Y��X[I��
�x�TcR�q���7�e�`�&
x�)h���7Pݾ����#$^�s)|���$t��?16Ymg���uN޽:��-"IҖ_<_�&~�k%��� t?ypbw��Ao��<�콿��4��ʏ���'bB�ٖ�-ռ���a1T�TQ	�ޫx�CL�{PlC�D����x���ߞ�ԁ�։ɴssst�{j�OM�'~0��ѤO�tLD:
I�xC� O0d���`�Y��9�����%@��Z��3s��㭵���#�uԖ8�օ�(�G�Z��������w���ɹ�u �1�
3���L'6I�$���U�`��Y�DLP�Oo���2����*��k��C��Ҵ����ғ�QL�������@7-'��;��j������ғ������K�UE#����X3�0?!rV�s�����}fsg�|л��%Q?�C&c��DDI��dR�+���6e� �� P�"ke�9M"P��r>'`��������䲑�� ��U���V��Z������H*"\�TK�y�կ<�G:n�cq8?�"�UQ�Rx�\D"�8���<#����?��>&6��ݕ�uc��g�}pu�?x�żQ�i��&ƜO��Il�%IBL��z ^�i8��L^�����.�F� \�P&�R���
���{��EB��OS�~�J[�f��{����˗.�͜�Y0��Y�X+�Q�T��?���7�1�]������W6�n������� �akZ&�DLJL.l	^��(����!�q��<�JU���`��./�w~O���a��N/�{{��ދ�&h�H<��!=����~�$$Ė�2"n)�"h�P�P1Ji��F�c��J���\�0"Eu��#a1ι�y��"wi+s1��	����,�����`�XqG^�1 қ�oN�~�z���͹����w�� ����M��r�$'�$�i�Pa%�*B���	��>F���X&pH�G&/LlfebOD��R�_���А������iM�L�O|>�څ�3g��{��0��ND���fo�q��bM���r��k  �|�����\X�X}cg�˽A��ι� :�֌'Y�(�KJJ����9x�IT��a�����p�%��U���I�>/
�{���z�}2��>��h}n�?9��(�)�H�x\4	�so�?G�����%Pʠ��S0ۺ?��*��X7�.	\���֔���B� ����s.w�pm<�fmu�.,,`nn�VB�q�9k,��H���g>��񅃝�����g�+~AT�&��+֚3�1�I������d	�x��R����VcL\)��&a0(��ؐ�����!�(yU�������9��SV���]kw�{a��'/���׮����4�� ͂�)���y����Jp�TUv�����lr�`��N>�Zŗ��?�{7/�Kdx��$1���9piD����j�$�)��r�%
�Je ����B�$� �N
ߓ�mH���7�'��3��̗ߺ�`3�>�NG6"�h���'�c�A,�I����CH U�]z�e��1��)P�y�'��z���n���E�e.T��=T�0�֝;w��<�3�d{�J^��@��W�q����)c�l��R�4��J�)>�0���Q�A^mB#R�k_�84�"CD�(;q$^
��Sv���������N���?����]f�CIQ��5ql�����^�~}dfn+	���g�������e��k��-%�������mbRT���	j�U��j��. DC���heoM��Tx�%�cR�c}�j��|��W�����-�}���Z^^�?��h�7��G���aC�Xc���l�f��K�����a��0�g����;v�� !�",�^�G������tC%(r��p�_<����?���柞��o��+�ݽ������Sy��y5I�%��g�,��Y��5LLDJL24���l�"Z�%���
8B���o�3�P�8��y�T��!� �Q/�
�2`������M?o��fۤw���Wei�MDRZ�.��/..6�gM���C�~G*c"�և[�w�軧���/���6�rj/ZkN�Ԏ��2�hУ%��.�� V��jh@M�4�S��zQ =c�I��{�,�59ֹs�ԙG���/m�U���onx� |QbD""2���0�D�������Tu��w}�ְ��o1ҫ6̤���ٲ1��}��y0 $���;W�K�^v���ine�����3�����\5�+�#�x��{��~�?-�wك_�kLt��Y3k��sF="l@~e&�h5'n.��$-.F0�aP��8"vR�����+M� (8e�B� /��.w����1�Q��ϓ�~����N�ģK��v�b�\ �!�٨��]���v���bqq1��S�����/��ll^���׽+���mb/�	2�I�&1A���W�Ô*o��|G�ry��K���`怵q��!q0ӖM�v�}�iu>?ub�����-c�;���y�]YYi�x� |Qbƨ�{Gf5���B��x�ِ����ИhD�7�e�[V�d[kLb�Iذq��y�G��Ւ���=�����zf~U�_e�����X/���G���`m�������AQ|yP�_.Ŀ�Kl��65i�a��T

%!ee��q?pͤ�R��Jxid���h��&�P��~���\���˦�>Ȓ��ՙ��g�O�?9���\w��k��M ��#T�u��O~���ӵ����"���"��e�&'�,ke�p�_U%Q	��P���6����^DP8H����R���j_QE�~���d����3��^�t�/��_xr�ҥ����6���BE�߇������ʮ�N�}�Z{�sppM\�Bf�,�
�jeUK��f�DG{3v�<��y��t;���0@㈙��	���v��'&l�=1vDGw�5V2,u�jS-���L�ya��$�8������Z�r�H�Jd���@eH ���n���#�2D�_��B4��I?9�F��X�j(�Ԭ��"րS�l	Dm�� \��rY�����8��t����J�������l���S�v��<���蚲y]D� �K��Q5d}��R�  �())$�y �ҤZ����\����3�T�}�#<E�*�����9��� �S&���q��N����������{��
��x	KX^^���eF3�l�̭�����¯� ���{�?�g����{�/����<��(^eC/�1��&#6���XE="V��}���AI����8�BW �e����@b���
�窢�x��JMOM>��7��dS� ܏~�#^__�w�yG�D�I ���\��C<��+�'6��qg�oD9�  ^HIDAT�U���obH;#¡ �CK_��D0�!	-b�d��� p��K���(7�7?�MY����G^YY)��g�&��k�O�����r�3j1M�̪����&��0WUqQ�!1$\u5P0�#�@M�ȾT�ݽ�C"S��H)�5{`���'�O �^,��'�"P�;��N��d�'Ij�t:�'/L|�˛s���D��u�:ֱ������������x%�D��!��?���������^��eQy]o�1W�����V���"�$��D#q5�/�*.�KCp\5.����`�z��[� NAN���Fb�G�c��0���[譭yz����!�ܬ�6	�W�o�{�f���t�e
(�UGĢ�gv5_҂�W|�ٕ�Bb���FIIE��\1�V�V�t<��}��'��c,��o��EL�������2!/Z[���z�-�������ÉO�ſ��/d�W{�y �;��F.1%3 �&6��<��.[Kbb2V���bH��U$KT��"� �=Թ��4����!��O5�
Uv^ �*�]����)ۇ�V�vg�N�ޝ��?;6�d>�~�ڮBW��mZ�h}}�ޚ���Z2X�G����۷����Ν_�������Jx��̖/�Ď����$	k�*�EHT	��mCK)��[R&�P���R�E�l�]����؂Z���e���.��4M2�"w歷x~�fY$D.As4	���N>&�T�\�@�{D�O*9�2��!�+�r�#��s��Z5�ZڕM��
m9�FO������ɻ��gy6@��]}gU���h�����UZ[[���:W����������Xv޽��.-/Q�Ix��z_����?�~p��J�r=��uQ��/�Ą	u��63,�HpꃮP��%(1
/�3BZ% dI�C�B���*�E!*y�^�P��L
f&��'8�\�;�lp��Ĥ��F�#���]|jf��+s/>q����?�я�*�/�������]]Y��[F�/?�v^���u����%����.��D����kFMb-���h�K�$�T�+� ��U����0�Y��
��A��2��l?b��ö;qG �<��sssz�Lh��&�% ���g ��艪;�l2b�V�����"��Z�n�sN�ʽK�o+0�}e;�/e��������/>%����
V�ֲ�ߑ��6�i�y���T� �G������?�a�ߺu�oݻg�?������s"���j~�3�x���&�����D�g�͈MӠnF�W�� �/�0!���	T%Ie�>�g��kU�+�9�ʏ�ш�'DDd_ �{�����Y��=c������^�zﻗ^{�����_[	��FiP	��?^]������? ­[�Z��������]��s����&\a�)c��MR6ւ�$��ǮV]��P�o5d��� �?G�L���{��(AHb_�;������s7����y�3�{pp���c�A� |u�ps����r�r(��ß8�CU=�jOD|�il�C�:��7�>/3*nX%Ho"�.�����|�9\��z��[��%*"�Y׹�Y\\���������}��c ��6��P��s/<6�\n�5hN�I��vsӚ9�=���ɫ�ؗm��Ycg�qQa.��&#i�$���. T��BUBJX��C���d�7��m�-���RU�mW��|@�3J��$�C��w�C��������ZI������E�gfw�D�rS�|�C>T���L����F�2�K�{�{�M��`��]�'���/������|�ݷ@x�35SƘN�J٦đq��>8_��2���T�`��!�XBP�)T� e�������XD�!+?R֏��z��� �H*{�o����?TT[H2??����E�ѠI ���1�Y=�k��K2��@�2���hOU},X�`�A9��UE��T�zY��Z�
��t���K��L�ʴ�^'���-����`���� 1v7�ñ	K��������~�y�._~�O7/ \��T�+��]|^`�E��@wh=�x-�=Ⱥ��Mӫ"�wDdAH���q��ac; ��5�V�ۍ�^/P��ؤḣ�����H����TH��K>%��뜋/t%j¥��EA�T"��s��,g�K�i�価֝����Z��l84Ƹz��7� ��:/��gE"�����ټr�n ���@��BDd�d�ο�W�2�>~�+��+��)��1�)[�6I�Ce�!����ŖQ!pU��#t�P�[�R��E�Q"&U�D�aƦ�;AF�!�D���~��o_�^�x�t��[�7����}��H�K����4��I ���ю��g�Ǧw�eّ8�W�'"*t t�}��P+ß�W�gt��ʂPe/~LE��(�tx����{�������
B�[�����}��J���t��Mn�Z�a��?��������i�$?n�qe�M��q�+`] �c��4@��:"�^<��r4I&,��|4"���H�U�}���o|�"!���DN�r>#��\H�r�A���?��"~�����}����d?���M{zz@D�א����������	�!��P��¢,�Ǐ�n߹��Z��/��O��Of����u��� �A��֤&	�2[�A`(����Paq�bۯ􉉀�/��9s
-�:W���TT�k�"'�"����.Y���޼ys����`qq������+�f��k���9a>���q���#�Ó��>'fx�b���Kk��g�35��r��>v$��1���eN��̹��v�&�K~2��ۗ&��ѩ�SU=a���3���?h����?���n�����#-ؑ��t���L[vL�J:�s'�3��^M]�/vF���� Mc�/J� �^�f;� �P��s_-�"�ǆ��2=d�+>#W#���dHT%|�J�\���@t����[�~�m��u��Q����}���u�/_Z�Ņ�����Jsw|s
��E.~�.���_��&����)���My��r��DDo�5/A1��Ij�i�����Q(�x�1�����u�)�{#6
�� ��E5T�e��`@��5�Ч��Ԛ;#�>�fv�� �����͛�u�VsU4	�צ��kKK���7n�;���?:�]s���q��ÑS"X6��� O��?���*��Q�CYC䫴����EF:��e�����8��ryD���+o=No���ٛ�y���}k��&]�S{A5�p�ܤ���^ڟj��	����m���`y"A:��\T�N�i�&��*F�{�EUT4�%���!f"���P�C�D���X�a'�!@Z;�K�e5�JĢ*�l,�y�~�(��1�;���4m�1�'#i����ԓK�������O�^��}GUWܼy�˩|T?{��2�l�����+����5����wo��}������؀/
��d��l-.rbg<�%0�h��"CGl+�16l��*��P��P���~jvօ������O��?(\��J��3�0^t�	8f2�-�G�V���N��6����{�:�t{{��0���s ��k/So�><����
8�f�P$ޔU>='	P5�)F|�������p�)��+��*��;L)�a�xrJ��??�Z��]V�]"ʟ�Ę^��/���������L�H��_P�λI�i<a��.l�e��m%m��D�	|b����	��*!
�}9����T��ɰ�_K��]��`p�$��^������B���'��6In����Յ���s'erWf��ۗ��;g��X�|Y�O���Sӂ�Riaa�:�U��M���ޠ�~��g�3�G��ӿ��ˀ��F��@^�ˆ1�dx�2�i��.ãR��}��Cjagv�(V�k�q1Tx5�����6�<rYR�m��A�ݺ;ٝ�{�����������3����EY^^���5�����%�b���ġ���E�H \��{��ƣ��>=��w{��o8�_iuZ$�^�S&�Q+�)Gm�L����z�*"��P��(�@	�����$�F;M�'6yhM��3=�~�s�?:�I�R�y�S✒a1Ħ;�i�&����Q�.e�������A/�("Tu��'I:bSӶ&�Xc��Z[�?
T)�@���4��$av)�Qk����/!���C�V�!���:��/Pi$Tr�?È�~"�!^�{�����O���i+�9>9񯯾p��^��'k|~�	3�?ZZZ�³�����͝Ҡv6��_��O�>}�6W�y���g�@�w�y!��e��9��12�"���Z�.�ָ�����0�	 U����8W��?�Qq	��L	I��o2ѝv���n������K�����i�=/��Ұ�o�p�t���7�Y���f�f��';�2U�^�i�Q;��ϩϨ�Z��9_!�Q�\��G�2��w.Q/-'�%Y�v�u�ͦ��L�m/����2��]�)r��SUV"1�,O�1chR�.8�/(h����dƠ4j��XkZ��4I�I��J$��a��{���2d�j����(ELT�^�3i��+�{�j/������+���1�
R���9�r�^��e�����cf��1����{k|�I��f�p�d=��iaa!�||��^��`ey�R@z~a�\��癲|���UΑ��L�V�� �:k�:�2=6h�L<�Ѝ{�)�c�<1_��˰4ɉMLbJ> ,�j��ײCn}�E�]t���/��{��7�¨��	"A�s�	th���&� M�������^_�M���{��u��|9i�����5�/2ۡ��D�n����ֵ�\_������>>=��ܹo�Ԍ�a8���}��c�6����$ uB�:�Z�އ�@0�Jl�ĭ���+�s8�r�@8"�f:f�%��{'ީ�}�03Y�bPG�;�:EG�#L�b6�����k-ؘ��_�/B%"����.�-Ci��Lb���;����1fc��y}�pW,^>�,�0.��͏@J�l��(��z5y��Y�^N ��,5��
�MS�>61z��o�ڣ��8f"��\��U�`y�2��/,�V�d�[XW��󫊕ڨ7�<`k~���|�.�/��ma{XӢ�&X^^J
����9�T��),z��C ����PX]+�Y�Ml�����̇ݻ����J/�.����_1Ƽl��K;���4I���D�"�0Ű+��E�$�	�v�����~��l��j؄�q�.ύ��8�l�CU��Z{'����N���n�����oo�{;L5�K���/..6�?M��j�x�y�λ�7�IҤ�(�U=S;P��9��U�����f6�ɰ�aS����;�FDGXI,���.#��@��!U����DQC<�����k�K6�TBC��@`#�q.>/�<��3�@�( ��K�~(tMT�/��vK���65�ߧ%_ 옅�y�y�|~/ۤ���|�=2r���X�~2>1�y��G�Q�FB���e�:GK���/�`y��b\]��2@W�Wi	K�� n}v�_$ ���J��"�ҳIR� ���Ϊb��JӋA�*@��������]�տC�PN�81/�%6<M������~����W�D�R�Zd��.΄"8S��3�E�����J�c ;���s��m�ONL޹2w���~� nHK��kKk�Dx�&���[�y��,sy߹����33��o?_����aE��_�5��tm�8H��RQ	Jy*�tk`S�4Ma���_��D@E\�ڬ��%&;Z�[��~%�Rx��04�M!��;�" ��e��&�A`'�OSX$��F@<߼�P
���Gk_��9䃁����G�<00%�ޙkߝ�0���������a�-��ċ�봸����=^܆/3Xj�*/��L<V�+��ϑ�Ԇ�F ~ٓ��f��}�y���߇����TTxmm-�'���ֈ����_�^�01�#ɌW���y̯�ľ�9f3a�m�$�ԓ�ʐؓ�Fq
�C��>|���ERW,�Cã�RJ�)�I=1�ZC�Dt���i�۷۝��/^���?x��-�%���"���N�s�$ �0�Jh�׏RUM�D�<Ͻ���S���>wǢ�D�����a�TzpԘ�T����j�$�Eͺ�����C[����(>S��!$ ��n�}l��q�u�lb���Ǯ5!U��j�=��lA����D�U�\4*������쟂�y��rʁh-����dY�l,d�"��;d�����G��~+M>lq��x�svjl�^z�ݗ�{4�*�����J�\��|L?��Y0��"��y~�hq}��̯͇w� ��8n-a�0NX[[��u�q���XIe����eX_]��Z��e 7�VNxJs��Z�|�f���A�`���g���Lop8�i͘$�U�9Q�Dl���L�6I���~���>�pi����ߋ"�S�=VH\����ញ�W�8"��Q�O����Բ}�Y�����~�ݾ;=5��~����?�ĮR�&�Z���a	,AWV����,���މd����W9`Cc"��%5d+-�к���ED���NN� z����,̴<H���6����B_�+%u���٧��.����+�yEJa
�V8_4���(1�a$���$&�{�<�c����̰����`�2�"(��\�K��F�DL�٨e�e(�;������Bu�Zs������������3�W�/q�d�����Y]YYQ��..�Kr���
�l�˓�$i
33�Q \���\���������Ho�ڢ�����ۤ�+Wpyc�p��\Q��
0;;�[�naaak�kZ�zPx&L���V�����5n�ʕ+ �6����+W�2�������Ħ�O|�i�`�e������v/:���їr�/� s9��M�I6v�0&`x��aklR��jH\�E8lň���ʿ�(6a�J��x�����0��J<d
_q�xM$w������A�����}�36r{td���K3� �W^W������Y� 4	�7� ̇@D�&�϶��ĝ�y~���!:Q�.��nvM���Tƿu� ��3ICi�	Dábߠ�VU���.*�����>�������g��ã���߂��=��A޻��X9�B۾�D�J��
 ���Ai0�g�X:����z�z|x�ι�P�g����n���7>��~�1���vi�T�MD�%�n����� H���qgg���v2#m�b��&0�k[����?;��Vjj�?77��6� &yN���*��n�9;Z���������
��*��;�Ë����G����>��������U�^gk_5^_PȜ�~Ru-Q�lZLh�1̆C`.׀E˕X���v�~F>R$�E�@K�B(nH�*�HPɜS�Cc��6I>�vGo_��|�ʋW�_�}qg2��V��J4	�7oͿE��g�=pz��.?�^�hO�}R̨©(��+u��˫�L��� �ܚ�W������~��L� fe#"%R*e-+j�� �"*�`���;TPe�6�Z)��mKĶJ�^DN@�¤ZQ�*��4���XRڞd��;�l� rYn�H�ޟ��c9"�����D�����'���o=N��8wC�m�=�����L���?��ͧ���?�]���S� .�fń�aK��@ LN}��;�q�9�[�I�s���l�ŗ�ru1�+X���֊J��&���Lȝ�x�U�?��O̿�辽�������?�;:�v��"�j��U@�ل���� ���KD-��5[}D/UE��p��җ��W1Ρ����H=(�y-V_�P^�Ö���D��=�?�;����ξ���ٸ�y	��Q ���9	(n���7�T�)D�r%;������a�Ų��r�@�Q�N)��!� E��;���B���>�q�����q��.xwJ�G@U]����-�pT����2&I�R�+e>�u<&��J�\D��<��@�UK������ʉ���@�*��$�M`9��:�"wY ��U��GL��J[wA�aw���̥��i��� �q5kkk_䬓�\_�+���ޏ-^�H��O�e�_�2�J�+*2�����eN =eJ�쥭���#;cVw��Ovp���G�Z����8�2 �5V�����ki�>�^\__���)���}������R6Ƚcq�@�h���$9>�C�!����`�o�LϾd-_#c/[k�-%�`��"~�cA��B����(�u��o���r�b�R��pLzQ�IйTe�VUe����s�� �Ul)�'��������� �����dj�&�:�w~W����~����Rj�I�T�	@3�AuB�1q?��	@� _o�ř~-Fh���J5/���*�őR���@Z,�6�T�j�P�9C�#�b~f�Q�+�p�?/N
� bb�Ad�5�����":R,��\e��1	B?`s Q�w�^O�,?��|K��v�Ӻ�J�uFF�^���?���s�����Ś�/��SQ�/����>���^�_����F��@�(��O^Ds��)30�)�<�����G��;d�PXO��gH)��|��9IOGۣ�.��]��Z�ї�5𯯯��%��&�X'�����%ZYP�??u"�Ra}@kww������vv�wF�ZG�Gu~���z1w�%����/Z�iJl��M-�B�`��,Eʢ^C�/pfPei�\���L �N�B+b, Q��?���F^�Pa�Q/�r'�}_��1���<���n82���$�/A�A� |eAD������Q�������'�VՋ*���k�	+�T+��+~���d��]߉Gܿ7~т/*� ��3�Kh��
�Ϥ�O�b��	D'�(�#�a,��$�*��Vf�1��P�jXs�0� Tċx�\���"n�9��w���~�ҋ�z����mTҾ���D������H?�"���j�ì�KyJryA�^�;l�:)�)0�JS"�@�bB�� ũ2=U`ƋL{��Y��''��	�(k��ȉW�z��TzN}��c�������=���I�ˮ'3#��2>9�S3}����9���Y[^�����UU��oH�~�7"�������������x�)m���n�$ƶ�������]:�N���TF:�V[��Ko��;���A�y?�i2m�/*�5&�F�E����D�BN�]U�}�ٴ��U���0Ak���������p�@Ez��T����{��TE��E�`����{����#�ȯ��X]]�_�����o!6�2*2U�2��B����	++��	F1�ܞ�Wzy�W�\�'�2|Ŷ�%���\�`_�{�P5l֪"���@<�
��=~���qG�X�# �� ��KPT�1��V����֭�b�V��5$��	@���&�QD�ӓh�#Z��"+̅"���Dp,+�H�#�S/8R/{yl�(������ܽ��K�,���p��j��Y^��o����M`n�wu��⚮З� ą�# ���;�Iz8���s�d��8�U~���k_�b��!��ǫ�G�� *�&�~j��4Mwk����Qɼ���?�ޝd����\��]��,�{>ϑIF-��v�w�7>:���#Y��폴�^�\o��fgg�_��_͊��%g�E�>��G���wp��Ji??i���� o9���Ib��J@���V�N[�V��I����6��%�d��d�`4��Y�O��s�v��j�a����� ���A��+����V�����WԶp�\�!���ZO/�Z��S� D�]�m#G$�E�G�����X}����<��v�����?ۯz^ZZB�uѨ�5��-|f-��̍����/_�|Q����x�n��$�R�.�b2q���5��#p}.�I\&Zx݋�{	DD���00�,�X5��_��!�P�t;��Vp��Ń�-I�	$T�#���F��*���bh��W&=lj��������Ѡf���CE{D��d7Axd�y`L�~���4����Hws���; N�<b\ܼySV�]���ͼ�|�mz��KKK|2{�$���d��/r���a�EN�T�&d�.z��0�ZX"�T�BiB	��~T =�\L��fN|.^ι�xw���Dt�d⽃z+�rR�I%����$?A�;H�D�������ӓ��oO�������b����y�d���s�V��L�s�B���r�N�%�R�d���m?�G�RWt0꼎2'�Jn0]��5�		�؁ˍ i&��J�V�e-���Z���J��鴘��e�V�&Q��N���"!)�Fs�r��i�{/����NT�+o�����z�T�D$�~���+�,���>D�2�k�mc��'��C�t�g�{����g^v]YY)Y���_�hp�����ﮬ��� ~�������F�?�[���R�7��*3Cm6��0�y	�<�g����U��a��y����`cв	�Ė���>��J�?/& uQ���ի+��LBE�Ube���|XT�%�_u�@/�8�`���P#�)�-���pY���� �Z�|���v�|�y09{���/=}s��C ��*U�_@�F��Xyv��^���c���KN�k*���7�&�_n�[i�X
�q�L��rx���L���<�zR�* ��y��g��܋��ܫd�Չh�""*^I36�'i����~��9i��CcxD;�n[��sG�9�-;I9�n���8<'���N��t�@����Չ���o��x�����x�Ġ��٠��������O`��XM��m�F<i׉��|�y7�;7��|"˳I�ܸw���D�lhH��X6��XN�9ec"j�(�� 0L0 6L?8�i��JT֬���mo��8��vOI��Փ��QX��GL �����W�VQ
��}�";P�����4��v��d�{�������~�����u��-�T�M��O�! �U���G�O$��p"#�:"^F1�R��%*JD*�ϔ@T����t��ă(�J)� �ՙ�T�ZE�C���8x>�i�C����p��p��/lM���p��r)?��Z���8Q�]�TU?"���擑�ȃ����_�ן�%I�"�o�)�Q���o����uae�5�,�]�E�Td��ZČP_�`�
��B�R,K21113���h��(�95�$�	��Ր2�c&g��B8�N��!��Ȯ�~G������NpHC�+��W��QU81��$"*
8pf4qՑ6 O�E���@.U�d�@��ؒ��-��p��#̦����<t\	�`L�3����Z1��6�*�U�*`�H��l8�M�"�
TT��B卨E4-��cg�A��P9�#��S�����?�h���
ށ˽������*��>�M{g���'����׮�y�ľH0���x=�]����9͛�������3İ���/��������q�4s��ƽ�*4a5�#�wL ��Vܼ:+��@�����M�D��;�)Nqp��A���zV���
�̉����˕�L�e撵1��X[��p?+~��B��aXst�C��I���-2�����mRw���V����W~}��n��c�9q�(f�g1ev�����9��2�pE��Q�na��C���FWI)G9�JL�l\ό/�(�xרּ�">��B�^y|#��B���ܫ��\z
��#9�'P���><��ȄL�o`!��W!�r��������II��.r"��xe%%Q�*�
3!�0���1�������#P����˄�RU5J�CҰfbfcm4���"�PHXݓ�j+�q�Z��,�5�nWM�sȴ�J���O�)3H��J4��h�)� �[���y��;��z���lpj�d�O�N=�v��CzV�X6?jЌ |V��J� �m�Ư%k��l��'�/m��ϟ�N�?p�{N�u�&i+)G���C;Q�{\���	��H�q3����a$ ��ᨪg��%ڎ�Y��JI���z�v$���b�rX���`e�[��ER�Ň����1��Z�$)��j�j0��Y�<�s��D|ϲ���n��ߑ��~*�u�jo��̬T�hϿ~a?�n�2�	��~8����❉Qo���B��l0��r���nL)E{���>�-<C@�RL�Ka�`���x1�d�,� ���&da���""p"�T4WH�*��� �+H����%(�����A�p�v�YqИ��9��*+�`Q2��Q}�hq0f6l��`A����hH�S�_%Q�[a�"�r��.�;���J\����TZ��m�%�
��5���ÿ�*k_c fxU8��`��ðla����#uj���@\�z*�Ŧ}��;��������{��������]P�
�ߦ���b�Yc���y���?�|t೙��,	�\���1�3,u�5 �V���,0����0���] ����y���!z��ex3�
�CΆC��Z2R�������W%�+��U�� ��νwr�^�A�����M�iz�5��5��=�GO������s�o��w ������m�B�۷oƞ�<{���DgAt��FH��� 5�IBI�Pe,�ડ�C��T�`�' 4�����C�*n^��uQx�IH��`��Z���E�<Lr�H��4j�J���^:Ddm��ȇcUbAx*�T5�m�.y!�@ٽ
]��8Wl���bw��{������X����s��e?�R&;��.�����1�S�J�r�r�*{}�����w9I>J`��<���������;�y��^��ؠI <sX3�w����/���۫"�-�?�ʯ�?���8�N�Nǀ�:�^�\v��mj,��^�@&�bv_�`�U-\����u�_x������Q��葜\� ���)Q���Z��a�b88=D*�qUy�uE���&&.�J� �A�}cp�D=h�H�5Ș>H��H{����ħ/~�{�B��[���|��eZ�"����]����Ȍt����N�踪v��I��\���4Z�SYه(G1
����UI̤b9�N�г��ڼ�0������W択ƨ�>�\|�Q�h��J�
Y�QB �N�p_A~H.��5c�pcԖS�Jq\�����nYE݂!�s)o�����4t��R�Z���j^5#��� ��@�Ωah��qQ�w�\���O��-�#2���k���n}���FO������Z\\d,{{{��A���$ ~���gQ�aV/rz�[�G��2?�~/��z�s.{I�LR���U�B@�I��b_�D��Rt?c"��E�!��(qI�+���@<�P��gY�3��b-3�b\Gl�4�j%w*wUUfVbVRP�4eb&cLQ˅�'qL�e���v��e��1���q~K�[�m=�vƞt��݉驽�m����V���ч�/�͵2��R_W�I��܊����h
K �1� �a�=�2�S�HB
�BR �D���Q��D���҇>+P�q_��:j��ǖw�~EH� -��p�P�8�L ����*�j�W����R%vԫ�z�[�B@����jV�$��R���P�({��J`()��\��SP�k�^�-�����������6hI�U*�~��Y	�Аҩ(<>w�z}��!�0��n�ɝ�����$��Ǟ�d�wo���k���UY�_���)Y�Z�����=�r�����o�]9�5<���nk�q�o�c�w���|�4��1�XȐ�t�BU[����V� � �r$ ��p��8p�k�He�2��)�����Uϴ{+Y⢕\��D����E)�W��հ	-T	�F>w��\����)�D�[I�i��<P�[֘�I.�^=���`�Յ�Y	���� �`ee���K}�y.��>,��s'�oa�����!^��`Hˌ��A��E)ՠ�}��w���2 A�a�8'��R$������S��2l_g���j��^�3���� �-�b��>�*k����{��%_v�6������Qˢ�i)�H���(���UT�0s��˱�R�((�����Q%�+���EH�G�����m�|�i�������'g�]��ꝤG���_d}�6���a��נ���M�k ���UZ\\̯�]ٿ2%�ם\vzj����@1&�4�.2Qb�5d4��kA�h�R�W���%hhM�X����ړ�H{u]���;,�S�g���R���)x�����:�C�e���ϝfY�y�;=!�>��0��a�Q�պ?:9�`b��yu�������з�:�-//�ҏ~�g��z��+s�q�ʀ���T��U�T�cLd���d8}��8p�H*�tP�φ����O��Ք��Bx�0ĊZ˻`jP�*
r:/���=� �Yw-I� 4<�"�t)ʤ����-����Q{�E���	��߈c�!�����آ~�O���C�{gH��j����Dd�� �.w�\�ˏUtKbLr���𵗮���7~��k��m��+�CR��I ��cii�V��iuu������������a��OZ�G��ܵAރ�J�*:h�-�.n��zċb@(w�i�2Q���V�8~�@4�����G�#UbQ��*�'B*T���IBP5�~��K ��幊J�;�W���>���D�Qb���&��&�xᅹ�\��.�#�FD�>�ѥ�%^XX���5Z]]յ�5�eg5�~��3�͉x���=U݅b�1��2����bw<�õr����e�(��R�Z.��-
+�T�zt�jV¨)\)��SE}G�,�M>h��H��?k�R7L�:F-�a��y���U+�*�-}�5T�$NJd��}�@��#D{�blU(����e2Q.�P����,��w���`bB��"Ƚ�g�x�N��#=���;-�~0>9��o��� �Zc�?k�C��m�����t�6Ь�X��� _�pis�`�e 8�I&���_V�����Ns�sX��k`#t'2֨1�<MD�{���Z���	~1`T
�E%T��A�P˄!�o�I��}AѰ8��p�(T�J�`T�s�s�ş8�Ѩ�i��[�imk�~�v�8�dofd��)��Է��"�Jkkk�����������@��������B���B�'�揜���˸�vᩍ���P	��J�VD���Ca	hCM�.�._�p}�{�oI�U��H|��>X)H�3-�ϐ\��	ސ+*ե�(-�E=׈�yE��Y�p�(�ZQ�]�K�u ��_�%�Xv���r=3�U���*��].Qɋ����)X�r���؍q�!���e��x������4i}��t?���~ty����`���f���J|�4@� 4��Z��X^�Z��f���/�7�i����r�2�8����\�$�P4�C���"˰d�J$Ѱ�T�+E�2s�Qp���(�FUBv���'�E���j��`F_,P��B�2�(��$RE�B�Ĺ�P��U�-c�I���������3�c��V;�ޞ�:>��?�oߞYt���3I�~<˷���}"�����?���cx3%�?A�:��얃r��o�R�� �h������D1ՖJ��X&��nu jz*��5(}nI��a��6�����$�|>C�A�%<�����y�zǫ�_@5>��V��a|^��L�d���I�;R3�8˾	��ؐ/>Ypc�C>ȝ�ݡ����>2�~�nw>���腙+.�8��W_�g�L����U*c����U���eZYY���y����Ǐ��G�{۟z���W�z����L�܍�H
�)I@`�jIQ��Yc�X6���îp�+�3UQM@K~_ŏ*�7��E�� 0�\�$X� ��`R&��NrU��#�V��cR=P�@�-���tF�8wi�;o���9�)�C����꼴�ĸ	�o���0��+3�\\\����gN䱱1����Q����i��y>!�����[�)*�*A��E��qRF��<��0��Xt:����s�����y�<�-���?kꓟ7�s�3C��g���؟d�V(	�����P��ڽ)�	FZ @�W@sq҇�!�>�ʧ�o,4�n߽z�ڃ����o8Џ���v�ammM,�4	�7�P�1+��/*�������7���I��;"=�=m����~VT�����.�b
���p��Xk`�-hסR�9��Re;���?�� H�!�����6OFX����`C*�ÉW�4`6ǆh���2���>��At ��)�B³߲�7��n_�r}w8 pb؊<[���º�ߚ',|�sõ���У���ｷ�k����Gh�����~ک����eʓ�5���ػfoAʞ�0�E��!
KR�lWH���尸S%�C5[�ϊ��1��		��B-��N=9(�*������C�����I�Ti�S��Z%oM�̴D�GVm�Ht�-u3I�b�P�hA&�2�q�CD&: �]c�&�����s�=H�S�������i:��R�GWZ<s�4����~�/����� �>\{ؽ�����`p��O/d~0�e٥Aֿ�ϳ��]s޿����v��$Ma��1�nvܡ�y�-�Z��&��Q����m/AB���D`C��g��ʑ@y�s�B-M����;�� Z�;6I6ۭt��jmu��-c�ݔ�A.��`���<;�N�#m�{����7o�<E`�K����k;\��W����,��f9H?H����Gw�^z��k����<Ͼ��^���E��� PFI��)�rlpX�}����A�����P!s�U+�.t�5;Z��B��>��4��W�m�5�28��^F��+��FÏ���RO�+cз`�r9koLʁT�񬂿j����
e�A�8z5�
C`T�\p���1{֚MC�!B���<�D�m�tt���������p�FU���fa�0��@�/����3oyy�����W�.\��}��`�����[[��e[���y?˜�B �B��I���x0��#�G��v������0�0y��(��z����H�\U"�f �T��;�{�?n��!%���Ng���쓹���k3/Nu:}  �������o������=����v�W�$IzO�����í��{*c*�:���O�i�m����R�jqĵ�~���ur�����<��L�k;�4Ԋ�2�g���������?f�t>����z��8�;�J}��ƨ>h��T�8���w�P�^]� y���	)�E�X�L�����n�}gl��k�{s��Iq�,--����Bn��y�m����u�G.  ���V��i`�E�r0��k<����vw�����z��k�x�$�\�$�I�t�1	1'L��0�Z-Jl�	0gf��Gmg�}�WuC-LQ����%�4��zUuDș�3ǆ�y�O�~����l�E��v��17sa���K[��o���4� ��[m��C�C���E�[�K����������*��?W�(v ���L/����{ӟ=ya�`��^���|�,�_��+��`[I�0��M��@5q<Px, �+{/��57������@��V;�fOKg�K%��y���H ��V\KԲ�C�E������@m��)t�P������ZmAh]L#.��jeڡC�T)"F�똌q��#���9$w��}O��W�wI��0j�ֽn�}ojl��/>���<!�������[�t����Ч� 4�e<闗uyy��:� ��H�1'�s�y�nvr���=�������E"̪��\�E��:D�b���)3��H�`������׺s_MF�X��PQ�^s�8��L<2@���S2<`C�e�cC's�T�]��>my��sd�������iL�[�^�吟 �ЛKе�E����n���.�2��:�*���{����DV3�V��^N=�������i�N�R'����f�FI="�8�	�z�"�*�����J9Cb����j&��3ӡ���a݇?�����B��LVE���>�Z��!�c-�xT���z�uo-�kes5��x,�T��rݲ��P��V��s�#@����Z�����&�7[ft�7~�k�ι�ﾋ�[�6]������-�����d������T�^��s��t����b�e3���e�،cF�Mڶe:ll�X��R$-UM0T�8��tbȃ��h���U��2�������N{
=����KҤo[�^��#��s>{2�e�������qo�"�r�J�ۯ��[XX���m��t�EW\ �ܼ3�����lm|�������sם����"1.�i����NJ�M ����y��F�����PED��~���]��N������O�L�g,+�=�\W��صꊠ[�A������u�,:��К7@A��G�d0ԳT�)����B��8X_�	U���,s�u� z�ݵ��	�O�vk|,=�ҽһy�fF�X�7h: � VWWy���ۊ-���: } 'kw��}��������Ao&˲)8�4l'���1�CjFS�A-bn��-�TD-D����1)+��
��"
+{^�ϊL }��)D�8 �=�J�Ě~�m�;ft�51��;/��5?;wtNE�KKK���,-a�^�V�}q(��F�1�}�}���<���|?�����IF����XG��d2���mbؠ&L��3SV�\���*�"�J� �A[��J��J�J�3�V�T�?���7P�3	M�_�z(�]P��/�C���쇇x�*r�D5����S"<f�=�ɝ�V��}ty|��ͱ��=�[���;�<�6OX^�e�i�7	@��j�_^^���u�_��y X_�Z'��4i��~��o�Z#t�����������~���TmDmC�1d[������T%���XLQ�#]��R�#��
B�=�҇����%|���;����Q_�$iZ�Vobt��w~�7����9�HYYYa,�޺u�nݬ�����
,��E]�r]�N�����6a5\^L�E��;�^ӽ�O4�s���'ځ⑀�A<I�	��bTEƼs『�N����PͿ����P��_��*{5�U/�Z�+�竿ӹq����B9���!U�U�t ��?�9�g�rj3~f�Z���k,�h�@��"[�8V!�H�(rf:&6�̴c��	8&�#��c�=j%��nk�Ӆ��m�����\���N��en���[��H�,�I |�PȀ�Kk˴Z�x��.C��Y�e��^�����S��><:P�6-�i�S�j'�v;5�I�X&k�$����cD�@ ��3�xҫZ���)^�Ynr�>��\8$�)�'�O��)��uu##c����o����P�	VA��]�]P�X��k�߼�OC����(�5s����d����O��#(M��	c��NѴ�2�^ty���̩�����B�$���"�Q�FW&%R�
<����@Еc%+����W�v?�R���d�k�p�~)�u��Z�<\�=�:�qѐ�զa�2�'�ʬQ:AI�x
�	<I*��kP��r8�^��0k'	>1&���dC�����<w=w�������{��7O�s��{�/�Յu��	]�����1�y	�1�B��Ehuu�777m���1[�\�t�2�5�n�Lb[�s�No���,����?��ɨЇ�z�+]g�sN�q[�}�f`��`G�|���!z�i��n�믿���ۺ��(́�E�@zK�-ܲ�̌��&=�i�c�\&�y�b�߿|z�{)�z��.IE/��ll7m��Ɩ��X�����U�{뾐��m�	��`�J=��]�Zq�C��5��5V�����vo� D�@9�8�ȰY�y�G��D��*��K�9QPi�3quo"�sd�L�,ϼx�^���1�d�A'�wGG�&�����\ܝ�O���}O{{��N]������B_���l�����\���.aG��*P��^���&To���Uh�6�3_A��b�9lA��|eqq����	  ��t͜�g�&��Ѩ(I?$��c ������؟��{O���1�>ׁ*z*8&�M�׎�$Bj�5#�!LiD�` ,�����DWK �6��@kd�r�(k���/Ev�*���6Mm[�|q(�S�G���(��9���i����v�x����e�|O����}��)aϫ<1����������>�q��^j_�5Q������/,�"���E].�$�=ӠI ��XXX������(+�_���Mn kkXXXТ�����
���7�w �����������~�N{۳{l�I��K&�3Ƙ	uU���wT���[j{�3�0�-���RG�{�[5\��W��A��p����Z�+�%� 庖�9}Oz�J��F�$XQ(�Pa�5,zU��(�SL
��-�������K������q̂�|��U��-�Ȁ�w�|���^�q����z�x'�������Q��7��k��~�%<���8v3�����������*���?v�?��w��1k	��N{��.*0�\6��x?��a��3�8iu�HR����$�H�x�\v *�騀_jT��Ke{�j��Ί��=yHK�^�����/�H�&2K�ţ� ǧ�Ϧ�c)3�mf����à?��}OD�U��9�"P�)����]&����0�]���X��t*��÷����9jݽ��i�$ 4�g�j����tNOOǒ���r3}�;����fONN�NNN�NNO'�Y6�U'�1Ed&��(3w�!���}Q�	�0���@9{/���L�rv��ĥ�' g���w8gݐ����`qIK�a����{�� �Mu����Aq�:q���}���"xʠ]k�v�&��ݑ��������9;vt�ƍ��I��M�|0�XV ���>W����S'��/_:�n��~3�Y���(���ѭ9��k�X��ܤ˗/ ��[x�J�V"r�|��8p�p��������d�;�����	0F�$T' d�@R�@��j��Sm�����*�*�r�" )��K����΄W�\,[�<' �$x���W����BkҽŬ5��r@��uXo���ʯ�ND2@{P��9#BF�3�86D�Np�^�ɞ��6{)�ӱ�����{����SLLbR�\���{�� �^��s�~�_\S,7���@��  �����"0�8������r����y��	]��W��<�J��H��~�����'����G����{{#ǃ��t�1J0#�rʠ�I[0ܲ�t��81O��IU���Ox�Q��i�U�E<;���l��MR$����&�[��Gk]�辧Q���3(t�K���������}I\�D�C//
Eh�@ ��0 �Sb:�LO���X��lщ�$�C�����|����ّx������������|�d���>a"9�fX\4o�o���\����?���]4h�_�{��$�^sX�_D��`�?��O��ξ}��49d����K+�X�6L�y�V��2&��\ ����_�]>�s�˧$�]%�E��W1�������e�&6�I�J�Z�﫹��7eW���A���$0 ⚤���?��"/p.�w���^����2@*�S�>D<)��2C8��&i���J6�V�I�����(��G�R�ٳ���k~�\o08�|D$O�Ľ�������8f��H�4��Ќ ����7��7���A�\��Y��+�<~</A�-��#��wo������KGGǗz��%���i/~T m���j�O��Qt��B��))Yq���ɽ�^r���pL �T(�im۠����q��Wq@�Q�@�s"⽨�!�@���@�N�݉������z��[�7�ǝV�����������Ϋ[�F/X��� (��{2��g�� ,--QYه���?�@�/8:��OwA5��������L��V+�I�9~v��΃�Oܟ��ٞ��;�>=�Md�`�Cۀ�AH=��]ƌ1#֦�v�j�4I@H��v���<�YD����DD�
�
IͲ�0�D ���E���̬Q�H� ��{�o�3"��'�x�;��������Ab�$M[Gc#��ٹ���W�m�Ư��nb����g;����0� ,C
=�fT֠� 4��2�����
�� ���L1���]�&��n�N��A���0(ZL&%�����v,�#4���Hj�N�$mJM�*v�I<9#��@�I��P�F�U2aO���e�������y+#�	�e�E�3��6ɘ��0�@t���8dGY?��y_���36�<Nǯ\~������k��*�.-�	@ �6]�M�A�_�í[�L��3��Ǽ��e�����e�Aڞiu2��v�#mQ2B�i3QK��׷�����49<�3�^F��p^IE����K��z�m	����ޫb�V+�N�-�vK,����P���w�i�N;�&=k�SUr|�N|���������S�8��9����o���7��7�"��A�hР�W�X(�h��˴�����ա��VZ�8�����o/���ok���!.ċAp�h� h��Yz�;{��k��<�>���3Y/��{d��131��1�̤�1Y�7�ʬ"���� Ĭ���v�%m� M;��j)��~r�뺭�|znf0��!�l� ��X�r^�����%^\_���yڼr���.����~l��
`~mM��\����K�M�A�?s�~^�6���ml��B����p���﮼�?O 3���9H㇍���~j>��?��)?��G'ǎN�	�[m$�;b�CH�,� ��h�) �y��{uި�V��V/]�$��c�n�њ��T[:�N��Ԕ�4;[xh���i��<w?�i-.���w����eB|]��]���.okf,,,�Zm�?&MРI 4h��΍Du��r���g�X�˲����+@�m�G���uz��	�1|�# ���v�;2B 0����^�s����;m}� ��䴭 p������z������1��ի%R H��^D�|�������Ngu��ʿA� 4h��|@�3�T�jX� ~F���ϳrt�	��q��!��h�A� 4hР��l���������۷�L<��oݺ�w��U���^;���OZ\\���M��a�������X>������ܼ4��#eQ�/oz X���������7.��º޼yS�����o+ ]�_���u��q9>���uyy�y�4�4:w��8:�����T��h���4	@�����Y=|*��~B}�Ӝ�z�7���}�4	@�|Q��X;<���UZ����W?�,>绞��q�_=���s��o����A�~~<gݰ�|��j�3hC�kРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�4hРA�|��u�_0��    IEND�B`�
```


## public\favicon.svg

```svg
<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="40" r="38" fill="url(#paint0_linear)"></circle>
  <text x="17" y="55" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="bold" fill="#f8fafc">
    D
  </text>
  <text x="40" y="55" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="bold" fill="#f8fafc">
    y
  </text>
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0ea5e9"></stop>
      <stop offset="1" stop-color="#0284c7"></stop>
    </linearGradient>
  </defs>
</svg>
```


## public\Logo_long.png

```png
�PNG

   IHDR  �   �   �I�   sRGB ���   gAMA  ���a   	pHYs  �  ��o�d  ��IDATx^�w�\U���Uv�vzz!��U�A��"X��^_�/6,(��" RB-BIB!��)����眓!�@��]׾&e��=3{ֳ�S�hҤI�&M�4iҤI�&M�4iҤI�&M�4iҤI�&M�4iҤI�&M�4iҤI�&M� `�������Y3&I�&ʀ�n�$�" \0h�MM�i�D�Q-zEkZ�pg���]�ɓ��O=fy��1�t�4iҤI�&�
v���|�m���s��a�a���0ơa M0F�I�$��&�s�ԀR�����<o��	O��j�m�L=`�xƢ�jҤI�&M66좿]�U-��!%4' 0F�}�00 �e'��  �#MS���3����}xXW��;�4��)#&,<�I�&M�4�8�����7C�P�7  N�X5Xu#�&�`�Ak�Z��Z���!�;74�=������s��
q � Ɔ~M�4i�d(�wW������37l��چ�8�����@dOv )��}ao�|���#�{�Ó'L��n����?���-���O~��[V+�[����r�I�tj�|��d b�F\i����R?WfqO�ʥJ�EQ��������?w�ᓟa��/�I�&M�%�/�ݧɥ�y`wb`��ވ�̀!3^Ƙ�U�� Cp�RFi���7wL׈������������:�� "9s�L�|eё/�{�$J�-��&�D�'�y4��拈�H��f �`�!�}���P��!�@�l7�q�⾾�#ۇ������?�y�xM�4i��
���.<�/�m�#"0f��8�;2�$T��q�1 J�hq_w�_v��۵'p���1ߩL[4����<V0�;$�O��V)�N� �I�
�� �CH�2�U7^� �"��fqCJ	.R� �@\���������o��n��6i������~s`-N�
Z�Ls��1 ȼ��e���YݵXG)��u]�a�� �Z�|���ć����ԝ�|"��G�ϯxy�)}ݽ�K;s�<)%�á�w$�1�V����H�Ȍ�@�L�@�g���]\0�9!�R�����o�~��[w�M�4i��z�mz�T��;&"3���Bk�ǁ���}��1c���C��M�s��-FO��l鬟^����z��q�co����k�ۥ��d�_J���Ѻ'qx~��j�*$a'�y>\!!� m�;.$1Hb�p�Ԁ$�uA���쟵I(�B�R�X̒B�4i��]�j�{��/�,u����X!�i�"�"�q�cB��a�s J#(2��9D*E�R�[}�ɓ�g����o��h|��	"�����������w�S�b����R��y�� �.�w=HHp0���qHH�$� N 7�` 	A�RJ�$EX��1)���?W*�`�$�4i��� ��:ni��O�� ��8�5:�d�ƶ�t�c`�sH)!�؅�wr�q�6`� C�� i�!��y밶�V�����K�8c��\���.9���;f�']#F�sSFÀ � 8���1��@@ ��.�a�L�4�3�88q0ì1#� ��hp2�dݍJ%�U6�X�&M�Mp�Xm�;�q�T�s$Id;+��l(l�A�17d��a�2�N
#�������<��WͫdS�6�.h��O�=7L��̕
۹�/�4�I@��˾O���
�n�g�GcK��7V�X��$�5�@���었�G8s�IM�4y7��P,\���[��@�����R\u�5�p���~>�\!@5�aب�~U��]r��W��ȴ]�y;���t�u�]���|KKW-� 	.? �tb��5`������Cs{gk>�,O ��C0������J�dܖ[>5p!M�4i�.���{������!7�M��f)ݍ�[.P��P�V�>�4�+����sO��_�ݲ��'#"q����n�ҕ�i�N��9�F�|(��Z�cv!@ٮsuG�9�����I�{`�!@i���O���O4�v�&M��7�a����>όM��ǵ�h �pC f�lܺ�v+�;�4���|p�Q�� C��!/�z���������Ʊ�
���y/^WjiWl-
�
0F f�k�O�!b<s0�J�h5u�6��@��0@A�1F�*t����s^m|�&M�4�of`{����h?<σ�J)p�!���6bvB�`MԐ�_r�J���b	��A)!�08g�֖��z�]p�w�V�Ȍ1���ӓ��k���	3��]�9Z[[��߿���3`0Y\�&d��<�F��)Y��0@�`���޵Iz��ns��6iҤɻ�#���Qi��4��7t6���bpf_�n�!�۳��xO�RAK�)%jq�����~z�U���6��)���?�.s�_��bT��`�0�� �Z�����X�ƙ����mk���F֘���̰���� �@H9����nP����;�H�I�&M6�#v�����\��Z%#;I+�$����7��X�P$(�PJ�u]��{z�����F!k��1w���͘6���1���e�<.�\k{��0��@���Zk��u�a<p��Y�O�|v���;�h���GN���|��A0,a��`�"�4i��]?r�®����.�jRJ���Ԥ�ˮ[���I"xHU����̀{L��'S���hEP������pZ�D%(u��u�#�^;�'Z_wc���~�岉~���V�����r�J!q�@��� gR8��BJhc���P&�>p�\�����d�F1`�;�X���9'�}�?���M�4y72`�c4q܈��ZXq�b�jJ��݅Y��H��bK	�j�pΣ$IL__�h@�^��el\ ǁ��8�A�x��u�����?D�}����o��DH�?��:��i�z�2 �i
c� @�(��V�� t�칣V�s�)�"W Ѷ�n�X�z.��$�I�A�~f m�N�O���I�5>�I�&M��8pꁽ��i��ۇB� ���؛ϣ���עLpV���:�.��T.��
d����B�U��@�q<��������;o:��5�,��}�˖/�0�-�X�'.]h��Rr0ZC+���ѳ�Fk�������
k��ZE;��:I�c�����]� ���T*p��J�$}q�����q�&M�4y����RP�EkC�� v�����XSv^&F*ٯ����ޕݿ��+�$��D��K��n`���`0JCJ�\."�����(��:g?��o�1mڈ��{�\{�M[?���rgl.X�Y6�!�D�(�q���|^���ypؘ���Ʃ�����#���v|��ˏ""V*�l&c��ր�/Ā$I�C.���@��i��熭��i|~�&M��[x�u�y�N7t�X� T����@=�j�aCY=�>ys!�8G{{�X��#�8���l�ձ&1W�-뮙�mI�AgYw�M�;�E4�°��J?\�CKG{��k���7�1������ٲUݽ��嬈1�;�$Qp�O:����Fq�V.�������?��g��b�+/�)��}�8F��]X]�r]4�?���0M5�I-���A{��1f}�M�4i�.�uFl�=�|a̘��Q���u�u���FQ� �$	/���x�-���a�����x[{�\���$�i��f�i��@���R	�H<��K������j|������?~V�3�%w$�Ҁ!8��5r���4�=I�߷>~������"rn���/���b�(s~`S�k5�i�Q�� ��:U(��WFtu��!SY���&M�4y7�:# g����7�V#0=8	�M;����y�U�6u>�yާ�v���ϝt�e�O����bەi���phbH����`wkհ�r�ҕp��.O=����e}x��Y�Ttn���a�*q�F�p]�~Dd�{�$Eow���[o��o��k����_I��|>�0�"��3���֐Y�^jP���{���n�h �R��U�ێ?����ۤI�&�6Vk�cQ�����i��R����u��In�?cp\�˷?��? s�nΙ���_�.�+��z�9�B8p]a�qg��[2���{̴i�:_{m,]��p�=�9�+��$F��I����(�q:"�I��~��~|��<Z�@}�������"��y�'�d�JoPL ���]�,X0���u�����4iҤɻ��1 8��g��(}�Id{b��6a�kL)�Jsơ����6p�� � 3J8�*IԢS��͏�y 2a�ү���vܸ3��,�!c���x���b�i:*2������>��7��뀈ğ���E�	0�#L��`
���pcQQ��O�|�1���g�zt�!q�~?��y��p��c��j܉�1��gGd�Z?�TW&m9���|�c��I�&Mޭ�ш������?��joyI[������f��.�B[��#�`Vu=�
�A��D�Q��{�K�z/�yx�ް�V�Ϭ��?kRG��ױII���}��\J��|Œ_wM�^��6�Im�h��q+�5�GJ����Jo����_���W�?>��_�9��G�y.��_�����$ɀUI
 p�c[�(���J_���}�c���&M�4��ш�v��/�ȷ^гlE(�#$$�\�(�Z��$I����9�;d/R�UaےDi��HS������v�m�5"���O��N;M=����4��V��|>��bd��V�_�۳V}��sۭ׿�)�	��q���6�̠  �j���xԩG~�~�3r����mm�;��D�VU|Z���u}�@��ET���oHk��D�A������	��}��6iҤɻ��ή�1��Q'\�Vj��k��Z##�ҩg��:��q]ZkDQ�uQjk�#ǌ>��ǟ�Ԑ���<������Ƴr��*D�:I!��`��]YL:|�y�������{ok�\�I!|�1�q�g�Dp�����,����{a�� 0�H�<�o	G�/�j��Wo�ח8����PI
�Q-$�͓�m��~`��&M�4y7�V# �Riŧ?��o�*���}}�nV���w=!`�y]}��� ��m��m"�8�@\-Jb0��=?w�7.�������G��Ķ'�ҷ��'�9.���p]i�p�8C-�mu����z~#D�̙���ӂo�aw?i��@f����^�2n/�����m���?��?�@_Η���J��8�P�����(k�I8B�w=T����ӻw?����~��iҤI�w;�4b�q���v�)�`F�J)DQd�֡�AY3G�8V6J0C�@k~!�>��/��WOz�1���٭�nyZE8�\.�$�P��� ��_ٽ��sy��'Ȝ?Ez.��.<σ#$̐�b�$�J߸��S�Q�A]qǵ[�W�Ӌ-%��)�\  Q��z#�k(�B�r�sH.н|������{�>p����I�&MV�ڭ�N:�'��m��k�ڃ�J��d��cHCi܉���1��G������!Jb�ZK,h-����?:c�N9��G�5���+{�(�¦�s�q�1�A.�?r蹍�<�߻����F00i�n�8e�U��mO�h�{��S&LY
 ��[��^�{K�ƻ@>���jR�$f@Y� j��v�Z��g\�Eoo��䒯~�{���/4>�I�&M�X�ۈ�IS_1ā/�HMcF%	H��(x�gH�F���p]�4M�����0"bR��^���?֨P��>�����L�R��҃����~. I�X%c��3��?P4:�w$�Y:�縶 �1��F�J��j�5�Nػ�~n���h/�'�vu0���
��p}/3�kN�c�n��S�;T���a	��=���fb�&M����Ϻk�1F�v��w���jw�;��I��^pΡT�H��|��u�ic��)�0� 3� �B��B��J}a�������5�~�ԃ��Z(~aT���kȴA�Rp���r�KD�}_s��E���#�1�|��tj�*�tj��?��P�%�z�m��-����2
\�Ɣ�sm�4�p@L@�� �a�"�0A0� $:w8 [� �I�/Z�Ԩ��֙_��a�Y�x�M�4i�dUV;ٯ����s�c�;/�D������M�0�Z# @�<����uX��g]y�f<j�\� ��|����< �����$�$� A6��;J�{���_�;�G�����{i�yP�ÑI!�A�\��(��;��Ÿ��2j���sgϙ��}�E���b�g�4L��a�p�4m�9���F�6�J����0a�Ja�������)����S=�運nҤI�&k�M�!X�1����gC��0��\&��@k�0�P(�R�=g��	��v)%��RJ��ʕ+u�gN��xf�����p�^Zs�I�~d&Iѿt��������|�⭹���>��oZZ��%G�� ��c�1i@�i���g?�ɣ��� .������?2��.�A���  $�C��Ih��u|�*�$��yp�Q�\.���u]p �J�H�i�&m���>d���mҤI�&��M���p��/}���F�N�23���"cx>�T�V����@�=��G|�`r�(��]	M)#������>��c�5��"��� � �w�6�3f�JC��}�ﰲ����]b]��/��X�NR���V讟��/߿���$���[9)��I��� Iĉ�vt=	�u�t'(9D�0�Z�a����������-���n�ܤ�[9W�v�N�^��s����������?\�������O�p����d�g�vbC��`V����넙���%����	c0m �`/2d2M��B�q�� e�}�E���S>s8cC��������~���Fl1�D�p�/�~�;gy�������9|G�:Hɀ[��BBk���^[���p�^�\?�����O�Gw}��"nD��H�� r]�P�dR�O�<�>�0� ����o^�����O��Eu��vn_�8�.�w�]wߵ{-L�ѣF.�~��z������w
DĚ�7�<.��ڣ_x�?w�N|0�ѳ����G��~��O;�C�E�͈��+V��y�?'.�^~g|{7�].�8���j'6�F�b� �^p,�@\��"�|�����1f�3�����s�����.�T �����}�.��!:����^ʓ��d�)���@�DD�9�K�}����1�����Z�w���ČH�X�K�h0&��-�tj�9 ��4���b�,k�J���7b���8�=��˶p��,���k�q��=�OC��B�К$	c��4սi�<3q��+?r豗3�Vqon<�bE�ѻ��/����d�t�y-���t���J��j��"b_��+��/4����aV�!I��S�V��l�A��yȁS�Ln�y�Q�X�i󧍘���*q���m(GUp9�poV�V���<7rl�F�p]��ju���{�|��=����.:����������NS�<b�����o~������:��"c ���J�1��޻�����=�Xa��v�w�(v��	5�8h���Yl���s	΁4��A0������[���?n�M;m;��&�=�ݴr'"��K���r-EAY�6�ZK-0��V
��r�:Ώ߳�~?�oʔ��q6�1�7~u���O��HW đ�1ʽ}���%_��g�i\`5�|�ﵙ]���ͷ�ۦ�Ԣ�Qp|D)�s9D}Ux�>�g��n���s�q ��%���>K�,������<Y�|�mIX#��9V-���/cQjPp�:�����hf̟1�ƛ���0���|�k�:��r�}]�_x��֖�s�%)��!MSp���q������<���s�б��y���Z{�O#�T	]��pQ��dBC&��W��:�?�Е.�-���x���y���͘9�
%X���̺Y9�6Щ��s�D�R�{��\q��>}�{:7�>iD���﫾�jϊ��[
Bkm�9����đ�Q�j�O>�c�7�7O���A�Μ�w�s� �u�G�Đ��$L��B`�+�9����ۄ	�i���z���1�x����?�`�r��6��܄Z�"��5	�R�)�~����������i��_���m��s|ܸq�h�4����M��¸?�G�&R�3a8L���d��{�7�d�Ն���CD����NO��m�9<ҩ�0$�ɈCd�� a�����/|������o's�������W�MUbhH����  �b�ac�8��o�&�	�����K����`� ]��x<g*�𹃾e+�y����>q��4��ؠ����s�v����^�uھ[Y�3�D	9�#p\�T������<�Z4H��2�H2(���ϼ���rK�11���۾�h� `��-I�g�m%�Ib��c�$��Sw��4`"j[�|��ĉ30�`��ɦ~�bb�}��/N�o]��?��8��ɿ�mOEj�`�V=(�.�� B�x~�̓��F{ZkIY�
���SJ�s[�Å�I)��7�8F�͓Mn�`]��������#N����pr�[�{��O�Z�� 	#�ڃ����0���pׁ�-�-��Z9~ъEc_cM$��R.���Y�i��(�1���I�ۜ��)���2\�q!�A mR�Q���\�p�9�a��Ǻ����yp\Ðo-����lW�!&$��d�r9\k�&o�&N�Lp����0nΤ�^*��cX��g�{��l�#6�]'�:�;g��[��f�c?�a���F�k���u%���k!�DQ���Q�*�8����aTeLpH)C�C2�������Om�����8c�J�Y��b�1��K����\g���?zåW�u�U�������f����ޣ�܈u(���V��o����>�Q�D�.l��T�e�y�hm�p�w]���[nĐ*�|���u��_����)L~зlE�_U,1Z3D�p��A }HE�I��Bk��slm����r���g=�$MS�{wcZ�7ϒ%K���;M�4��00��b��B���Ҟg5J%��8��8I�5g�	�[
!@����&�I�Ii�.�#�H��U�K(�+�����bĆr�����9_�����J���[M�r�ȏ�x��r�O�����nKk�̨��L��އz���9a�6w4��:/^���Dc�1`D`D���bQQ[�t}�M�<��F$��'m�9k��cȎ�NF�R���D+���_|�7�1������z�� 810b���r��l#U�q������=�qc��6# ٟ9Z�#!禹{��Y��H.�[X$�ZMŸNG�:�ut�o�M�ݻ�#�?|Kרa�ج{�����&�Di���������x~�7�?o��ٯ̛��ۤ/pe'{H�� �vbZ)�<i�w]�(A�\���_��9o�w����[��x����5��@︺{�%�8o��G?l�M6n}⁏?��K���a�c�<)c�b�B������}��k�����m߉�Ƙ�:�g�`��[um��X����0 Xڽb7ễ(���~�`�$
:U��#�n��ܬ�"�q�@��B�i
��*rc��^L]O����8�p$�8s%�-�|������o?t���b���$�g݊�q���k�Xw_�&o�=��ZH���u]P&:n�!�LDVS��;t��dsf�6b������H��`���u|�"x܁4���4b�*ꭔa+ꬔ�a�shf�J���Z�h� �S�R20���r�g����-?\j|���� �ihN0��1�� &���y�̓ �#�D��lWvhp��p�u�M6S�k�I)ܢ�,�c$I��l �3!���I90z�)��o@&����)�s�a`��TN ����($��{�/'���O�z�[��pp!�D��Un�fX���i3&��2������
�ؠ~+���RZ!p"��[o�8D�͔�Z#�8�*�Z�8��Z7�pl�� ��Di�j��b�o5J�>m0��3��`\ p#['ȹUk�g�J)°r���z�ou����c���hseذ�L0R�
~7Ǳ-t����*�Oi���_k����~K!?��}���Հ(��� ��nЂ��{m���Hܾ���#�<�q�w��m��v"r�Vɵn2��= b�����;��Ո d%���<"�a�[�����5�ܱӪ#lZ�0]7�kCe�)��+�bqྪ?rXQrf��i�H������!�l�����,_>�[������r�#N{�J��'�E��rE�`?�=�vLD�X�vq}obG#z�i��1n�����ҩ�R[�����9�������smL�Z���b���VӠ�W�+�\~�ճ�����\�N�"��'0P�g���kԠ�b���eˮz��>x��[l1иtS��^�+���翮P����.Ix�n:��O3��&�Ο���=�{Np8�0� ��%C�RHχNRH���[=�����2n��4��d��v71�9]F��aTE�vŕu�FV䬌��{"��k�QӪ:�3Ij�	�|*�� ��I����RW��BG˸���������Ũ	�[����[�*ݣ?�|4J�/[�����5W���+~����W7>t��D�������}`GUw��zf��߳s��S�; #�4����������U��Y�߈R
�m���d3�1f�ò{�120��O.Hx�'�~v�z}�M�~�뾨Y����_~𩙏��KQ�
p}g��ZCk�lWWǓ(�� H<�@��a��<��%��1R�H���S� �d��)��[�Oh�u�(xg=�����%>x�]�����[�o��M��R���a3�1���#X7O=��10���"A��s�%���iD����&�Ȭ��c������mA�꿽�B	�s@=������1M��K�|��_cĈ�_|��G���+����OA)��&ba\��3�� �!I#c`\0)��FB)$F#Jb�Z��V��9�а1C�8vL�"!��c��R!�޶������m7_��_z�����n0��m�)�X�A=��ǡ��jq���G�Z�ۜ+{�����y��(����}m8��$I��f��E����e]���lѺ�sF$��w������&�����O�3e�̧f���u]O8�c�_�6���M6�c�W*������ R��A�R ٿ��.t��V�!H� MS�Հd6�V�T]�� 8��%U+�$���l;n�OO:옹��3��:�W��i����\6���e��H����jdt���Fr�V�=ԢRJ(���Yjt��pkD}�W���˾�{��6Y�¯���Kr����s�����7~耣>0����1�{����=K�y�V��%�^��ac�G����~��I�W;Ft�����+:e�-Z[ߒx�e�1�E+_y�]w�T�|B�l˅��+DW��g|q�D�0�=?i��+��zR����n��6�צ���'?y�c�^�I�W@�T�p=� ��pQ^�];�У��n�Ĉș�={�I�_��t�Ks�v|q�6fGC�e��XB��l�|@�f�6���c>���x����]���bᰥ+��~����(Q]$��^.�O�R��.�1LH"2��z=)���k��>r��{���di���3fe����m�����y�y+z������1)�����d�$��f�R�Ka]ZA2�:U�R"M0��z�@��T+0���4�A�!����+:)%cP�A�R��;��8��(����<�t�ҧ����}湗6��w:USsѕ�m|�R7b��``;��2`i�*�s���-�¹i����P0 Π�~:Up�!!��"=�k�%9�/3�6IN�Ws����o�#"�Ϸ_��g�{��|)7���:"I�鹎1�����3A�)��Qzي��^=v���M���>�U^�m��'���++gΙ����[
!F抅b�2C���
'�Z�u]cVCr'v����2ON���ώ?∹���=�<�ɧ��{h#�4�Mm���c�8�Go�Qe��H\{��?3��Oh��l)��%Ju����ݛ�2/D�̬�Ĵ���-^�)�:a�V��t����{���'�������}_z��3��Z�Z��q�����T�4�N7��a��c����#�c�$5�B1,�UU��Wv�v�i,�p�QG��7�xG�'�?�:�ŗv�3�����1��$�!� �1�����jĬ�YZ4�JR���1�7f��1�*��>�N�>�(���8��  ��!I(ʤlL���V����)�R��/�q���o����oN݌7���̈A���l�죦,�Ɛ;j�W�Z[��~���Z[Z��dxP�[)�	<�$ۼ���eq�'�ws�8�#g�b<c]y�+�>����ҙ9�{ˍ����4���ۻ��⋆�)�R���B��H��7��<�u[�6N�M`���Z}ݽ��8�O1�-'���ޓ&-8�-���ógN�����_$)���\߃!BE�>T6��L��gE�F��C!�	�*���U����O�r�����˫.;�J��$�ǱyALX�D�m����_����#�=n�1�:ƛen�ܖf<�ϼW��� X��#�좭�XF=�$�.��H�BH8\��_F��[O�����������u7DĞ�?����}�S�>usĞŖ�ZA��(��Yc��n�8��Jc�fG�E�NSc�9>�0Bo�?~�;N�z��#&>�9�c(�v�oF�1w���}��-[vu{g�ޝ�:�ĠD�KGv3�L1����9x���4�8#��� &�W"�U�jO�RY��W^ѷD��|b��x�����te���BQ�՚��GH�B�d��b.���8*�
|�G��G��hkoo+��~r�ſ��[�m�VaHB���0��(5������=w��D��� q#���˕���eEԩV�x���_{��ۏ�z&אZ��Yl����q���3����S���I)%1��� ��Cf���C�렲l�8�`wt�r�m-G���}����z��O<x�[u����~��;��sm������֭
m%[[`8�:��b�J)��V�Se1�D+��	)(:G/pɿs�UW��?ah,feu%9�3�B�z�^C0.�5�&�"bW�~�AW\}���}�W
G[(��PF#�
�̆8�`�l�X��X{v]a�v���50Wb��-�.Y����r۵?��W?~�\�x"�\{����z�կ,{�2���3�RB
�;��ps 8 8R�m��V���X�@��$~.��hΠ�mD�+_��[����Uc:�e(o���p�k3�����Ӫa���ζ.7�R��	�$��9���R&Y�m����L�H�ql�i%`�@��i-(��_r��1�G=�V꼿����k���5�ڧ�4����ݞ�?����Ʌ���1��<�14A>�޾>8�׵q!�Y6k����֎/�z�I_�k���bb�0_��;1&�3��B���0��;���>�����_���K��:h��<����]��	�`����P-��u���6e������_��\k��ى�n����� {"����ʝ��W��(��b��I�����c���e��POLX�������v�o��+����r���ﰣ���V�/hf����'�yz�ӟ[���Y��C�HZi��$���BB�M��{�eO��c%�L��2���w���p�ů���������>� ��+.�D����$� �ƾ���F �@r}�W��������V�6^��2����{�}��a�Ϲ�|	bf ���)�FUk=�[��lM�;7ږ	��W:��������x���n�ӣ���*��س�����������������]�%��}?�|�G�$�[<γR�qE�QR����'�qVk��r�ijw�Dk1�jmƶ�w��G>|��͵r�	W�r͡s����Wv�AN� ����*�5Z�¶\���*e�]IT��D�z���x��<�l��[��{3����[�@����.]��~!79_(8a�\(�"�bn֝i}�0�4�H-�z�g}����8�;�F#f���M��u�N�
=u���{�Խ·�X�?��_׮�x~��.:��e.I!�Z�0�J[i������S6�$���\��\�[g�.������.�����	�8�Ā �g.of'.�τ�E�) ��~�!"�6�����b0�8L�0��/b�mw�≇���N:���i;�{�C��9���67�
��!Q1��y���TVc�	d��4ՈS;9"s�K�!�)��
|ǅJST��K&o;�;'�w������T,�A���.8l̐	 �ʞ1bˏ=��㦎��`�{X^�p�?�?t��Ã|>�I���m	���6�A��˼I����=�Ź5��\�Z���!�"0��;j�Q�p��-'��������<�:�͞6bڽ���޲3�{�I!�.�#�h�IÅv.�b;/g�Ƙz|ֆ�bYO�zb��`�������pMeY���ǎ>��G����L��;q���#����3^^�����;��A�K�%g$p|k��z���C�6�4vW6t����8A_w/���t�i�|���/��3�u\ϛ�⧎߻툉O渏���g}y�Z_����z��6�B���Y�I���sG2'pG=9���3�mk;��Ye�T_uJ)nb"i�jWrΫ_��9�1J�*��qFυ`�[��֝Ƥ��{�
�����u�9���_�ڮ��8�5�r^Ûv���.:!�*W���Q�p��C��I ��\x)׈(A�4�`	���h�Wy�'7�  �'��r���j�aP�ȶ��?�������+٘�ū�߼�������&=­%!�d(W�����#ĵ*`48��*�\@�	t��3B��x.|G�69��Q�����HI!�^����~��Go�����<�K1(�[�L�F���}SJ;�=��mo���pW~0(�'��:�J���0F�`d���h��<�{� i�4F�uE5x��phRp�47�+h�j祮�Q�^��ݿ���sg̝��x}o���O=��Ǯj���.��(�� }�jY�a��R� I�B�w=@�A��-_��t`��N���΁\�G��?���P��C8�Nx��e�瞟{�}3gn�x���#"~�c��rÝ7\��{�En�����0�[�  mP���R�J	�f��� e��B0C<���v�����2g�koc�{�|��:�`)]��qU�
���h�����R�V`���a]�f>~��oE�[�*3}�`�~/d���[�>d���?�^��|�	H�6�AgƄg12��T!CTjU�vv�̕g]����h���we���������	� ��4)���#Q���f��$l��G�l����`�CVÂ�XP�$v�,���� ά4�o3q��]���<gc��{l�sO>}mǰ���8�;	ɡ�F.����(�d�{T��s0&���3�vqjtj2��z&6>(%�8�t0��/�{|֬�Ri�N�6�@%6�`��9\�� ��y�j�ӦM+����?��8+(����7�ึ��u�[z¹('��ę��.`%��PijwmJ�h��Z�CG�R�"Q	��޾t���~��m�Z9�g��Qkgqo0"��;X�ۃ�R���P�V��>��;Pw*5��"���@�]��Ŭ�׆a�B� �>�9^kb)���5����Qc�o�3b+�)���?|��'���W���p(��\E*K�7 mS5�(�?V.+��`�!U18#FHT&��*�=}�o=z̋����`������ig}�#(�E�^VB����6K�!��qI a����pѵ<fSnj��������9����1c�;L�׋)�~�Ǟ��~�L�r��p�� 8�M��q��|IC:��*�m-ŲJ?��ۮݷq�7�ֆ���y`7YW�x�7"�?�����:�o���FC2ؘ_6�	!�S#r������p����A0	n8���PpB8HS�Mڮ��~?I� 8�\Dq�r����㲛�~`�5��1��_���bG�D���X�c��3aܶ�I<�!pT*50�KQ���!M4�Z�̀�v��6Y���q�8�Lp�O�L�H#	;x��  �Vp81�ȤDI�/WO�i��f���dO�K$&�ƻp�A�&��r	�0�X!��`�i��XŪ* ʤ(��b�e�D�^q�� ��%_@F� ����F�"�9�/����z�5����JD�����T�ɵ�ܤF�@p�j7�A�h���j� �4�qԢ:5�V"2���~�Ak��C�q�
�q��U
(�@8�8b�x�1W_{�����:�&���ڭ�x�EwF*�e��4�$���%	4lƟRʶ7�B8k1)2�;QjU8�`����&!L�h��GG�h����<>�#g���=8�3~[�\CX��11�hB̮ԈZ�[�r��{�~|R�X��U��3�D&)5�U�`[;��s>���=��J+c�����&30�9���P,a�҉X+���.��_o�z�?Cb�0�մ6������}�͘�_+_䕂V�:0�zl+�A%�9*�e8\ �|���� �02�/��^���E˞]�赧{��x!	�H�J�i�����m����a"���M�� H��İyK^��_����׽�\r㕟[ܻ�L�v�=tiF�J�@J#�.��H�F:Z���ӫ�-Z:/�x�s���r��K-�s
^��1M����=�l��J��b�rfwql���#_,���W��ʛ�#v��S��{rM�����3^΃2I�ω���|Q-��.E=˻{U���u����\k~������y߮�O�i���֝J^��˗�x$��^�y��$Q������p[����}+�{���h��������:�ϔ��B�Eg.�C�V�b�6&�� ��q���*N(��ݪ>�~���rT��{v�u�<�m��a�py���Y��F�Gow
��@�K��í-� ��'�xf�~�k]���[�U�\{����~��^��|�Y�z.����(��h/�!���r�&P�$/�&�����o)MD�+.�����$+��!��7;M�|���qY�ulJ�?���f�}w�������щJ�R,�����r�?�<���i�@�T����+�%� a������^�'Lo;q�w��� �-/~���i���#���V��˃	k�J�-PdE(%�� :J!���>���''.kw}�ʯ���\G�Y��C�U;4,J�)�}ӗN;{�U쟘?����n��-�J�����6���`P�N���u�f��;'�sq5�Y�sO���/2�Io�����ڪ�Ꭿ��p�y�n_(�a�\��&^NR;�����3�����'�r��@���x����Z�{X/.}q����!'�;��Z#fk8��g�I�T���J5)��߼�;<4�}�u��j���3cF��s�|����j��:V3Zz��,VC��&5)\cS�4$�����!q�������9aҘ�O6�����uW��w�~!pϦ�kmi8�6)'�	�]���Q5�c�6[����y]لӍ	�������X.��n+���\!e��ú�(KR�T!�Ξ0vԇ>r�GV�ݷ:^�Y6�����-�]� �(H���>�4A�(
��X���<��}��ص;�Ӄ��m��ckt�Π��Zt��/=�~��G��AI���H��E�R
Z��ɀ �ug��G=��1���n���|���<��W^]���|1��La�s��*�D%��� ��Љ�NU��=���|鶻�|���Sjo��u]f����i
/�R����=}j�q�N>���׳����;L�~�%~!��H�(���_�t���]xBb����{n�産>x�eڽU���{��>�(I�:�Ί�Wc�v�8�;������矺��d>�%�ln�-r��D��,v�(EǱ��sO;��o6��K}��Bg�g�e�\�{�o���筗#"��_x>�9���4�1,s�10b��T���l�җF}������m�Wy]Š�oq�R��[v\�x�Eؾ�ކ0����2]�	�5ǁR
xZ�|�g�{��&>����.XV��"�0j�{�!�l����N��}�y�_�i¶/3�j����{׼�ۦ�|�y���s�����D�6>�Z�3��{񲹟<��&��T��4rǬv�v�W��b��Ӥ@̖c���8F�Ђ�REX��=n��?~�/0�j�c�"*�1c��=��U��Җ���W+��"���YYy6�8t���+���i�ٻ����8��߷�=��p��nK!HTA��q���+"I�a����_Y����>���+2ֽ6�5"bD�_u�5�>;��e�����d����u9fFi��~��C���=cwz�mu'�Z0����]����|�o-�b�W��V}gY���������n���孹�7���G>t�v�/>��D.�R��zc����6dY�1�-��?�m�k9p��g�������?@��WJ�y�	�\!_�����c��!��m���U	���6rdu��q��,Y�8�1 V�u�6�v^�U�!�Qpϫ�����_��fc��I�X�τs��m��s�hG��K��D��,m��XL���!����&����p�O=���&�l]�K{t��⬣>4m���>5�����TyY�G���h�D� f2�Pn�A&ع���融c����{�%K��dD��v�2$G��0E�Q\�-�눃���ԭ��s^];^rȄ)K���g.��Q)e`4@Y�����5W-K J�/%��f��1r�D�Ku�D������$���y�a��.���A���OvғoԀ�^{��zd����rO����^0���m�cBJ(2HTṼs���x����)c�1J�.��� JRx^`wIB��硫�K[���9�����׀��✇9���L;�4U�H.����8�Mh2��5j��s��{`�s�����?��[�η�:�I���� ��~Pc�9��h1�_[a|��則���N8��V�ڃl�F���*�]Mf������μ�]Qn
>~����i�*�h�ҁȚFgX�r
�- ��|��ɍ�o�<ݽh@�^��x�9S|p�#���V<�������]�E���e'0J������s�Z!��RT��������8��@��~߬�4M��r[�=���N�oWw� �\�H��frέ�-VF�j�����}��O���í7N���~�g{L|���_�\"Ɋ��/�p�9�?p���Q��t��{�7�:�ȝ��s��q�,K��C��$Ϲ�����w����N����_:嬟��!�p�Ձ���F���8�!���ᖙ�uբ�G]�ֺ���c�.��X�V�(t/[y��p�{o��kV��{zʼ�r[��
	��$���shR������=}�1k�b?�|��弤ڲ$e���B�fUW��C�_~e��-�?�������O������HI��=������9�� _,`����z,17�=�؄���ϥAK��Jn�
�%1�kUp�N:U�`��a<�,[��wԇ�?f̘�C9��c\�e�OJkh��~~�rP���׽�`���Sw�K���_:�ב1�a��#G�V����'ݩ��͝g�y�3��q8��WƘ����p\M���y���
$�R(��QH�i�\���jA��qϿ4��3��x�u3��
��9Z;֪�3�}�<�M-�>��>_��=�>Md��1�	p.�B��M?�}��HΫ��Qc�O�ĥ�;���WF�Y?�u�ز�H�QTC�ll�	|t���~��S�k�G�����d	U4Pt�vdDYfZj�|鲙��˯Ə�����1��aN���N5Đ�?�*m8�>���ZwD$�}z�Y��RgX��
Y�º+��M/7Z���o��G�N���8֛��\2n����Wt/���>�u��LD�vw�	�����;�{_�8�c�a��9�I\�Q�9�Y	�0���rEw�U��#�:����1������J�IR�5j���R�ɜ}-���Vi{��Y#�r#v�c�w�{�CW�a�99��� �JQ�#x�``Rb[3b�(2�-~r��{�����յ�`����α�V�����*��:�ZC
<�x�[�^�N}yʔ)gr�d6E����҂�^Hׁ��9�V̘1#�x���;��������؏}��.x�:FFk��Uz����S��Q�Րj�s�������t�e˗//6��6q�>��9G!��D"�w?r��;�um���|~���l����B�	�r8�v:s��o>A��v������aj�U�ج�LI���uWq�@s�u��wp]����+����	m�{���J�HX��Ō�1s8x�������c�Y��;��鯜�Tkw�!���e����yC[���f<4��V9�0�\>�:��q�e�]1�&��9��;O�nv�8�ɇ�p��	[_'��D6���}���g�Y�� �k[0o�E�c��Xt�!�FK��l��^a (mkl���RK���o����+)�0�m���N��_���d�la4eٳu��/�ےɸ�Ԉ=2��mf�z�ךc�|K�)�"�<σNRpƠ��;�"���:)�WN�i���k���d�{I�F�a��	!`�mu=m��<S�Em2�v���K�/[6=+� 2�� �%C5� �Z���N\��͜Q�8�+�|>?��:y�4���F�����o�i�*3WH��V&I��ˀ��#LBGR�R{�A�?z�эc���D��SwI���{s(DT��3E��,Xά����S=���c���
?9j��>�8ֆ��}������+��l��e��a�x\6KǱ)�����jj cL��y/��]Gԓ�H�,����c̪�s�po9t�}�P����Kv�4�7��>�X#=Ԙ!{o��$"d"�ke��L��mĀ��lw���2��JT���v���=�cl,R�\[�/�'�l�Cs���4��;�R����5��:c�S��#���hZ�^⥸�3�)]o*���{�~ٚ��AHu�֚��x-c�>�;��PZ���\�:�2#v�s�z�����s�<jQ�ul�.U�ka�j�!�!�P���5rة���?v��_���E�D׺�M.����w���0��B��,6c8_9r��k��{#�$<i?�Z��{s�<�1΂�?����x�fK`�*����C�;������m_)���I#��r `Sp��7�� �4���pd�W^���7]�^���Z���N�X� ��D��{��yGB�5�I�gI�\.��8����#��&��|�=�y���Vk+U�^HʁkPJ�ݙN�.�|�4oޢo4�S�Y3&h�c4�f��sk$�8��[E0��(��{'����q6ö����\~��}��o'�l%_7\� ��< ��4]�w���~����]+U�6ٳ�Z���Z��y�a6&����U�̩�+�ep0xұ�yfc�ƶ�b��8ƚ��W?z�o���=��S>}��N�����Ͼ�+�:��Mح����pߣf'Z�������������i��<�,?��'}�w
8(��wTq)���	`��a���*�:
������z}�]^~��Nb�ٕ� �j�1������W�X��!ׄ�ڬ�B09��ąЄ-��]��n��6�2t��1�ZZ�"��qƑ�޴��1ߏ�U%����K�B��5dQ��� 0)�6��[���o�ػpb㘫�h���7s�}f*F:E�)�cP���aݯijVU�LZ�٦�c��������y��|��0�@k�R��'�pFxi�K[�U�^��>Ṳ#�k��ta�7&@0��B.w�1���ꆰ��������~DQ�0W�d�>�6�Q!NB�lQ�:�Ht������(�nu�W�x)��8�Ƥ�uV��k��*��;�\���� �u���0L7�d����x�?ж�qkc�AP0\����/�����χ�GK%F����Y�d]n&�.10mPY���{���g>��߯�v������4Y��Zu�/���gؘᯋ��]���[���{F����l"D=��9GG[��ix㹛-Qc͓hH�oD�������|���VGɍi�`�]��i:P[�^ry?�1`a�B��۵�^w�1&h��a����V��|=��O:���$q6��V�Y3A����qػ���rc�V�Vmm������R�`�Ϙ�>t��8r����[�Kq��'x9L�L[��)S�����Bq�����l��7�j��0�h�=v�P���R����c��><�5�����۟x`��*epa���c5�w�z�G7z,l(�1s��<��D){�d�].�&	l߲L2�ݻrD���tY�V�B�PCܾ�z�X�Ԧ5bs��\rÕ?v��I�B���Y�� �mx>H�8ET�S�I5�{1�=x�}ֻ�w���~w_� .�;ɾQ�mP����c�|��
�-5bkb�;Γ�]L�@��.�%� "���#3��Ĳ�a�俶�]0���]3��p��w�IE3���!�s��g��sa`��0)�}����o�KDkM�!p��a��}j������kI���;�K��e�V�.M4�T�B �;����M��*J3u�+�<dM܊�g�G�䋅.���A^�p)Iu�ޞ�[�l���Gvo��	��Н߻I'x x�䝗%*}\e�kXֽ�N}�_,�l�2�=��#��1���+
r��$��ɡm� �����[c�DTh<�1���1��om������5�m���{�ڙvāMl[�dy�Mpz��O�Q���[z���ߘ��)�7�k������]r�߇�~ڍ���1)�g
�	2vs"��* ���'����P�t㕧-�^����|5��<˜�����X�i��=��볢�#/����w�|uKG�XHn{V��9��Me�A߲7�3_?~S�n�/��î��W��["f�˜�kf0Pa
��_|����x�����ʱ_w�sn��S�� 3l�=�8��3���'��=�Q�8��O=0i��M��v׷"��qƑD����)���I��n�M��{w����1�|�����s}�{�b��~b.It[o<�}�`��r����4���oj>|l���(���9xvm��
rBqީg���6&�>��a3�x�on1��̊��t�K�z7�0��xx���������\�}�<��ݳ￣��>.LC��Å�h!����!�$q��3�?u��cl
��_p�/�W��]��m�k�.��&�p�x��s>v���~��_'�DD����G�t�ψ�sl�(��Q֕܉�+hѲ%�2m�a�a\��5��BHc:Cp��0FPJ%c)��D����8�j("��Q*I���Br�;���m�Н�Q~.@B)�1p5G��?�#���ı�t=��A3r�3k]ߟ��t=x��~_%(��Fi��V�y0^1� �Ĕ1��k�R��H^mim�UØÐF1� �C	@�  ��"���o���k��腋^�aK{knEO7R����:�+溶�'�;%É�s�=���5` �����:�;���a��Ĳ�-��v�d�¨ѣ�ܜ �B��Z��bR;�	>�M2	W���|��>n�7�e��}��3�P(�_OOO%I5�������4vc�-fwf�Y�������=hMId�6�{��uܻ�L�=��ޛL�x����$���*��(��]v�o��WG[G�J���d.~)\8�73�;��}H���._�:e�(HK��;��\��3�,�����RP��5��)`��&m�8�ϓ���+,K�PYQ�6;4I$iBN~��Ĺ�J[5L�w|ۗLa;�KzHsG"B�Ze�l�'���ݮ�c�:�/��<>?��X��t��V8�4����al�ub�������h~xǧr����w����*}:����\{񬠥xVˈ��F������3z�1�m�j?;h+����>L=�pa��sG��ʍ��v��L���l~�2�����7W_��_��O^zǵ�����=v�U3}왧�}��/�9{�Oݖ���F~[�ʵ�W�j98��򞠵�]���M��89��:���:�+���ܤ�Tض�Ҳ[��τgs���l (��/[�Ʋ�֗�����ԓt��E�R�/� �@OO��z�Zm��'�=���>�������Ʊ���8|O�P�\3:+�o�M�  �b�����c�݌g,b�,�Uj�4��g��P�.�D��oy�HP�6d��\lx���`�%�x��������&��Q��\����}��պ��f����j+������k����u<>�s������ҩB�p��pc�T�N�<f�Ŋ�s̔E�\�;�A� C�]
�B'��b���g�.��,�$�u2ƠtC
D��٘�P�@G�FO�_]]#����ȶ��\TC�	�.~,\V��׹��m�]w� �v`�i;N���9�8P<q][>�
��%�d��8pd��$I R�{�k������p\�|>oKG8�b��p�Υd�S����Mƨ�=iH�3��NW�_^&cւYm��x��r��nz䩇�I��������sh�$�A�����A�H&��Bw�����ȅ ���H�f�]����}R(���d��"Kp�z�PVD�9.�I7��1ƻ�����6�}r�۩�4�3�L��q�)�¿�8䨳�Y_^?�����@y��v,@J�j
��vڡ'��8���N��>�\��
�8Vɜ �43�纵Gnޢ���'�$��ˬ�=P����؛�Nl�1F����tm�	S��#�
n�G�3Pq�|�Y=��Grx��=.��O_8�u�JqUqaV�3�!SD!�;[�|���>g $l�@ە�K�s�Q�1ˌc�ƍU����s\[,�ۃ��bJ�,[VkK_/d��1�ZEk7�eͨt�V jI�Ŧ9�d�.�%%aP��nĭD���J��K,p
�B�V��3WH[.�QָT� %��D�k����Q��!�(����vs&�l�XC���2���[97�q�w�	 �RH����fd��W	�a�K�Z�2(���mu����2�WW]������e���:�w˗
��%X��3N#���x�Y�{3�ƅ��_M n�I������+a��\Ii��1�JS��J߈]��ߝ%ə���\�id�Z��B�8�A0	R���N9�#�l�n��5��׏WZo�R��И�4Ӻ�~:v���P}�M�/�Y�(�Ya��
3�����NE*�;"�#�"C��ui]L�0�nAl�q]]�M;�kI���6.M�ҽ�rG<3��3(nd9�|���l�d��>c�6�\�e��0��X�Zeu95���Yۓ���10���-�W��}"�ur�z���X7`��B�����qx�F��u�"S<W����*ك�[V�UY����\Qw-��Yg,Y�/��j��z�;��K���0��
�݅�,�����la���=2eˀ`l��%��XW�R
�VPFCmD�������`2D\��.��!��񽭎���>���g��o-�MTl38�u%<�A�D����rn�k�X����R�y><�)���גq�-Im�R" ����w�B2�J�q�؝��9%�V��/�6�s��]L��*q������J����Q�^˗//>�̋���s�d�&j�'��Z�V^?f��cl.(�}d�v�tR��ΉU�y�_���l���f�n�7�)G��h{[ק�1+�Z�v�S便���=R(���r�/���U8���uk���!o�C'
�|�筒�^_�X7b��B����mD��!2Wg�s��s��e�kz]vs�VJ��.�e�T�pi�2`�מ͹�1�P}N�Ud�3tG�	 ����?&�����y�=f��ꟛ��m������p0� �� ��X!�RH׃p=����d}�U�L��C��`�AT��6㶚=�m�Zwb�{�^|�_�h�״���g�l"��Hׁp$�4˦Uv�
��0^?����	t��4C^�)�C�o�M.�Ձ���I�t@����R"N�k�~��ۺ:�v�A�~�Ys�@*I8�=b�g�>�S�y��{n�K��Pd1	d��"]7l�޾W�w���8�悖�+�2��mn'%��7��8�L�$Y{:�f�ͮ~[8�S�^���� "ں$�X����#sk��횷�ŋf̟1P�����=w�Yi۵��j��jXC[�z�v�>�ܿ�xк�����F�əhP�Qdi����������*!��ڻh0Hǳ�a�� �e1^�LJ����3��b��?[�3��D�T)c�$��d�'S�Q��S����v_���؂}�q��+%<!�6�����!���ܗúQ�����#E
� ���l|_��z���{+�g���
�z��FٜKd�sneĪ�X����\� )A�A�1��YxL�ay�"p\x��&3��>Q����,)��8CDp]��;������oGi�U�m>MS���G�j0�%��O����x�,�^~Z�TjQF۴Y���cZ["�j��-���7�������μ���͡�X��u�H=��xs�z9ָ�
[�������r��j|egk��T��d�,6W_Q0f{�����]w=���4� �Ե\�74�j`�=wS�B��?2�v�6�N����Dǁa��e nJ���RJh������t�,ť���H�]�P�T�T���8v��)b��Xwa[ܷ6�����s)%�Fdݐ�'���q�!g�[�ӎT\���8p�u�Nʔy����(I��p�/���Z�L\g�����#��O%�詤>VjOF���Z_uF��2��W�Q����jOT�kO�����>�V�'�J�$E�S�O��ڬ��J�k��r8;N*ᬸ\{2)��at����t�up���l|_u����+N|�����A��0�`�m$\[��	�\���L�Q�abO�}���s���w���7���QW�j=��]?���-�F_ג+��5W�׸���7|��#ڻ�+z�u�p�	�U-�cwo�9��Q�%|�i�b��qr�,X�v����k��HpD:�:L
�	�l=L���G��]F��AR:D���߬��6�\2������:B"C��p�9���~�����{n�䋯��?���r̮�b�"p=�-��:i�c�?�{���Xa�c���?=+���8���Y��e�:��q�6�:j���8Άr���v�����r���TfA�l����o��t�Tjp�0�����C���~��_t���������i��������7��U��3���MP(���꒑-p���LRג�?�#�yÞhgS@D��.��]�� 'dQC  �ݡHb�����|�KCǸ��{������F�=!�M7���K���	L1Hm~��S>�١cl*�x�Ug������%c�!e��d]����İr��N>�v;yV�8����/�\���Q�&j@��ں�j0�1���Վ�����#:$ PL�K�@�&� cNDF8Z�59� "N8 >cȊ.f;&ľu3��1�0Va	��D.Q��<OZ��:nܸ��w�z^5�v\��+���qX�m����K���A�	�"�'0IJi��z>��+?�����#����Κ�ڮ��������*�yb@�\i�,�hx�����w\��T'6k�;�uu�h&����8��98ܪs��j��~S����Yf�]���]ʤhM����l�/`�9$�5*i���F����l��H<?������U.27���LEƠ�����K�Xe�˺��d־�y���?�|\���la3��\���Æ4O�I�+���/��/�T,b.�}y��t4{..�=�A�MP�q�cb�붿���^7��Oߢ��۩���D�l��!1�8�����:U��w�)爒$�ը!*v��S�q�e��"���:Qk�(�U�]~�\��k#"������q�B:��0�.�T��6����tCrpf�>|����Ե��;um���c&���ر/N;���ǎ}q�1^�q���;7w��[�4eܸyۏ�j��c^��>a�n�N���SGn�����'oi�)��͛2nܼ݇�����qs���K��v3ᅉcǾ�u6�N�c_] 7���=
-���)0X�#�z["B��T#*�z�r�?��.�}�������ý'�zێ�F=���Uf��7j� @k5��F׿�8��$	��*^{�Ս����c��)�� @�m����C�\5 }�����A z���=�s΄��ܭ+��f�JF)@�E'M^��ys��ޗ�qX[,��)6D��ɱ���b镽��{��|\+��	�l%�v��Sθ���G�(e&k?$� ��S�l�D�(�����x�@�,%|md��Z��@2� ����,{��ya�����΁Z���n�����4��	.F;�M�o�ŏ��)��|�s����M���dxGG3(��ݐC��}. 9[�� W�ǯ�G��G��v��9$�s�jo��*cF��W���17�޴�8�����uI�m.3ڜM�;6f����f�V���
2��o�����3�6)�PtJ�g��$�Tm��,�Z	!P-�7<&���oߵUΔ�eR�uӘ!Hf�����M��~��)�DĪQ�M&�VB&�c���[)� �����}��i��J �ʮ���),KEN��f<q��D����7��9C�j�>�5��@s��	ccq�I�����:���	��LߏH�1�r$fc�A>7"p�/����}��uj'�7e��-ƌ~٦ g�1�u��\�R�<�����/�������wݳ���M&Ʋ��z)�1��xH��t��l�u�q  ���fmp�(B�Xh3��}�,��W�v�Y�\���7�}���=�&{�?��=P��@�d�b2�13l䰇��J�w\����N�I���ܒ����;{���6G�=}���+vgR��{���7c� �A0ŉ��_���_�����="��
�E�EBݨ.���m�N���K�_���{�"ec�
Nae��DƵI'��-��;2��H����}4Q锶�N�W+;?��0i��Z��d�z�����:���'3cH�x=���V�Ϥ��]��#\� 0{�l�Y����Z�v��X���������W.]1����g���d
��p1@���`#g����$�
E���^%��u]hT�h�k�i��!62p���q>���v���ej��ʨ�����iI-Ri���/��_�i�fpc�AE�RW�6��166��c���5��lIƬ��a���� F������_����>k}A-�Dպf?��.�cl�����/_(t���f�������iCr��?}�Q�m�>w7?|�6ar�:�w����7،���T�D��p^��o~�!h�\����i��|�o��_y񱡊���\�Z9ǁ"f���./��R-w���h|a�z��]\�Э[.\��G�s�C�;�2i�eĵꬭƍ\�x�������8�T���5�IX�v?`�S&�һ�w~�\�M4I p=4ή�^Gf6���P&O�ro��!��@>����!Ri�"ɬ8���glj��+V����;h�;������I�
PjA���ޏǼ��W� 7��<���l%o�Nv5]7؎�^}�#����j%�6O�����[�oV7����N�����������Q�=)�j&D�D`B��}��=�c޲�曁���s^h�Zˁ� �dw�֭���S*�٪m�E��l(D�����2�H$*��ka���+��y9o,��v�7� ��jCH�8;j�{�l�r��L�u[X���\pi��oedD]_+U�+5���]v����q6'�H̞3�2v n�7�$ G\�h�������o��]+�ڒ����k}���ԃO~j��/5�T��V#�ZC'Y!��s��`�Y��ێ���E��fP���XVkd@���uv���m�W�ʄ�q6D$�}��c��]6�tpV�9����&�c��&L����������p�N�q�kk��Z��+�s�H������㛬Ic_�n���>Vf���z��`��]�0�0e���>>�2��7���=��l7f�����C�^z�߾��+������M������B`l�eN�s�R"M$I�r��5���iV�Fyb�;�_��ᅖ�#C8��!�5b�?�b��f,��ͺ��z�D���=��S��f2T����1�y����vu�k8vŃ,�K2�$�!� ����ԝ����go,���H��a'p$�-!�>`m��3��;l�3h��i1.�I<��P7�o7�1}�'���P�� �y���B��f�� ������֬�=�t�����*I���Q�� ���T�xw$����+{zF�zۍ_^��N�ʵw߼����~L��j����XV/�
�j��w�iʅk�=3�(��I�T}߷�l�AJk�LVi�A�����-_���q6D��>�T�[�ol��U�^���'� ��a�����9<�	��_9��$�	���[ht��S֧	��y��¿��f?>��Z���=K�����ů/�bڴi��7�8s�ƞ1N| �'i���:���q����o���cǎ�T�T�r��Z=9D�aE��+��#�SL����5(�Z���>�M��/�?���ϕZ�X��-��@�X�z���j�$I�m'N�����8��1&?��gq�݆8�z6 n���q:j�🞼��]�n���9�e��@}��&��0���1���~�Y�7�V��N�*n������P8����xW___�1V� r��ֈ�h�D���N�����/��yD�����9�����RK�&�v�������}�$���[��D���C�reE�RE�y �WQ�gY,*�
�b�N��{����h(D$�zǍ�Wkg8�'꺝�XX�����P4�ܵl� ��޳حB�5Y\�e�1��YpW�v��8���$~��{m޸�/�ǯ��'ݼ�gh�	��B���ҕ'6�3�:nZ��X���lAS���r9(���0��Ɓ��O=0����H%��B�d�k�e1l�N,�&��˔Io�!m&8!�r옻�[_�/��~������s�B��h�"�k(�J�R�c�߄Zk�4�g�m'�uM+��"r���k>]�*�����J��ؠ�#����3J���z��bUuP�PI��� D���1`�3����۟ׄ5�ap c<�M2�0L2QdL�F!!	D+�B��z��{��UKӀ��b��Z�j�n����{��goP���5m��C_�a��:��2�y�o�|������7�?�/��:\����`3�cs?��Yڎé}����ו��A���)��*���Dn5Jο���O�ֶ�S��W�?rԨO�IY�n��-�� "�,��1��w�l͚:��֖��l�:������$FAƾ�܂�{�}������{�Z���_�=2ȴT�C�]ߊ>mk��c���,����]ҵD�
�anX��W���]����#p��{Ƶ����Rs��r�e2�P��#�	
ME��˟x'�+cL���n"�����@��B �RDI��O3�C�L��Ӄ{�ƴ)�C��0(��NخO'�gE��U�Hd����w�����Rq���=��##���*�s��b��1�`�S��S�T�I���0Pj��fј]F}k\����5@D����׺��AA�֢>�
��kt�)��g��W���a@�X��|��u� ��Q/�������3�y蜋�6vo������[N|���Զ<�!�� cL~����ӝ%�ΨeRZ�c�rZ��
!�ۚں*����˾��sG�z{[~v�/��7��[�����g�q�4[����[UF:��ݠ���b�b�������V�D�ep|n!�4�����'mOFFD���Ȣ�K�	�D=K�M!M^&�{����'0�ܷ<	Cq��@�s��i:��� ��Ε�aвK�ȥ+_���{n:pGe���w�~H皕w���:73\߷�oZ���\�&��M=�__��ȡk�1j��~Ҥt�@�	��SN�\H�����مG���C~vګ��~Vh)���p�!���1es��Q���n%��� ���������>�	T+������h��_��>�=��w�0�J�P䔥����@�X�4B7�Zo�2n����8�����~�}7�r�+�Ra,s��*��		��̛�8����<�o����������\ׅ�Y�!����>:ɉA�u�>`̙z�CŰ����"�!\Ԓ�#@�{��lF��wf���/F�m�
{�������+pH׃2���ٿ�V�!�"$��mDۈĤ�q�5�\r����������s�5�\���3�+ת%@ؒ����sf ��)�$J�1�w����čC�|;�ѺǪ�q�Zd0��d��\W"IK��d�B��<��폽��6��o��ֿY����\_��:�Ɖy6Xt6iO8�A��\�� WxL�wb 0{��{7u%���Ȗ��҅"�L+x��444#V(�3�6u���o<g{�5� v٭��p��7~�2�},yW DI�\��a8�0J�/X�Z	����T���.�YJ�����|7 i���X�{���_�VO�����y��g?�G%�d&	�8�*!R�ϛ$�[�^��
X�)�sNLJ8��d��~@l��~X[_�jӮ����o���_x��pX�a,�<�Hr8��TmvL�]Ձ�j�Սv�/�>�������w�0����.hپ��!*�K��9(N71���nO/񯉴���$a�ގ�8����he�;�	�}��0�ү���+
A��qeq��A1��)��&���ً�����ٙ6[���s^��Q���g�eY�"�E���q��kQn��p��֦&�9g��������Kϸ���x��k�;egD�vn���+/����_���-�m\Ǆfܾ� 
M%@�j�j)����݋��iA���G���Z�>rKOw���l.O�� P�V!=�̕�e���O<��o.�����sɴ��/Z��?_~c�#K���GW\t٪�뮕���}��ͮԃW}3/�c�����ɉJE\ت�ћ��-��K(SF�z����J�b]�
���n��K~����q�����f��f5D$;7u����ys/��ҫ��/;�?&c�8M�?��f���*0H�h�GޛC׬�cΝ��4lYT��w��~���
�W��{�ec�G�:�����q8���]|��_xi��O�c�1E
��
u�s 0j�����
�L�d��2~r��W1�=��#pG�nH5�0�M=��>�]�o���K;_�g��|�ܢb�硖X�&6l���`�� ����]�G&O���3c��=�w\��Y���Z�������*� @�AQ8?����cl�N�P��v���=4���f���:hV4�AX��X�'�������|Pxp��ݞ��:a0�	@pDQA��R� a�b��0a��31���[����Q'�8t����^x����x�te�!��v]�m��f3�A �$1i�m4Ƽ�F�F��%P�s.|k����v0N�H)9����GT���fY�A0�&�3�x�+��u�1���C���p�SO���%��[���
�l�T*�Z��q�'T*��G_w	!V�m�Z���3��Խ�=^�;w�""~�㷍�^�sDo��P"��>b���ZuL�TdI�B3������d�R�����4cuu)��	�� cHj1������{��O�s�����v�2����^z����VpG�R�R��Rԍ1hmjic.}�jeiZK_��ɏ�L��:j��"��>z�ĸ���+��b���}�°Xd�XI0�Z��4M!�uD0J#K��Lf.��)g�E������OF�z�!h
Q���q�@r�)HΑD)�j--��]{O��{�U#@��z�_���+��6��2�m�D%�0F�﷿�u]p�XEa�29� �8��)�4�)��߮ v��W~��V���"c�ɠ��Z� �(�^�c�g�p�/-��{�=�`��դvQ��6GH�H�V�2I*� �R�����-?��)g^��;�������������鹈�B0G"J���q��՝I�?|����✿��N��Z����q�x��P�`K͌A�ؖAl��;~p�AG}w�:$~7��C�������w�����R8B�f0|�c����8����Oq�{"_Q��__�/^�~R8L��TY���Z'!��R���<�1��A� ��������d�3�\[k�,��쯜|���@k'(�!j��j�jڤi���aǼ�A��@D�gW_�'��K�ȴF��	���p}��F1���U��+$@�qQ�ը�<`���h�s]Og\0/��ܱ��B�YV[x��7W���b�t�QZ ����{4K'/�!�6����cO��ѱ`�������C�wm�\�r'ps��u Π٠b��L�p�5���8$g����H�u�X��4UZ�/��4�~�1�r�mi�Q[��-�&�OJ��!�������9y�Q�~⟆^��x=�p�-��������^bz��Ó�֨��IJ�A���������ac��D�ӟ�j�粪q�Җ�em>��X!p��f??x�2�� �r��/�kRȴ���9,�������h"�׶+�=�t�a-���Fڠ�<U��#�2��D+Gy�����``��8/t�<�s��S�B8��T����+P�m�q]h��!��WY��` 6�[�����gy�v�l!-t���c�Z�'�#�HZZq����E�Lf`���{�s��|�Z&T�{�o/}Yܒ��JX}ؔ���b���0�ĈH�掛�|�k�/�F����9����ux�J6c��֖֛O��7�o^u��C=�W]{�׽B�/����g)d.x���6�N�y�J��:)��l�F&��g�ZRʼϱY!D)�8�jm-m0Z�d
�j�k��6�[�@�:�:[����6k�D�WZ�DI.�3!=�1�od�%�͊�����3f�`��d^�WJA%)
A8��1�P��_6D���\�0��K����� h֭��<��O�{�ԭ'"~��WM����/#{�
!�Q�oUK6ߋ}O����,�Uc� �+88��DH�Aj,�=UV��u]d�J��8�︖(�fV�1�u�D�_��3���wӮ%"��/��������aM� �F5�EE����Ҋ��>n m	���U{j���R9��jҮteSP(�%Y�a��I����d��cs�8�V��a�}]}�'ya����A�3Y�Apk�5k�̯nU���0v�ȞD%�ћ7H� X�w�BK'�'���ꟼ�F����歘����ws��O��2���
���ׇ�B��C�B�@($(S��d
�{��mo?�3G��S��1����?��+}�7y�P(۔00���0iEGUjK7��,�W�;��{ ��(e4��[od7��C�`�V��O0��ߟx�5\����J,ϳ0��`H ����lL�9����alX�N:��Jo�
(�
�Q�D(��ڔ��`���/�bD�tf��]�	�`���0A@%� ,��uH@���s\��\*!KSD�
z��7r2�u�a'�~{ �k���O�}^'w� R��h*�x�I�������譔ɡ�|�:A�SX\&l0�=d�˶��JI���߀g��q��ѣ2�����l0�AD{x�g�Ad�(���~(c�s�nQ1(����5/��m��dL8��%���:>gY׵��E �Bh��*�u�"�N�$GP,@z.�١�|��RHT*p�@����͚����8�K�}� {ىǞ�}��}����>_B�q-{Vz.jq�my�H�Hn�K�Դ��#,�j;g���(�������"�u�|�_"�bĵ����R��8�3���%[?�&�U�p��e/.�>b��uq���N�眃q�!�L��\\�AS�K�-E��x��q�,�6�Z�Q�G��߇�RA�_ �q�F ���Z�捍�&�~�y�����w���v���>��1�@��^@D�'����\x��+�.��涄��R$0 �a��� D��j�3���g~��G���a�2|#c�-�}-C��3"��M���c�>v�!�L��{�Ij	�fa�	ڶ��%�(���(n-�������Y�L��v:P�=|����qw�
  ����h
��Nb�~���I���ZZQ.�Q�McFC���$�EH*1�a� 6͜>��u��?z�ۊ���5�=���n\��	�HyB��_�@Ŷ �q 
�"J�Ŝ�gPMkp]	�187d��"�'k�QBH.���jOy���>?}��O�m\�J����b�'V�F� @��۪Z����m�쉟�sڞ�N��W҉2\3el��A�C�8Bߒ'�,C��
>�f^�
Mp��W!\:g<fZ���l������J����چ�B뷎;�c��n�}[b�	��t�w(���G�8�jp��۪[X*���_����Q�D'�(��e����W�Q��j����NR��E�y���p��#��ͯ�#����1p}�s넮4�Rf�3����/����RF��qH0��Ƃ��*�%AW�A�ˇ��"���Ƶ�ot�$���ǃʈ6m�z�c���>��S�z��＼��+�W2�R��N���dǄq����u���ԙ��������ID���l�4�?��X��sù-�Z��`U���11[�	\[Kf�@���8B��[�|�C��������K.�J��J��-X���1���@���񑽎9h��C��ka���&�tϝ�4��fNn3�e�U#@G�[�4{�}�����5C潀��%����7����]�ȝ���"	���0�X�5!��L.�<;�C3 �vÖ����L��JG�7�<?e���N:�Wm��Cٔ�_u����9��\t�,0�J\ASS����YfkN��<Wɉ)�Ih�l�W�t0�ӿv�1g��	�= V�y���<y��cl/L��G6�J���g�Ͼz�g��^6��Xo���k���N���"��";�d�%;qΡ��ce��3���+e���к��Δ�`����.E��Dq�Dɒ�3g^��}�i�m-.��O�*��J{i�@ҖsӺCAT +
��`;cvP��&?8�1�MV�,IQ
BD՚�D�r��Ν3m�� �y�p��n����J���T�B��������Y{�s�v1"
v�/�b�s���)�a}h�4E�Dh)5!�bx�������&t=�c`�!���c��+��~q�qG^>�}�{RN���W|:5�U~��� $c:�T%�j�Y��LP��]F� �=�:bi�D-͸� ���R!eE!X%μ
�� �f������b!hq\��q*J)�1J��9�s�
IL�]��G47�w�?�֤�&����'/^��Jx���*����&3*J�}㬯5��m<�x��?uA��Ʌ�"K�ҵ}.�Ն5
⁨�}�;�|��m9�Z�q+^|���6��R���)�UW��5��*�͝s>8�·�S���;Y�˒ƲFQR�˭��U��9l̺uo�MfS���缸t��j�}J�͖�%2���=DQd�'l��!^��p{�O���!�R�K���uZ�_�2i�Y�:�cKc <eL0�Q,���.�,�6�ڪ!�ĵfN혻���v� ����O4���9a0�{�#�D�$��jA���Y̈4�(��b���?h�%�$Iϱ�c��p�f0J����cǎ���9G�1�e���y��-|uٞ�>p������AD������$U�������m!���#$��JU{�s�̩Sx���^��Z/��-֜M���	�� ���z�w/=��ӏ��  󞛷׳�^��_�w���ˆP.hZ� p\��L�n¦�&�4�G�8���>�D�e�j�jXk�_;���d
yŝ���;P>��V����;��	FY��Z%�1
�0pb�3"�1Ì�e0�<���kB�s]pDU{2	<�~��m�D�\��w\p���Wn��o�}�����`qgg��O�{il����H?pP�U຾m�+MI���ˮ����'�7��;��ڒq�?��E\�Â0h���4�F�L�0M?9�����9���x���/�Xu���\3j�CJ�ic ߷�W��Pe�RZ���lM�o�(���]��� ��K�|�����	���Ȟ/<����bS��T�`R���F�Ɏ�;�D���o;�g	,���r*�(��M!s��ϙ?:t�o�-?�򂙷�q���w�0S�<�G-��	����~�ϟ��w��v{��sq��c�\>�0���=��}�I�De �{�R6�bܲ�Y���Z��%<�E���H�o��1$g����?�ό=/����eC�a{��(��?��a#F�D�th���$$�l�s(X^M3� ��4E���p��w��O��q�!{���{����KW��}�L�+ i����p�L�]�����;$�����Gg=�ܳ�����a��Iar��fFQϳ5Mc��;�}qA)�bX@����ճiĈῚ4aµG�8l��f*?��'��y a�A�iHɑ�
R����d`�~���-YbBF ����d ���T^N�^�X�ϱ�hc��yj����eG|�Ys�����΂�}}�����'l�^��<��Md�R}����w������=|ݶ��z��yޣ&�������t�$*�YJ�QcFݿ�)��灝�1{�y`�iz��gvye���׭}�RSi<��(�����r	8��}�2� HD>k��I�+ZZ[�ޭ����m�Ǝ�=��~XE���~>����?������N�`����q]{�gƲ9!K5|�f!Q���*���#G�1s��_O�6q�p>|`��A�Y<�҂��=��߻{z>���2\��T*U�r��i_��죖1�޳T޻���������^��K�?���uL��y�p������{c�r� \W��i��%)|�C�R��8I�R]?|���=/�����j�[7�_�9D�,[���G�?�WW����B��T��X��}�mL^>�LQ�e�����N��Qwo�}�;e�D���g�\����)��T��Z��r�q�z����9�M�wH�����?t�ڕ2���Tk5�ET";�.ii���C
I� M4K��q��q\}����z�Խ���M��ۮ?������K&r�a�>4uE���r����`��g�\�D�f�j�F�e�n�X5kߵ� Yf��4B0J����f͜���?:g�)�7�:�َK�D<�8~���}o?h,��9z�뫦�T'�:ƿ2}��?�� ��`ԛ�7|r�+˧ɧz�;�����^�D��1@^�Q�$*��H$���R�䜿<n�]_��{߲�Rw.n]���K�.�3���B��+#�F5sǕ�+MZK�zS�\}S
�b�ɓ_omk�Ü��ou/���#�?��ݏ��8̘�n�=q��� "��K��ѹa��_[�9v����V�%"�8��3�FU��~�y^�V�m4Fu&�h�~��Z^*6?tд�+���~c!-�����x���A0V֮�3�� Ƹ�Z�gJm0I����߽N7�������5�	���Ͼ����ȴAǮ�m�5cփ�;���ۡA�������k�������mx{��,%����-��	J)��rOߟ'O���)�ԣ!��9Ϛ�o��}}�n��w�謠P���s�Z�f3+ �˥�����t�2{݌1c���Ӯ�&�N��\AX:1�偍Ê�W0k�Owv��v~�����޸�M��?���EOO��t�4���3�0G��IƲ��՝9�E^��Wc5'�P  �Pӆ��HŔ1V�����@Dn/z�jq{zz\��&|�س�>�ZZZ�����1F]��j����;noo�v����O눼Vs�c��/�V���*Y	�@�=׼�`�zpܡA�"bO-Z4c����Hwߦ��	��Q��Bh�y5��u��@��z��2j�s�>����d��o���o����eg;���.��.A��z���w9� <!a���(Ρ���{$��A6p1fݭ�R�,���~��S>3���h���;ޗ Vq"� 8V$٢����( 
@24�� "��/6�����׿���~!��q]��U�βA�k=�1f{`u?�����!~R�HcK�%�����% ̘��?~��9kޏ:{4���u��Alg��W_�퍵ˏY�r�l~�p�M�±Č-e����8߬\^p�UIJ#�c���̼\)W�إ��_8�3����h4�@o��� V	"��-
�v�>nM�c�J3=����=J��u]���0v���(Jx�N�k��v��	7��獴s)�Q6l��x��:����״��YGT��ӏ��z��JO��#�)�0~l�	?�<q�&�оr����$Q�@4�@4�@4�@4�@4�@4�@4�@4�@4�@4�@4�@4�@4�������E�5    IEND�B`�
```


## src\components\common\Alert.jsx

```jsx
// src/components/common/Alert.jsx

export default function Alert({ type = "info", children, className = "" }) {
  // Choix couleur selon le type
  const base = "rounded p-3 mb-2 font-sans";
  let color =
    type === "error"
      ? "bg-nodea-blush text-nodea-slate"
      : type === "success"
      ? "bg-nodea-sage text-nodea-slate"
      : "bg-nodea-lavender text-nodea-slate";

  return <div className={`${base} ${color} ${className}`}>{children}</div>;
}
```


## src\components\common\Button.jsx

```jsx
// src/components/common/Button.jsx

export default function Button({
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={
        `w-full bg-nodea-sage text-nodea-sand py-3 rounded hover:bg-nodea-sage-dark hover:text-nodea-sand font-display font-semibold transition ` +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
```


## src\components\common\Card.jsx

```jsx

```


## src\components\common\FormError.jsx

```jsx
// src/components/common/FormFeedback.jsx

export default function FormFeedback({
  message,
  type = "error", // "error" ou "success"
  className = "",
}) {
  if (!message) return null;

  const color =
    type === "success" ? "text-nodea-sage" : "text-nodea-blush-dark"; // rouge si error, vert si success

  return (
    <div className={`mt-2 text-center ${color} ${className}`}>
      {message}
    </div>
  );
}
```


## src\components\common\Input.jsx

```jsx
// src/components/common/Input.jsx

export default function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required = false,
  className = "",
  ...props
}) {
  return (
    <div className="w-full mb-4">
      {label && (
        <label className="block mb-1 font-semibold text-nodea-sage-dark">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full p-2 border rounded focus:outline-none placeholder:text-sm ${className} focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark ${className}`}
        {...props}
      />
    </div>
  );
}
```


## src\components\common\KeyMissingMessage.jsx

```jsx
// src/components/common/KeyMissingMessage.jsx
import React from "react";

export default function KeyMissingMessage({
  context = "continuer",
  className = "",
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 ${className}`}
    >
      <p className="font-medium">Clé de chiffrement absente du cache</p>
      <p className="mt-1">Merci de vous reconnecter pour {context}.</p>
    </div>
  );
}
```


## src\components\common\LogoLong.jsx

```jsx
export default function NodeaLongLogo({ className = "" }) {
  return <img src="/Logo_long.png" alt="Nodea logo" className={className} />;
}
```


## src\components\common\Modal.jsx

```jsx

```


## src\components\common\ProtectedRoute.jsx

```jsx
import { Navigate } from "react-router-dom";
import pb from "../../services/pocketbase";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const user = pb.authStore.model;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/journal" replace />;
  }

  return children;
}
```


## src\components\layout\components\HeaderNav.jsx

```jsx
// src/components/layout/components/ModuleNav.jsx
import { MODULES } from "@/config/modules_list";
import { useStore } from "@/store/StoreProvider";
import { selectCurrentTab } from "@/store/selectors";
import { setTab } from "@/store/actions";

import { useModulesRuntime, isModuleEnabled } from "@/store/modulesRuntime";

export default function HeadearNav() {
  const { state, dispatch } = useStore();
  const current = selectCurrentTab(state);
  const modulesRuntime = useModulesRuntime();

  // On ne montre que les modules marqués display=true
const visibleNav = (MODULES || []).filter((i) => {
  if (i.display === false) return false;
  if (!i.to_toggle) return true;
  return isModuleEnabled(modulesRuntime, i.id);
});
  return (
    <nav className="hidden lg:block ml-4">
      <ul className="flex items-center justify-end gap-5 group px-4">
        {visibleNav.map((item) => (
          <li key={item.id} className="relative group/item">
            <button
              type="button"
              onClick={() => dispatch(setTab(item.id))}
              className="flex flex-col items-center group/nav px-1 "
              aria-current={current === item.id ? "page" : undefined}
            >
              {item.icon ? (
                <item.icon
                  className={`transition-all duration-150 h-6 w-6 ${
                    current === item.id
                      ? "text-nodea-sage"
                      : "text-nodea-sage-dark"
                  }  group-hover:mb-1 group-hover/nav:text-nodea-sage-light`}
                />
              ) : null}
              <span
                className={`absolute top-6 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity ${
                  current === item.id
                    ? "text-nodea-sage"
                    : "text-nodea-sage-dark"
                } group/nav-hover:text-nodea-sage-light`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```


## src\components\layout\components\SideLinks.jsx

```jsx
import classNames from "classnames";

export default function Link({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        active
          ? "bg-nodea-sage-lighter text-nodea-slate-light hover:bg-nodea-sage-light hover:text-nodea-sage-darker"
          : "text-nodea-sage-dark hover:bg-nodea-sage-light hover:text-nodea-sage-darker",
        "group flex w-full gap-x-3 rounded-md p-2 text-sm"
      )}
    >
      {Icon && (
        <Icon
          className={classNames(
            active
              ? "text-nodea-slate-light group-hover:text-nodea-sage-darker"
              : "text-nodea-sage-dark group-hover:text-nodea-sage-darker",
            "h-6 w-6 shrink-0"
          )}
        />
      )}
      {label}
    </button>
  );
}
```


## src\components\layout\components\SubNavDesktop.jsx

```jsx
import clsx from "clsx";

export default function SubNavDesktop({ title, tabs = [], onTabSelect }) {
  if (!tabs.length) return null;

  return (
    // caché en mobile ; visible md+ ; prend la place restante
    <nav
      className="hidden md:flex items-center gap-1 flex-1
                 md:overflow-x-auto md:whitespace-nowrap
                 lg:overflow-visible"
      aria-label={`${title ?? "Sections"} tabs`}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTabSelect?.(t.id)}
          className={clsx(
            "px-3 py-1.5 text-sm rounded-md transition",
            t.active
              ? "bg-none text-nodea-sage-darker bg-nodea-sand hover:bg-nodea-sage-lighter"
              : "text-nodea-sage-dark hover:bg-nodea-sage-lighter"
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```


## src\components\layout\components\SubNavMobile.jsx

```jsx
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

export default function SubNavMobile({ tabs = [], onTabSelect }) {
  if (!tabs.length) return null;

  return (
    // visible seulement en mobile ; collé à droite
    <div className="md:hidden ml-auto">
      <Menu as="div" className="relative">
        <MenuButton
          type="button"
          className="inline-flex items-center justify-center"
          aria-label="Liens de la section"
        >
          <EllipsisVerticalIcon className="h-6 w-6" aria-hidden="true" />
        </MenuButton>

        <MenuItems
          transition
          className="absolute right-0 z-50 mt-2.5 w-56 origin-top-right
                     rounded-md bg-white py-2 shadow-lg
                     outline-1 outline-gray-900/5
                     data-closed:scale-95 data-closed:opacity-0
                     data-enter:duration-100 data-leave:duration-75"
        >
          {tabs.map((t) => (
            <MenuItem key={t.id}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => onTabSelect?.(t.id)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    focus ? "bg-gray-50" : ""
                  } ${t.active ? "font-semibold" : ""}`}
                >
                  {t.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
    </div>
  );
}
```


## src\components\layout\components\UserAvatar.jsx

```jsx
// src/components/common/UserAvatar.jsx
import Avatar from "boring-avatars";

export default function UserAvatar({
  seed, // string stable (id ou username)
  size = 32,
  className = "",
  variant = "bauhaus", // "beam" | "marble" | "pixel" | "sunset" | "ring" | "bauhaus"
}) {
  return (
    <Avatar
      size={size}
      name={seed}
      variant={variant}
      colors={[
        "#90b6a2", // sage
        "#d8c7e4", // lavender
        "#f4d8d9", // blush
        "#a9d6e5", // sky
        "#2b2d2f", // slate
      ]}
      square={false}
      className={className}
    />
  );
}
```


## src\components\layout\components\UserMenu.jsx

```jsx
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import UserAvatar from "../components/UserAvatar";

export default function UserMenu({
  username = "Utilisateur·rice",
  onGoAccount = () => {},
  onGoSettings = () => {},
  onSignOut = () => {},
}) {
  return (
    <Menu as="div" className="relative">
      <MenuButton className="relative flex items-center">
        <span className="sr-only">Ouvrir le menu utilisateur</span>
        {/* On garde exactement seed + size comme dans le code existant */}
        <UserAvatar seed={username} size={32} />
        <span className="hidden lg:flex lg:items-center">
          <span className="ml-4 text-sm font-semibold text-gray-900">
            {username}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="ml-2 size-5 text-gray-400"
          />
        </span>
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-50 mt-2.5 w-44 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75"
      >
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onGoAccount}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              Votre profil
            </button>
          )}
        </MenuItem>
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onGoSettings}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              Paramètres
            </button>
          )}
        </MenuItem>
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onSignOut}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              Déconnexion
            </button>
          )}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
```


## src\components\layout\Header.jsx

```jsx
// src/components/layout/Header.jsx
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { useStore } from "../../store/StoreProvider";
import { setTab, openMobile } from "../../store/actions";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const store = useStore();
  const dispatch = store?.dispatch ?? store?.[1];
  const username = user?.username || "Utilisateur·rice";
  
  
  const handleMenuClick = () => dispatch(openMobile());
  const handleGoAccount = () => dispatch(setTab("account"));
  const handleGoSettings = () => dispatch(setTab("settings"));
  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };
  
  return (
    <header className="sticky w-screen top z-40 flex h-16 items-center  border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="mx-auto w-full">
        <div className="flex h-16 items-center justify-between">
          {/* Left: mobile hamburger + logo */}
          <div className="flex items-end b-0 gap-4">
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-gray-700"
              onClick={handleMenuClick}
              aria-label="Ouvrir le menu"
            >
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
            {/* Nav modules desktop */}
            <div className="hidden md:flex items-center h-8">
              <Logo className="max-h-full w-auto" />
            </div>
            {/* Nav modules desktop */}
            <HeaderNav />
          </div>{" "}
          <div className="flex md:hidden items-center h-8">
            <Logo className="max-h-full w-auto" />
          </div>
          {/* Right: menu utilisateur (factorisé) */}
          <div className="flex items-center justify-end gap-x-4 lg:gap-x-6">
            <UserMenu
              username={username}
              onGoAccount={handleGoAccount}
              onGoSettings={handleGoSettings}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

import HeaderNav from "./components/HeaderNav";
import Logo from "../common/LogoLong.jsx";
import UserMenu from "./components/UserMenu.jsx";
```


## src\components\layout\Layout.jsx

```jsx
import { useMemo } from "react";
import { nav } from "./Navigation";
import { Outlet } from "react-router-dom";
import { useStore } from "@/store/StoreProvider";
import { selectCurrentTab } from "@/store/selectors";
import useBootstrapModulesRuntime from "@/hooks/useBootstrapModulesRuntime";

export default function Layout() {
  useBootstrapModulesRuntime();
  // Le layout ne passe pas de props au Header/Sidebar : il se contente d'orchestrer la vue active
  const store = useStore();
  const state = store?.state ?? store?.[0];

  const current = selectCurrentTab(state);

  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);

  return (
    <div className="min-h-screen bg-slate-50 flex ">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 bg-white">{ActiveView}</main>
      </div>
    </div>
  );
}

// Imports locaux placés en bas pour garder le diff plus lisible
import Header from "./Header";
import Sidebar from "./Sidebar";
```


## src\components\layout\Navigation.jsx

```jsx
// src/components/layout/Navigation.jsx
// -------------------------------------------------------------
// Adapte le manifeste MODULES pour l’UI existante :
// - exporte `nav` (array) que Header/Sidebar consomment
// - conserve element/display/to pour le Layout
// -------------------------------------------------------------
import { MODULES } from "@/config/modules_list.jsx";

// Ici on ne touche pas aux icônes : Header/Sidebar n’en ont pas besoin.
// Si un jour tu en veux, ajoute "icon" côté MODULES et utilise-le là-bas.
export const nav = MODULES.map((m) => ({
  id: m.id,
  label: m.label,
  to: m.to,
  element: m.element,
  display: m.display !== false,
  to_toggle: !!m.to_toggle,
  collection: m.collection ?? null,
  description: m.description ?? "",
}));

// Petit helper optionnel
export const findNavByPath = (path) => nav.find((i) => i.to === path) || nav[0];
```


## src\components\layout\Sidebar.jsx

```jsx
// src/components/layout/Sidebar.jsx
import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { useStore } from "@/store/StoreProvider";
import { selectCurrentTab, selectMobileOpen } from "@/store/selectors";
import { closeMobile, setTab } from "@/store/actions";

import Logo from "../common/LogoLong.jsx";
import Link from "./components/SideLinks.jsx";

import { useModulesRuntime, isModuleEnabled } from "@/store/modulesRuntime";
import { MODULES } from "@/config/modules_list"; // tu l’avais déjà

export default function Sidebar() {
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const dispatch = store?.dispatch ?? store?.[1];

  const current = selectCurrentTab(state);
  const open = selectMobileOpen(state);

  const modulesRuntime = useModulesRuntime();
  const visibleItems = (MODULES || []).filter((i) => {
    if (i.display === false) return false; // respect 'display'
    if (!i.to_toggle) return true; // non-toggleables: toujours visibles
    return isModuleEnabled(modulesRuntime, i.id); // toggleables: visible seulement si activé
  });
  
  const handleSelect = (id) => {
    dispatch(setTab(id));
    dispatch(closeMobile());
  };

  const handleClose = () => dispatch(closeMobile());

  return (
    <>
      {/* Drawer mobile */}
      <Transition show={open} as={Fragment}>
        <Dialog className="relative z-50 lg:hidden" onClose={handleClose}>
          <div className="fixed inset-0" />
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative mr-16 flex w/full max-w-xs flex-1">
                <div className="flex grow flex-col overflow-y-auto bg-white px-4 pb-4 border-r border-gray-200">
                  <div className="flex h-16 items-center justify-between pr-2">
                    <Logo className="w-1/2" />
                    <button
                      type="button"
                      className="-m-2.5 p-2.5 text-gray-700"
                      onClick={handleClose}
                      aria-label="Fermer le menu"
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <nav className="mt-4 flex flex-1 flex-col justify-between">
                    <ul role="list" className="space-y-1">
                      {visibleItems.map((item) => (
                        <li key={item.id}>
                          <Link
                            icon={item.icon}
                            label={item.label}
                            active={current === item.id}
                            onClick={() => handleSelect(item.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </DialogPanel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
```


## src\components\layout\Subheader.jsx

```jsx
// src/components/layout/Subheader.jsx
import clsx from "clsx";
import { useMemo } from "react";

import { useStore } from "@/store/StoreProvider";
import { selectCurrentTab } from "@/store/selectors";
import { MODULES } from "@/config/modules_list";

import SubNavDesktop from "./components/SubNavDesktop";
import SubNavMobile from "./components/SubNavMobile";

export default function Subheader({ tabs = [], onTabSelect, className }) {
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const current = selectCurrentTab(state);

  const title = useMemo(() => {
    return MODULES.find((t) => t.id === current)?.label ?? "";
  }, [current]);

  return (
    <div
      className={clsx(
        "sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200",
        className
      )}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-4">
        {title ? (
          <h1 className="shrink-0 text-base font-semibold leading-6 text-gray-900">
            {title}
          </h1>
        ) : null}

        <SubNavDesktop tabs={tabs} onTabSelect={onTabSelect} title={title} />
        <SubNavMobile tabs={tabs} onTabSelect={onTabSelect} />
      </div>
    </div>
  );
}
```


## src\config\modules_list.jsx

```jsx
// src/config/modules_list.js
import {
  HomeIcon,
  SparklesIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Home from "../modules/Homepage";
import Mood from "../modules/Mood";
import Goals from "../modules/Goals";
import Account from "../modules/Account"
import Settings from "../modules/Settings";

export const MODULES = [
  {
    id: "home",
    label: "Acceuil",
    collection: null,
    element: <Home />,
    to_toggle: false,
    description: "Homepage",
    icon: HomeIcon,
    display: true,
  },
  {
    id: "mood",
    label: "Mood",
    collection: "mood_entries",
    element: <Mood />,
    to_toggle: true,
    description: "Journal d’humeur, suivi quotidien.",
    icon: SparklesIcon,
    display: true,
  },
  {
    id: "goals",
    label: "Goals",
    collection: "goals_entries",
    element: <Goals />,
    to_toggle: true,
    description: "Objectifs, jalons, micro-actions.",
    icon: CheckCircleIcon,
    display: true,
  },
  {
    id: "account",
    label: "Mon compte",
    collection: null,
    element: <Account />,
    to_toggle: false,
    description: "Gestion du compte",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "settings",
    label: "Paramètres",
    collection: null,
    element: <Settings />,
    to_toggle: false,
    description: "Paramètres des modules",
    icon: Cog6ToothIcon,
    display: false,
  },
];

export const getModuleById = (id) => MODULES.find((m) => m.id === id) || null;
```


## src\data\questions.json

```json
[
  "Qu’est-ce qui t’a fait sourire aujourd’hui ?",
  "Un moment où tu t’es sentie pleinement vivante aujourd’hui ?",
  "Quel geste ou parole t’a touchée ?",
  "Qu’as-tu fait qui demandait du courage, même petit ?",
  "As-tu eu une surprise, agréable ou pas, aujourd’hui ?",
  "Qu’est-ce qui t’a apaisée dans ta journée ?",
  "Quel lien t’a nourrie, ou au contraire t’a pesé ?",
  "Un moment où tu as ressenti de la fierté ?",
  "Qu’as-tu appris de neuf sur toi ou sur le monde ?",
  "Un sentiment qui a traversé ta journée, et que tu nommes ici ?",
  "Un endroit où tu as respiré ou pris le temps d’exister ?",
  "Quelque chose dont tu voudrais te souvenir ?",
  "As-tu croisé la tendresse quelque part aujourd’hui ?",
  "Une envie que tu as eue, réalisée ou non ?",
  "Un moment où tu t’es sentie alignée avec tes valeurs ?",
  "Qu’as-tu laissé derrière toi aujourd’hui ?",
  "Qu’est-ce qui t’a aidée à traverser un passage difficile ?",
  "As-tu ressenti de la gratitude aujourd’hui ? Pour quoi, qui ?",
  "Un détail anodin mais important à tes yeux ?",
  "Quelque chose que tu aurais aimé dire et que tu n’as pas dit ?",
  "Un moment où tu t’es sentie en lien avec la nature ?",
  "Qu’as-tu choisi de faire pour toi, et pas pour les autres ?",
  "Une peur ressentie aujourd’hui ? Qu’as-tu fait avec ?",
  "Un rêve ou une pensée qui t’a accompagnée ?",
  "Qu’est-ce qui t’a mise en colère ?",
  "Un geste de soin, envers toi-même ou autrui ?",
  "Une sensation physique marquante (douleur, plaisir, chaleur…) ?",
  "As-tu pris un risque, petit ou grand ?",
  "Une musique ou un son qui t’a accompagnée ?",
  "Un moment où tu t’es sentie libre ?",
  "As-tu ressenti de la honte ou du doute ?",
  "Une décision prise, même minime ?",
  "Un espace où tu t’es sentie en sécurité ?",
  "Un moment de beauté dans ta journée ?",
  "As-tu accordé du temps à quelqu’un qui en avait besoin ?",
  "Qu’as-tu créé ou transformé ?",
  "As-tu fait preuve de patience ?",
  "Un souvenir qui t’a traversée aujourd’hui ?",
  "Un mot ou une phrase que tu veux garder de ce jour ?",
  "As-tu laissé une place à l’imprévu ?",
  "Qu’est-ce qui t’a fait rire ?",
  "Une personne à qui tu penses, et pourquoi ?",
  "Un lieu où tu aimerais retourner ?",
  "As-tu ressenti de la joie simple ?",
  "Un geste ou un mot que tu regrettes ?",
  "Qu’est-ce que tu voudrais faire différemment demain ?",
  "Qu’as-tu refusé ou posé comme limite ?",
  "Un moment de partage, même bref ?",
  "As-tu été attentive à un besoin qui s’exprimait en toi ?",
  "Un geste de révolte ou d’insoumission aujourd’hui ?",
  "As-tu ressenti de la fatigue ou de l’énergie ?",
  "Une petite victoire à célébrer ?",
  "As-tu fait une rencontre, même brève ou étrange ?",
  "Un échec ou une déception ? Comment l’as-tu vécue ?",
  "Un instant de paix intérieure ?",
  "Une question que tu te poses ce soir ?",
  "As-tu donné ou reçu de l’aide ?",
  "Qu’as-tu lâché prise aujourd’hui ?",
  "Un aliment ou une saveur marquante ?",
  "Une envie non satisfaite ?",
  "Qu’as-tu fait aujourd’hui qui allait dans le sens de ta liberté ?",
  "Un souvenir d’enfance qui est remonté ?",
  "Une peur qui t’a retenue ou poussée à agir ?",
  "Un compliment reçu ou donné ?",
  "Un moment où tu t’es sentie invisible ou vue ?",
  "Qu’as-tu observé chez les autres ?",
  "Un instant de silence, choisi ou subi ?",
  "Qu’as-tu perdu ou laissé filer ?",
  "As-tu découvert un nouvel endroit ou un nouveau visage ?",
  "Qu’as-tu ressenti en début et en fin de journée ?",
  "Un moment où tu as pris soin de ton corps ?",
  "Qu’as-tu évité ou reporté aujourd’hui ?",
  "Un geste ou une parole pour résister à la norme ?",
  "Une émotion qui domine ce soir ?",
  "Une chose qui te manque en ce moment ?",
  "Qu’as-tu trouvé de beau dans le banal ?",
  "Une question à laquelle tu n’as pas de réponse ?",
  "As-tu pris le temps de rêver ?",
  "Un engagement tenu, ou non tenu ?",
  "Un souvenir à laisser derrière toi ?",
  "Qu’as-tu accepté aujourd’hui, en toi ou autour de toi ?",
  "Un moment où tu t’es sentie déplacée, étrangère ?",
  "Une sensation d’être à ta place, ou non ?",
  "Qu’as-tu donné sans attendre en retour ?",
  "Une parole ou un silence important ?",
  "Un projet, même petit, que tu as avancé ?",
  "Qu’as-tu envie de remercier, ce soir ?",
  "As-tu pu exprimer qui tu es, vraiment ?",
  "Qu’as-tu observé du monde autour de toi ?",
  "Un instant d’humilité ou de remise en question ?",
  "Un moment où tu as accueilli l’inconnu ?",
  "As-tu choisi la facilité ou la difficulté ?",
  "Un moment où tu as ressenti l’injustice ?",
  "Qu’as-tu fait pour faire de la place à la joie ?",
  "Un geste de solidarité, de soutien ?",
  "Une pensée persistante aujourd’hui ?",
  "As-tu éprouvé de la peur, de l’envie, du désir ?",
  "Qu’as-tu envie de changer dans ta vie ?",
  "Un instant où tu t’es sentie chez toi ?",
  "Un mot pour résumer ta journée ?"
]
```


## src\hooks\useAuth.js

```js
import { useState, useEffect } from 'react'
import pb from '../services/pocketbase'

export default function useAuth() {
  const [user, setUser] = useState(pb.authStore.model)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    await pb.collection('users').authWithPassword(email, password)
    setUser(pb.authStore.model)
    setLoading(false)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return { user, login, logout, loading }
}
```


## src\hooks\useBootstrapModulesRuntime.js

```js
// src/hooks/useBootstrapModulesRuntime.js
import { useEffect } from "react";
import pb from "@/services/pocketbase";
import { loadModulesConfig } from "@/services/modules-config";
import { setModulesState } from "@/store/modulesRuntime";
import { useMainKey } from "@/hooks/useMainKey";

/**
 * Monte la config modules déchiffrée dans le store runtime
 * dès que l'utilisateur est connecté et que mainKey est dispo.
 */
export default function useBootstrapModulesRuntime() {
  const { mainKey } = useMainKey();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const user = pb?.authStore?.model;
      if (!user || !mainKey) return;

      try {
        const cfg = await loadModulesConfig(pb, user.id, mainKey); // objet DÉCHIFFRÉ
        if (!cancelled) {
          setModulesState(cfg || {});
        }
      } catch (e) {
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
```


## src\hooks\useJournalEntries.js

```js

```


## src\hooks\useMainKey.jsx

```jsx
import { createContext, useContext, useState, useMemo } from "react";

/**
 * mainKey: Uint8Array(32) | null
 * setMainKey: (Uint8Array(32) | null) => void
 */
const MainKeyContext = createContext({ mainKey: null, setMainKey: () => {} });

export function MainKeyProvider({ children }) {
  const [mainKey, setMainKey] = useState(null);

  const value = useMemo(() => ({ mainKey, setMainKey }), [mainKey]);
  return (
    <MainKeyContext.Provider value={value}>{children}</MainKeyContext.Provider>
  );
}

export function useMainKey() {
  return useContext(MainKeyContext);
}
```


## src\hooks\useUsers.js

```js

```


## src\modules\Account\components\ChangeEmail.jsx

```jsx
import React, { useState } from "react";
import pb from "../../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function EmailSection({ user }) {
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const navigate = useNavigate();

  const handleEmail = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");

    if (!newEmail) {
      setEmailError("Renseigne un nouvel email");
      return;
    }

    try {
      await pb.collection("users").requestEmailChange(newEmail);
      setEmailSuccess(
        "Un email de confirmation a été envoyé, la session va être déconnectée. La reconnexion sera possible après validation."
      );
      setTimeout(() => {
        pb.authStore.clear();
        navigate("/login");
      }, 6000);
      setNewEmail("");
    } catch (err) {
      if (err?.data?.email) {
        setEmailError("Cet email est déjà utilisé.");
      } else {
        setEmailError("Erreur lors de la demande.");
      }
    }
  };

  return (
    <section>
      <form onSubmit={handleEmail} className="flex flex-col gap-3">
        <div>
          <input
            id="newEmail"
            type="email"
            placeholder="Nouvel email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 block w-1/2 rounded-md border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 text-sm placeholder:text-sm placeholder:text"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Tu recevras un mail de confirmation pour valider ce changement.
          </p>
        </div>
        {emailSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {emailSuccess}
          </div>
        )}
        {emailError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {emailError}
          </div>
        )}
        <div className="flex items-center">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-nodea-sage px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sage-dark"
          >
            Modifier l’email
          </button>
        </div>
      </form>
    </section>
  );
}
```


## src\modules\Account\components\ChangeUsername.jsx

```jsx
import React, { useState } from "react";
import pb from "../../../services/pocketbase";

export default function UsernameSection({ user }) {
  const [username, setUsername] = useState(user?.username || "");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const handleUsername = async (e) => {
    e.preventDefault();
    setUsernameSuccess("");
    setUsernameError("");

    try {
      await pb.collection("users").update(user.id, { username });
      setUsernameSuccess("Nom d’utilisateur mis à jour.");
    } catch {
      setUsernameError("Erreur lors de la modification.");
    }
  };

  return (
    <section>
      <form onSubmit={handleUsername} className="flex flex-col gap-3">
        <div>
          <input
            id="username"
            type="text"
            placeholder="Nouveau nom d’utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-1/2 rounded-md border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 text-sm placeholder:text-sm placeholder:text"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Ton identifiant public dans l’appli.
          </p>
        </div>

        {usernameSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {usernameSuccess}
          </div>
        )}

        {usernameError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {usernameError}
          </div>
        )}

        <div className="flex items-center">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-nodea-sage px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sage-dark"
          >
            Modifier
          </button>
        </div>
      </form>
    </section>
  );
}
```


## src\modules\Account\components\DeleteAccount.jsx

```jsx
// src/modules/Settings/Account/DeleteAccount.jsx
import React, { useState } from "react";
import pb from "../../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function DeleteAccountSection({ user }) {
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte ?"
      )
    ) {
      return;
    }
    try {
      const journals = await pb.collection("mood_entries").getFullList({
        filter: `user="${user.id}"`,
      });
      for (const entry of journals) {
        await pb.collection("mood_entries").delete(entry.id);
      }
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch {
      setDeleteError("Erreur lors de la suppression");
    }
  };

  return (
    <section>
      <div className="flex flex-col gap-3">
        {deleteError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {deleteError}
          </div>
        )}

        <div className="flex items-center">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center rounded-md bg-nodea-blush-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-blush-darker "
          >
            Supprimer mon compte
          </button>
        </div>

        <p className="text-xs text-slate-500">
          La suppression est <strong>définitive</strong>
          <br /> Toutes les données associées à ce compte seront perdues. Cette
          action est non réversible.
        </p>
      </div>
    </section>
  );
}
```


## src\modules\Account\components\ExportData.jsx

```jsx
// src/modules/Settings/Account/ExportData.jsx
import React, { useState, useEffect } from "react";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { decryptAESGCM } from "@/services/webcrypto";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function ExportDataSection({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);

  useEffect(() => {
    if (mainKey) {
      window.crypto.subtle
        .importKey("raw", mainKey, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ])
        .then(setCryptoKey);
    } else {
      setCryptoKey(null);
    }
  }, [mainKey]);

  const decryptField = async (field) => {
    if (!cryptoKey || !field) return "";
    try {
      return await decryptAESGCM(JSON.parse(field), cryptoKey);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

  const handleExport = async () => {
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      const entries = await pb.collection("mood_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });

      if (entries.length === 0) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const decrypted = await Promise.all(
        entries.map(async (e) => ({
          id: e.id,
          date: e.date,
          mood_score: await decryptField(e.mood_score),
          mood_emoji: await decryptField(e.mood_emoji),
          positive1: await decryptField(e.positive1),
          positive2: await decryptField(e.positive2),
          positive3: await decryptField(e.positive3),
          question: await decryptField(e.question),
          answer: await decryptField(e.answer),
          comment: await decryptField(e.comment),
        }))
      );

      const data = JSON.stringify(decrypted, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user?.username || user?.email || "nodea"}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess("Export terminé");
    } catch {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  const ready = Boolean(user && cryptoKey);

  // 👉 Pas de bouton ni de texte explicatif si la clé n'est pas là
  if (!ready) {
    return (
      <section>
        <KeyMissingMessage context="exporter des données" />
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-nodea-lavender-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-lavender-darker disabled:opacity-60"
          >
            {loading ? "Chargement…" : "Exporter les données"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Exporte un fichier JSON (non chiffré) des données.
        </p>

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {success}
          </div>
        )}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
```


## src\modules\Account\components\ImportData.jsx

```jsx
// src/modules/Settings/Account/ImportData.jsx
import React, { useState } from "react";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptAESGCM } from "@/services/webcrypto";
import { listMoodEntries, createMoodEntry } from "@/services/moodEntries";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function ImportData() {
  const { mainKey } = useMainKey(); // clé brute attendue (Uint8Array)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = Boolean(mainKey && moduleUserId);

  async function handleImport(e) {
    setError("");
    setSuccess("");
    setLoading(true);

    const file = e.target.files?.[0];
    if (!file) {
      setError("Aucun fichier sélectionné.");
      setLoading(false);
      return;
    }

    try {
      // 1) Lire & parser le JSON fourni
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) {
        throw new Error("Fichier invalide : un tableau JSON est attendu.");
      }

      // 2) Construire l'index des dates déjà présentes (via LIST + déchiffrement)
      const existingItems = await listMoodEntries(moduleUserId);
      const existingDates = new Set();
      for (const r of existingItems) {
        try {
          const plaintext = await decryptAESGCM(
            { iv: r.cipher_iv, data: r.payload },
            mainKey
          );
          const obj = JSON.parse(plaintext || "{}");
          const d = (
            obj.date || (r.created ? String(r.created).slice(0, 10) : "")
          ).slice(0, 10);
          if (d) existingDates.add(d);
        } catch {
          // ignore entrées illisibles
        }
      }

      // 3) Importer en dédupliquant par date (si déjà présente => ignore)
      let ignored = 0;
      let importedCount = 0;

      for (const entry of imported) {
        const date = String(entry?.date || "").slice(0, 10);
        if (!date) {
          ignored++;
          continue;
        }
        if (existingDates.has(date)) {
          ignored++;
          continue;
        }

        // Construire le payload clair attendu par le module Mood
        // (on n'embarque question/answer QUE si answer non-vide)
        const includeQA = !!String(entry?.answer || "").trim();

        const payload = {
          date,
          mood_score: String(entry?.mood_score ?? ""),
          mood_emoji: String(entry?.mood_emoji ?? ""),
          positive1: String(entry?.positive1 ?? ""),
          positive2: String(entry?.positive2 ?? ""),
          positive3: String(entry?.positive3 ?? ""),
          comment: String(entry?.comment ?? ""),
          ...(includeQA
            ? {
                question: String(entry?.question ?? ""),
                answer: String(entry?.answer ?? ""),
              }
            : {}),
        };

        // Sanity minimale : note et 3 positifs requis (comme dans Form)
        if (
          payload.mood_score === "" ||
          !payload.positive1.trim() ||
          !payload.positive2.trim() ||
          !payload.positive3.trim() ||
          !payload.mood_emoji
        ) {
          ignored++;
          continue;
        }

        // Création 2 temps (POST "init" + PATCH HMAC) via le service
        await createMoodEntry({
          moduleUserId,
          mainKey,
          payload,
        });

        existingDates.add(date);
        importedCount++;
      }

      setSuccess(
        `Import terminé : ${importedCount} entrée(s) ajoutée(s), ${ignored} ignorée(s).`
      );
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
    } finally {
      setLoading(false);
      // réinitialiser l'input file pour pouvoir réimporter le même nom
      e.target.value = "";
    }
  }

  if (!ready) {
    return (
      <section className="p-4">
        <KeyMissingMessage context="importer des données d'humeur" />
      </section>
    );
  }

  return (
    <section className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <label
            htmlFor="import-json"
            className="inline-flex items-center justify-center rounded-md bg-nodea-lavender-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-lavender-darker cursor-pointer"
            style={{ display: loading ? "none" : "inline-flex" }}
          >
            Sélectionner le fichier
            <input
              id="import-json"
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
              disabled={loading}
            />
          </label>
          {loading && (
            <span className="text-sm ml-2 opacity-70">Import en cours…</span>
          )}
        </div>

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Seules les dates absentes seront ajoutées. Type de fichier attendu :
          JSON (voir format ci-dessous).
        </p>
      </div>
    </section>
  );
}
```


## src\modules\Account\components\PasswordReset.jsx

```jsx
// src/modules/Settings/Account/PasswordReset.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function PasswordResetSection() {
  const navigate = useNavigate();
  const handleClick = () => navigate("/change-password");

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center rounded-md bg-nodea-sky-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sky-darker"
          >
            Changer mon mot de passe
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Ce bouton te permet de modifier ton mot de passe sans perdre l’accès à
          tes données chiffrées.
        </p>
      </div>
    </section>
  );
}
```


## src\modules\Account\components\SettingsCard.jsx

```jsx
export default function SettingsCard({ title, children }) {
  return (
    <section className=" bg-white p-4 sm:p-5 border-b border-gray-300 px-4 sm:px-6 lg:px-8">
      {title ? (
        <label className="text-sm font-semibold text-slate-900">{title}</label>
      ) : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}
```


## src\modules\Account\index.jsx

```jsx
// src/modules/Settings/SettingsIndex.jsx
import useAuth from "@/hooks/useAuth"; // si tu n'as pas d'alias "@", remplace par "../../hooks/useAuth"

import ChangeEmail from "./components/ChangeEmail";
import ChangeUsername from "./components/ChangeUsername";
import ChangePassword from "./components/PasswordReset";
import ImportData from "./components/ImportData";
import ExportData from "./components/ExportData";
import DeleteAccount from "./components/DeleteAccount";
import SettingsCard from "./components/SettingsCard";

export default function SettingsIndex() {
  const { user } = useAuth();

  // petite garde pour éviter un écran blanc si user pas encore dispo
  if (!user) {
    return <div className="py-6">Chargement du compte…</div>;
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <SettingsCard title="Changer l’email">
        <ChangeEmail user={user} />
      </SettingsCard>

      <SettingsCard title="Changer le nom d’utilisateur·ice">
        <ChangeUsername user={user} />
      </SettingsCard>

      <SettingsCard title="Changer le mot de passe">
        <ChangePassword user={user} />
      </SettingsCard>

      <SettingsCard title="Importer des données">
        <ImportData user={user} />
      </SettingsCard>

      <SettingsCard title="Exporter mes données">
        <ExportData user={user} />
      </SettingsCard>

      <SettingsCard title="Supprimer mon compte">
        <DeleteAccount user={user} />
      </SettingsCard>
    </div>
  );
}
```


## src\modules\Admin\components\InviteCode.jsx

```jsx
import React from "react";

export default function InviteCodeManager({
  inviteCodes,
  generating,
  onGenerate,
  copySuccess,
  onCopy,
}) {
  return (
    <div className="mt-8 px-12">
      <div className="flex gap-3 items-center justify-center">
        <button
          onClick={onGenerate}
          className="bg-sky-700 text-white px-4 py-2 rounded hover:bg-sky-800"
          disabled={generating}
        >
          {generating ? "Génération..." : "Générer un code d’invitation"}
        </button>
      </div>
      {copySuccess && (
        <div className="mt-2 text-green-600 font-medium">{copySuccess}</div>
      )}
      {inviteCodes.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Codes d’invitation valides :</div>
          <ul className="flex flex-wrap gap-3">
            {inviteCodes.map((c) => (
              <li
                key={c.id || c.code}
                className="bg-gray-100 px-3 py-2 rounded flex items-center gap-2"
              >
                <span className="font-mono">{c.code}</span>
                <button
                  className="text-sky-700 text-xs hover:underline"
                  onClick={() => onCopy(c.code)}
                >
                  Copier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```


## src\modules\Admin\components\UserTable.jsx

```jsx
import React from "react";
import ExportUserData from "./ExportUserData";

export default function UserTable({ users, onDelete, onResetPassword }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-50">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left">Username</th>
            <th className="px-3 py-3 text-left hidden md:table-cell">Rôle</th>
            <th className="px-3 py-3">Supprimer</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr
              key={user.id}
              className={`${
                i % 2 === 1 ? "bg-gray-50" : "bg-white"
              } hover:bg-sky-50`}
            >
              <td className="px-3 py-3 font-medium">{user.username}</td>
              <td className="px-3 py-3 hidden md:table-cell">{user.role}</td>
              <td className="px-3 py-3">
                <button
                  className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 text-sm"
                  onClick={() => onDelete(user.id)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```


## src\modules\Admin\Admin.jsx

```jsx
import React, { useEffect, useState } from "react";
import pb from "../../services/pocketbase";
import UserTable from "./Admin/UserTable";
import InviteCodeManager from "./components/InviteCode";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [lastCode, setLastCode] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("users").getFullList({
          sort: "email",
          $autoCancel: false,
        });
        setUsers(result);
      } catch (err) {
        setError("Erreur chargement users: " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const result = await pb.collection("invites_codes").getFullList({
          sort: "-created",
          $autoCancel: false,
        });
        setInviteCodes(result);
      } catch (err) {}
    };
    fetchCodes();
  }, [generating, lastCode]);

  // Suppression user + ses entrées journal
  const handleDelete = async (userId) => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? Toutes ses entrées journal seront aussi supprimées."
      )
    )
      return;
    try {
      const journals = await pb.collection("mood_entries").getFullList({
        filter: `user="${userId}"`,
      });
      for (const entry of journals) {
        await pb.collection("mood_entries").delete(entry.id);
      }
      await pb.collection("users").delete(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Erreur suppression : " + (err?.message || ""));
    }
  };

  const handleResetPassword = async (user) => {
    const email = user.email;
    if (!window.confirm(`Envoyer un mail de reset à ${email} ?`)) return;
    try {
      await pb.collection("users").requestPasswordReset(email);
      alert("Mail de réinitialisation envoyé");
    } catch (err) {
      alert("Erreur reset : " + (err?.message || ""));
    }
  };

  // Code d'invitation
  function randomCode(len = 8) {
    return Math.random()
      .toString(36)
      .replace(/[^a-z0-9]+/g, "")
      .slice(-len)
      .toUpperCase();
  }

  const handleGenerateCode = async () => {
    setGenerating(true);
    setCopySuccess("");
    const code = randomCode(8);
    try {
      const record = await pb.collection("invites_codes").create({ code });
      setLastCode(code);
      setInviteCodes([record, ...inviteCodes]);
      setCopySuccess("");
    } catch (err) {
      setCopySuccess("Erreur lors de la création du code");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(`Code copié : ${code}`);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {
      setCopySuccess("Erreur lors de la copie");
    }
  };

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <>
      <h1 className="text-2xl font-bold mt-10 mb-6">
        Gestion des utilisateur·ice·s
      </h1>
      <UserTable
        users={users}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
      />
      <InviteCodeManager
        inviteCodes={inviteCodes}
        generating={generating}
        onGenerate={handleGenerateCode}
        copySuccess={copySuccess}
        onCopy={handleCopy}
      />
    </>
  );
}
```


## src\modules\Admin\index.jsx

```jsx

```


## src\modules\Goals\index.jsx

```jsx
// src/modules/Mood/Index.jsx
import { useState, useMemo } from "react";

export default function GoalsIndex() {
  // onglet/sous-page actif du module (indépendant de la nav globale)
  const [active, setActive] = useState("form"); // "history" par défaut
  
  const tabs = useMemo(
    () => [
      { id: "form", label: "Nouvelle entrée", active: active === "form", mobile: true },
      { id: "history", label: "Historique", active: active === "history", mobile: true },
      { id: "graph", label: "Graphique", active: active === "graph", mobile: false },
    ],
    [active]
  );
  
  return (
    <div className="flex flex-col min-h-full">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)} // switch local
        cta={{
          label: "Nouvelle entrée",
          onClick: () => setActive("form"),
        }}
        />

      <div className="flex-1 pt-4 bg-white px-4 sm:px-6 lg:px-8">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}

import Subheader from "../../components/layout/Subheader";
import MoodForm from "../Mood/Form";
import MoodHistory from "../Mood/History";
import MoodGraph from "../Mood/Graph";
```


## src\modules\Mood\components\FormComment.jsx

```jsx
export default function JournalComment({ comment, setComment }) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <label className="text-sm font-semibold">Commentaire :</label>
      <textarea
        value={comment || ""}
        onChange={(e) => setComment(e.target.value)}
        className="w-full p-3 border rounded min-h-50"
        placeholder="Réponse optionnelle"
      />
    </div>
  );
}
```


## src\modules\Mood\components\FormMood.jsx

```jsx
import EmojiPicker from "emoji-picker-react";

export default function JournalMood({
  moodScore,
  setMoodScore,
  moodEmoji,
  setMoodEmoji,
  showPicker,
  setShowPicker,
  emojiBtnRef,
  pickerRef,
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-row items-end justify-between">
        <div className="flex items-center gap-4">
          <span>Résumé</span>
          <button
            type="button"
            className="text-2xl border rounded h-10 w-10 flex items-center justify-center"
            ref={emojiBtnRef}
            onClick={() => setShowPicker(!showPicker)}
            style={{ lineHeight: 1 }}
          >
            {moodEmoji || "🙂"}
          </button>
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute z-50 top-16 left-1/2 -translate-x-1/2 shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={(e) => {
                  setMoodEmoji(e.emoji);
                  setShowPicker(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Note</span>
          <select
            value={moodScore}
            onChange={(e) => setMoodScore(Number(e.target.value))}
            className="p-1 h-10 border rounded text-base"
            required
          >
            <option value="" disabled>
              Sélectionner
            </option>
            <option value="2">🤩 2</option>
            <option value="1">😊 1</option>
            <option value="0">😐 0</option>
            <option value="-1">😓 -1</option>
            <option value="-2">😭 -2</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```


## src\modules\Mood\components\FormPositives.jsx

```jsx
export default function JournalPositives({
  positive1,
  setPositive1,
  positive2,
  setPositive2,
  positive3,
  setPositive3,
  required = false,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Premier point positif du jour :
        </label>
        <textarea
          value={positive1}
          onChange={(e) => setPositive1(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Deuxième point positif du jour :
        </label>
        <textarea
          value={positive2}
          onChange={(e) => setPositive2(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Troisième point positif du jour :
        </label>
        <textarea
          value={positive3}
          onChange={(e) => setPositive3(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
    </div>
  );
}
```


## src\modules\Mood\components\FormQuestion.jsx

```jsx
export default function JournalQuestion({
  question,
  answer,
  setAnswer,
  loading,
}) {
  return (
    <div className="flex flex-col w-full basis-full md:basis-3/5 ">
      <div className="text-sm font-semibold">Question du jour :</div>
      <div className="mb-2 italic text-gray-800 text-sm">
        {loading ? <span className="opacity-50">Chargement…</span> : question}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full mb-0 p-3 border rounded min-h-18 resize-none align-top"
        rows={2}
        placeholder="Réponse optionnelle"
        disabled={loading}
      />
    </div>
  );
}
```


## src\modules\Mood\components\GraphChart.jsx

```jsx
// src/modules/Mood/components/GraphChart.jsx
import { ResponsiveContainer } from "recharts";
import RotatedFrame from "./GraphFrame";
import ChartBody from "./GraphChartBody";

export default function GraphChart({ data }) {
  return (
    // Parent définit l'emprise logique. Ajuste si besoin.
    <div className="w-full h-[min(80vh,700px)] md:h-[min(80vh,800px)]">
      <RotatedFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ChartBody data={data} />
        </ResponsiveContainer>
      </RotatedFrame>
    </div>
  );
}
```


## src\modules\Mood\components\GraphChartBody.jsx

```jsx
// src/modules/Mood/components/ChartBody.jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// dd.mm
export const formatDDMM = (iso) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
};

function ChartTooltip({ active, payload, label, formatDDMM }) {
  if (!(active && payload && payload.length)) return null;
  const { mood, emoji } = payload[0].payload || {};
  return (
    <div className="bg-white border rounded p-2 shadow text-sm">
      <div>
        <span className="font-bold">Date :</span> {formatDDMM(label)}
      </div>
      <div>
        <span className="font-bold">Mood :</span> {mood} {emoji}
      </div>
    </div>
  );
}

export default function ChartBody({ data, width, height }) {
  return (
    <LineChart
      data={data}
      width={width}
      height={height}
      // Pas de valeurs fixes : on met tout à 0.
      // L'offset réel est géré par la YAxis (auto-width) → tooltip aligné.
      margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
    >
      <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
      <XAxis
        dataKey="date"
        tickFormatter={formatDDMM}
        interval={0}
        tick={({ x, y, payload }) => (
          <g>
            <text
              x={x}
              y={y + 15}
              textAnchor="middle"
              fill="#374151"
              fontSize={12}
            >
              {formatDDMM(payload.value)}
            </text>
          </g>
        )}
      />
      {/* Laisse Recharts dimensionner l'axe Y (auto) → pas de px figés */}
      <YAxis domain={[-2, 2]} />
      <Tooltip
        content={(p) => <ChartTooltip {...p} formatDDMM={formatDDMM} />}
      />
      <Line
        type="monotone"
        dataKey="mood"
        stroke="#90b6a2"
        strokeWidth={3}
        dot={{ r: 6, fill: "#f7f4ef" }}
        activeDot={{ r: 8 }}
      />
    </LineChart>
  );
}
```


## src\modules\Mood\components\GraphFrame.jsx

```jsx
// src/modules/Mood/components/RotatedFrame.jsx
import { useEffect, useRef, useState } from "react";

/**
 * Desktop : pas de rotation (le chart remplit 100% du parent).
 * Mobile (≤768px) :
 *  - on calcule la TAILLE DU CONTENEUR (pas le viewport)
 *  - on fixe la taille VISIBLE du chart après rotation :
 *       visibleWidth  = h * mobileWidthPct
 *       visibleHeight = w * mobileHeightPct
 *  - on prépare le bloc AVANT rotation en "swappant" :
 *       preRotateWidth  = visibleHeight
 *       preRotateHeight = visibleWidth
 *  - on fait rotate(90deg) translateY(-100%) avec origin-top-left
 *  - on centre en posant left/top = (container - visible)/2
 */
export default function RotatedFrame({
  children,
  mobileWidthPct = 1,
  mobileHeightPct = 1,
}) {
  const hostRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 }); // taille exacte du conteneur

  // Breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Taille du conteneur (strictement)
  useEffect(() => {
    const measure = () => {
      if (!hostRef.current) return;
      const r = hostRef.current.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    hostRef.current && ro.observe(hostRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const { w, h } = box;
  if (!w || !h)
    return <div ref={hostRef} className="w-full h-full overflow-hidden" />;

  if (!isMobile) {
    // Desktop : pas de rotation
    return (
      <div ref={hostRef} className="relative w-full h-full overflow-hidden">
        <div className="absolute inset-0">
          <div style={{ width: "100%", height: "100%" }}>{children}</div>
        </div>
      </div>
    );
  }

  // ------ Mobile : calculs précis ------
  // Dimensions VUES après rotation (paysage sur mobile tenu en portrait)
  const visibleWidth = h * mobileWidthPct; // doit s'inscrire dans h
  const visibleHeight = w * mobileHeightPct; // doit s'inscrire dans w

  // Dimensions AVANT rotation (swap)
  const preRotateWidth = visibleHeight; // deviendra la HAUTEUR visible
  const preRotateHeight = visibleWidth; // deviendra la LARGEUR visible

  return (
    <div ref={hostRef} className="relative w-full h-full overflow-hidden">
      {/* Ce bloc est dimensionné AVANT rotation.
          Après rotate(90deg) translateY(-100%), sa boîte visible = (visibleWidth x visibleHeight). */}
      <div
        className="absolute"
        style={{
          // on positionne le coin haut-gauche du bloc ROTATÉ
          width: preRotateHeight,
          height: preRotateWidth,
          transformOrigin: "top left",
          transform: "rotate(90deg) translateY(-100%)",
          // pas de scale → pas de "zoom" parasite
        }}
      >
        <div style={{ width: "100%", height: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
```


## src\modules\Mood\components\HistoryEntry.jsx

```jsx
export default function HistoryEntry({ entry, onDelete, decryptField }) {
  const dateObj = new Date(entry.date);
  const jours = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const jour = jours[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");

  return (
    <li className="relative mb-6 p-4 bg-white rounded shadow min-w-[250px] max-w-xs flex-1">
      <div className="flex items-center mb-2 justify-between">
        <span className="font-bold">
          {jour.charAt(0).toUpperCase() + jour.slice(1)}
          <span className="mx-1 text-gray-500"></span>
          {dd}.{mm}
        </span>
        <div className="flex items-center justify-center pr-8 ">
          <span className="text-xl mr-3">{entry.mood_emoji}</span>
          <span className="ml-auto px-2 py-1 rounded bg-sky-50">
            {entry.mood_score}
          </span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="absolute top-2 right-2 bg-white rounded-full p-1 hover:bg-red-100 transition group"
          title="Supprimer"
          tabIndex={-1}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="block"
          >
            <circle cx="10" cy="10" r="10" fill="#F87171" opacity="0.20" />
            <path
              d="M7 7L13 13M13 7L7 13"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive1}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive2}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {entry.positive3}
        </div>
      </div>
      {/* Question du jour */}
      {entry.question && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Question du jour : <span>{entry.question}</span>
        </div>
      )}
      {/* Réponse à la question */}
      {entry.answer && (
        <div className="mb-1 ml-2 italic text-sky-900 text-sm">
          ↳ {entry.answer}
        </div>
      )}
      {/* Commentaire */}
      {entry.comment && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Commentaire :{" "}
          <span className=" font-normal text-gray-700 italic">
            {entry.comment}
          </span>
        </div>
      )}
    </li>
  );
}
```


## src\modules\Mood\components\HistoryFilters.jsx

```jsx
export default function HistoryFilters({
  month,
  setMonth,
  year,
  setYear,
  years,
}) {
  return (
    <div className="flex justify-center gap-4 mb-6">
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="border border-nodea-slate-light text-nodea-slate rounded p-1"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(0, i).toLocaleString("fr-FR", { month: "long" })}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="border rounded border-nodea-slate-light text-nodea-slate  p-1"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
```


## src\modules\Mood\components\HistoryList.jsx

```jsx
export default function HistoryList({ entries, onDelete, decryptField }) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500">Aucune entrée pour cette période.</div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-8 w-full md:px-10 ">
      {entries.map((entry) => (
        <HistoryEntry
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          decryptField={decryptField}
          />
        ))}
    </ul>
  );
}

import HistoryEntry from "./HistoryEntry";
```


## src\modules\Mood\Form.jsx

```jsx
// src/modules/Mood/Form.jsx
import React, { useState, useEffect, useRef } from "react";
import pb from "@/services/pocketbase";
import questions from "@/data/questions.json";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { encryptAESGCM } from "@/services/webcrypto";
import { useMainKey } from "@/hooks/useMainKey";

// --- Helpers HMAC (dérivation du guard) ---
const te = new TextEncoder();
function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
async function hmacSha256(keyRaw, messageUtf8) {
  // keyRaw: ArrayBuffer|Uint8Array (mainKey ou guardKey)
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}
async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard  = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  const hex = toHex(tag);
  return "g_" + hex; // 64 hex chars → ok avec le pattern ^(g_[a-z0-9]{32,}|init)$
}

export default function JournalEntryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [positive1, setPositive1] = useState("");
  const [positive2, setPositive2] = useState("");
  const [positive3, setPositive3] = useState("");
  const [moodScore, setMoodScore] = useState("");
  const [moodEmoji, setMoodEmoji] = useState("");
  const [comment, setComment] = useState("");
  const [answer, setAnswer] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [randomQuestion, setRandomQuestion] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(true);

  const { mainKey } = useMainKey(); // attendu: bytes (pas CryptoKey)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  // Import CryptoKey WebCrypto dès que mainKey dispo pour AES-GCM
  const [cryptoKey, setCryptoKey] = useState(null);
  useEffect(() => {
    if (!mainKey) return;
    // si mainKey est déjà une CryptoKey (selon ton contexte), on ne peut pas la réutiliser pour AES ici
    if (typeof mainKey === "object" && mainKey?.type === "secret") {
      return;
    }
    window.crypto.subtle
      .importKey("raw", mainKey, { name: "AES-GCM" }, false, ["encrypt"])
      .then((key) => {
        setCryptoKey(key);
      })
      .catch(() => setCryptoKey(null));
  }, [mainKey]);

  // Choix aléatoire simple pour l’instant
  useEffect(() => {
    const q = questions[Math.floor(Math.random() * questions.length)];
    setRandomQuestion(q);
    setLoadingQuestion(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!cryptoKey) {
      setError(
        "Erreur : clé de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
      );
      return;
    }
    if (!positive1.trim() || !positive2.trim() || !positive3.trim()) {
      setError("Merci de remplir les trois points positifs.");
      return;
    }
    if (moodScore === "" || moodScore === null) {
      setError("Merci de choisir une note d'humeur.");
      return;
    }
    if (!moodEmoji) {
      setError("Merci de choisir un emoji.");
      return;
    }
    if (!moduleUserId) {
      setError("Module 'Humeur' non configuré (id manquant).");
      return;
    }

    try {
      // 1) Payload clair (clés attendues côté lecture)
      // -> n'ajoute question/answer que si une réponse a été saisie
      const includeQA = !!answer.trim();
      const payloadObj = {
        date,
        positive1,
        positive2,
        positive3,
        mood_score: String(moodScore),
        mood_emoji: moodEmoji,
        comment,
        ...(includeQA ? { question: randomQuestion, answer: answer } : {}),
      };


      // 2) Chiffrement AES-GCM (retourne { iv, data } en base64url)
      const { data, iv } = await encryptAESGCM(
        JSON.stringify(payloadObj),
        cryptoKey
      );

      // 3) CREATE (étape A) : POST avec guard="init"
      const recordCreate = {
        module_user_id: String(moduleUserId),
        payload: String(data),
        cipher_iv: String(iv),
        guard: "init",
      };

      const created = await pb.send("/api/collections/mood_entries/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordCreate),
      });

      if (!created?.id) {
        throw new Error("Création incomplète (id manquant).");
      }

      // 4) Promotion (étape B) : calcul HMAC du guard et PATCH ?d=init
      if (
        typeof mainKey === "object" &&
        mainKey?.type === "secret" &&
        !("buffer" in mainKey)
      ) {
        // mainKey CryptoKey non extractible → scénario non supporté ici
        throw new Error(
          "MainKey non exploitable pour HMAC. Reconnecte-toi pour récupérer la clé brute."
        );
      }

      const guard = await deriveGuard(mainKey, moduleUserId, created.id);

      await pb.send(
        `/api/collections/mood_entries/records/${encodeURIComponent(
          created.id
        )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guard }),
        }
      );

      setSuccess("Entrée enregistrée !");
      setPositive1("");
      setPositive2("");
      setPositive3("");
      setMoodScore("");
      setMoodEmoji("");
      setComment("");
      setAnswer("");
    } catch (err) {
      setError("Erreur lors de l’enregistrement : " + (err?.message || ""));
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto ">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold text-center md:text-left">
            Nouvelle entrée
          </h1>
          <div className="flex-shrink-0 flex items-center justify-center md:justify-end w-full md:w-85 mt-5">
            <input
              id="journal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 mb-4">
          <div className="flex flex-col w-full md:w-1/2">
            <PositivesBlock
              positive1={positive1}
              setPositive1={setPositive1}
              positive2={positive2}
              setPositive2={setPositive2}
              positive3={positive3}
              setPositive3={setPositive3}
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-1/2 gap-4">
            <MoodBlock
              moodScore={moodScore}
              setMoodScore={setMoodScore}
              moodEmoji={moodEmoji}
              setMoodEmoji={setMoodEmoji}
              showPicker={showPicker}
              setShowPicker={setShowPicker}
              emojiBtnRef={emojiBtnRef}
              pickerRef={pickerRef}
            />
            <CommentBlock comment={comment} setComment={setComment} />
          </div>
        </div>
        <div className="mb-6 flex flex-col md:flex-row items-end gap-3">
          <QuestionBlock
            question={randomQuestion}
            answer={answer}
            setAnswer={setAnswer}
            loading={loadingQuestion}
          />
          <Button type="submit" className="w-full md:w-1/2">
            Enregistrer
          </Button>
          {error && <FormError message={error} />}
          {success && (
            <div className="text-green-700 text-sm mt-2">{success}</div>
          )}
        </div>
        <div className="flex justify-center"></div>
      </form>
    </>
  );
}

import PositivesBlock from "./components/FormPositives";
import MoodBlock from "./components/FormMood";
import QuestionBlock from "./components/FormQuestion";
import CommentBlock from "./components/FormComment";
import Button from "@/components/common/Button";
import FormError from "@/components/common/FormError";
```


## src\modules\Mood\Graph.jsx

```jsx
// src/modules/Mood/Graph.jsx
import React, { useEffect, useState } from "react";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptAESGCM } from "@/services/webcrypto";
import { listMoodEntries } from "@/services/moodEntries";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // démarre à true
  const [error, setError] = useState("");

  const { mainKey } = useMainKey();
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        if (!mainKey)
          throw new Error("Clé de chiffrement absente. Reconnecte-toi.");
        if (!moduleUserId) throw new Error("Module 'Humeur' non configuré.");

        // 1) Récupère les entrées chiffrées (triées -created par le service)
        const items = await listMoodEntries(moduleUserId);

        // 2) Déchiffre chaque payload et extrait ce dont le graph a besoin
        const rows = [];
        for (const r of items) {
          try {
            const plaintext = await decryptAESGCM(
              { iv: r.cipher_iv, data: r.payload },
              mainKey
            );
            const obj = JSON.parse(plaintext || "{}");

            const d =
              obj.date || (r.created ? String(r.created).slice(0, 10) : "");
            const s = Number(obj.mood_score);
            const e = obj.mood_emoji || "";

            if (!d || Number.isNaN(s)) continue;
            rows.push({ date: d, mood: s, emoji: e });
          } catch {
            // entrée illisible → on ignore
          }
        }

        // 3) Filtre : 6 derniers mois glissants
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const inRange = rows.filter((r) => {
          const dd = new Date(r.date);
          return dd >= start && dd <= now;
        });

        // 4) Tri par date ascendante pour la courbe
        inRange.sort((a, b) => a.date.localeCompare(b.date));

        if (!cancelled) setData(inRange);
      } catch (err) {
        if (!cancelled)
          setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  // ── Ordre des retours : d’abord l’absence de clé/module, ensuite loading/erreurs/données
  if (!mainKey)
    return (
      <KeyMissingMessage context="afficher le graphique" className="m-5" />
    );
  if (!moduleUserId)
    return (
      <div className="p-8">Module &laquo; Humeur &raquo; non configuré.</div>
    );

  if (loading) return <div className="p-8">Chargement…</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  return <GraphChart data={data} />;
}

import GraphChart from "./components/GraphChart";
import KeyMissingMessage from "../../components/common/KeyMissingMessage";
```


## src\modules\Mood\History.jsx

```jsx
// src/modules/Mood/History.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listMoodEntries, deleteMoodEntry } from "@/services/moodEntries";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { useMainKey } from "@/hooks/useMainKey";
import { decryptAESGCM } from "@/services/webcrypto";
import FormError from "@/components/common/FormError";

// --- Helpers HMAC (dérivation du guard) ---
// On duplique ici pour limiter les refactos (pas de nouveau module).
const te = new TextEncoder();
function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
async function hmacSha256(keyRaw, messageUtf8) {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}
async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard    = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  const hex = toHex(tag);
  return "g_" + hex; // 64 hex chars
}

export default function MoodHistory() {
  const { mainKey } = useMainKey(); // attendu: bytes (pas CryptoKey)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1); // 1..12
  const [year, setYear] = useState(today.getFullYear());
  
  const [allEntries, setAllEntries] = useState([]); // déchiffrées
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Charger + déchiffrer
  useEffect(() => {
    let cancelled = false;
    
    async function run() {
      setLoading(true);
      setError("");
      
      if (!moduleUserId) {
        setError("Module 'Humeur' non configuré.");
        setLoading(false);
        return;
      }
      if (!mainKey) {
        setError("Clé de chiffrement absente. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      try {
        const items = await listMoodEntries(moduleUserId);
        const parsed = await Promise.all(
          items.map(async (r) => {
            try {
              const plaintext = await decryptAESGCM(
                { iv: r.cipher_iv, data: r.payload },
                mainKey
              );
              const obj = JSON.parse(plaintext || "{}");
              return {
                id: r.id,
                created: r.created,
                date: obj.date || (r.created ? r.created.slice(0, 10) : ""),
                mood_score: obj.mood_score ?? "",
                mood_emoji: obj.mood_emoji ?? "",
                positive1: obj.positive1 ?? "",
                positive2: obj.positive2 ?? "",
                positive3: obj.positive3 ?? "",
                comment: obj.comment ?? "",
                question: obj.question ?? "",
                answer: obj.answer ?? "",
              };
            } catch {
              // entrée illisible → on la masque
              return null;
            }
          })
        );

        if (!cancelled) {
          setAllEntries(parsed.filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    run();
    return () => {
      cancelled = true;
    };
  }, [moduleUserId, mainKey]);
  
  // Années disponibles pour le select
  const years = useMemo(() => {
    const set = new Set(
      allEntries
      .map((e) => (e.date || "").slice(0, 4))
      .filter((y) => /^\d{4}$/.test(y))
      .map((y) => Number(y))
    );
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [today.getFullYear()];
  }, [allEntries]);
  
  // Filtrage local par mois/année
  const entries = useMemo(() => {
    const mm = String(month).padStart(2, "0");
    const yy = String(year);
    return allEntries.filter((e) => (e.date || "").startsWith(`${yy}-${mm}-`));
  }, [allEntries, month, year]);
  
  // Suppression : on calcule le guard (HMAC) à la volée
  async function handleDelete(id) {
    setError("");
    
    if (!moduleUserId || !mainKey) {
      setError("Contexte invalide (clé ou module).");
      return;
    }
    
    // eslint-disable-next-line no-alert
    const ok = window.confirm("Supprimer définitivement cette entrée ?");
    if (!ok) return;
    
    try {
      const guard = await deriveGuard(mainKey, moduleUserId, id);
      await deleteMoodEntry(id, moduleUserId, guard);
      setAllEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err?.message || "Suppression impossible.");
    }
  }
  
  if (loading) {
    return <div className="w-full max-w-4xl mx-auto py-6">Chargement…</div>;
  }
  
  return (
    <div className="w-full max-w-5xl mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Historique</h1>

      {error ? <FormError message={error} /> : null}

      <HistoryFilters
        month={month}
        setMonth={(v) => setMonth(Number(v))}
        year={year}
        setYear={(v) => setYear(Number(v))}
        years={years}
      />

      <HistoryList entries={entries} onDelete={handleDelete} />
    </div>
  );
}

import HistoryFilters from "./components/HistoryFilters";
import HistoryList from "./components/HistoryList";
```


## src\modules\Mood\index.jsx

```jsx
// src/modules/Mood/Index.jsx
import { useState, useMemo } from "react";

export default function MoodIndex() {
  // onglet/sous-page actif du module (indépendant de la nav globale)
  const [active, setActive] = useState("form"); // "history" par défaut
  
  const tabs = useMemo(
    () => [
      { id: "form", label: "Nouvelle entrée", active: active === "form", mobile: true },
      { id: "history", label: "Historique", active: active === "history", mobile: true },
      { id: "graph", label: "Graphique", active: active === "graph", mobile: false },
    ],
    [active]
  );
  
  return (
    <div className="flex flex-col min-h-full">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)} // switch local
        cta={{
          label: "Nouvelle entrée",
          onClick: () => setActive("form"),
        }}
        />

      <div className="flex-1 pt-4 bg-white px-4 sm:px-6 lg:px-8">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}

import Subheader from "../../components/layout/Subheader";
import MoodForm from "./Form";
import MoodHistory from "./History";
import MoodGraph from "./Graph";
```


## src\modules\Settings\components\ModulesManager.jsx

```jsx
// src/modules/Settings/components/ModulesManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/config/modules_list";
import {
  loadModulesConfig,
  saveModulesConfig,
  getModuleEntry,
  setModuleEntry,
} from "@/services/modules-config";
import { generateModuleUserId, makeGuard } from "@/services/crypto-utils";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";

// ⬇️ nouvel import
import { setModulesState } from "@/store/modulesRuntime";

export default function ModulesManager() {
  const { mainKey } = useMainKey();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const rows = useMemo(
    () => MODULES.filter((m) => m.to_toggle === true && !!m.id),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const user = pb?.authStore?.model;
        if (!user) throw new Error("Utilisateur non connecté");

        const c = await loadModulesConfig(pb, user.id, mainKey); // déchiffré
        let nextCfg = c || {};

        // seed par défaut: tout activé
        for (const m of rows) {
          const entry = getModuleEntry(nextCfg, m.id);
          if (!entry) {
            nextCfg = setModuleEntry(nextCfg, m.id, {
              enabled: true,
              module_user_id: generateModuleUserId("g_"),
              delete_secret: makeGuard(),
              algo: "v1",
            });
          }
        }

        if (JSON.stringify(nextCfg) !== JSON.stringify(c || {})) {
          await saveModulesConfig(pb, user.id, mainKey, nextCfg);
        }

        if (mounted) {
          setCfg(nextCfg);
          // ⬇️ alimente le store runtime à l’ouverture de la page
          setModulesState(nextCfg);
          setLoading(false);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn(e);
        if (mounted) {
          setError("Impossible de charger vos réglages.");
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [mainKey, rows]);

  if (loading) return <div>Chargement…</div>;

  const toggleModule = async (moduleId, nextEnabled) => {
    setBusy(moduleId);
    setError("");
    try {
      const current = getModuleEntry(cfg, moduleId) || {
        enabled: true,
        module_user_id: generateModuleUserId("g_"),
        delete_secret: makeGuard(),
        algo: "v1",
      };

      const next = {
        ...current,
        enabled: nextEnabled,
        module_user_id:
          current.module_user_id || (nextEnabled ? generateModuleUserId("g_") : null),
        delete_secret: current.delete_secret || makeGuard(),
      };

      const updated = setModuleEntry(cfg, moduleId, next);
      const user = pb?.authStore?.model;

      await saveModulesConfig(pb, user.id, mainKey, updated);

      // ⬇️ maj store runtime après save
      setModulesState(updated);

      setCfg(updated);
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e);
      setError("Impossible d’enregistrer vos réglages.");
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        Aucun module n’est actuellement configurable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((m) => {
        const entry = getModuleEntry(cfg, m.id);
        const checked = !!entry?.enabled;

        return (
          <label
            key={m.id}
            className="flex items-start justify-between rounded-lg border border-gray-200 p-4"
          >
            <div className="pr-4">
              <div className="text-sm font-medium text-gray-900">{m.label}</div>
              {m.description ? (
                <div className="mt-1 text-sm text-gray-600">{m.description}</div>
              ) : null}
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300"
              checked={checked}
              onChange={(e) => toggleModule(m.id, e.target.checked)}
              disabled={!!busy}
            />
          </label>
        );
      })}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
```


## src\modules\Settings\index.jsx

```jsx
import Subheader from "@/components/layout/Subheader.jsx";
import ModulesManager from "./components/ModulesManager.jsx";

export default function Settings() {
  return (
    <div className="h-full">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-600">
            Active ou désactive les modules disponibles.
          </p>
        </div>

        <ModulesManager />
      </div>
    </div>
  );
}
```


## src\modules\Homepage.jsx

```jsx
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-full">
      <Subheader />

      <div className="flex-1 pt-4 bg-white"><div className="ml-5">Vide pour le moment</div></div>
    </div>
  );
}

import Subheader from "../components/layout/Subheader";
```


## src\pages\ChangePassword.jsx

```jsx
import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useMainKey } from "../hooks/useMainKey";
import {
  deriveKeyArgon2,
  encryptAESGCM,
  decryptAESGCM,
} from "../services/webcrypto";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { setMainKey } = useMainKey();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== newPasswordConfirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (!pb.authStore.isValid) {
      setError("Vous devez être connecté·e.");
      return;
    }

    try {
      const user = pb.authStore.model;
      const encryptedKey = JSON.parse(user.encrypted_key);
      const salt = user.encryption_salt;

      // Dérive la clé brute depuis l'ancien mot de passe
      const oldProtectionKey = await deriveKeyArgon2(oldPassword, salt);

      // Importe la clé brute en CryptoKey WebCrypto pour déchiffrement
      const oldCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        oldProtectionKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // Déchiffre la clé principale avec l'ancienne clé
      let decryptedMainKey;
      try {
        decryptedMainKey = await decryptAESGCM(encryptedKey, oldCryptoKey);
      } catch (err) {
        setError("Ancien mot de passe incorrect.");
        return;
      }

      // Dérive la clé brute depuis le nouveau mot de passe
      const newProtectionKey = await deriveKeyArgon2(newPassword, salt);

      // Importe la nouvelle clé brute en CryptoKey WebCrypto pour chiffrement
      const newCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        newProtectionKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      // Rechiffre la clé principale avec la nouvelle clé
      const newEncryptedKey = JSON.stringify(
        await encryptAESGCM(decryptedMainKey, newCryptoKey)
      );

      // Mets à jour PocketBase
      await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword,
      });

      setMainKey(decryptedMainKey);
      setSuccess("Mot de passe changé avec succès.");
      // Optionnel : rediriger après succès
      // navigate("/journal");
    } catch (err) {
      setError(
        "Erreur lors du changement de mot de passe : " + (err.message || err)
      );
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <h1 className="text-2xl font-bold mb-6">Changer de mot de passe</h1>

          <input
            type="password"
            placeholder="Ancien mot de passe"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Confirmez le nouveau mot de passe"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            className="w-full mb-6 p-3 border rounded"
            required
          />

          {error && (
            <div className="text-red-500 mb-4 w-full text-center">{error}</div>
          )}
          {success && (
            <div className="text-green-600 mb-4 w-full text-center">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
          >
            Valider
          </button>
        </form>
      </div>
    </div>
  );
}
```


## src\pages\Login.jsx

```jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreProvider";
import { setTab } from "@/store/actions";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { deriveKeyArgon2 } from "@/services/webcrypto";
import Logo from "../components/common/LogoLong.jsx";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import FormError from "../components/common/FormError";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setMainKey } = useMainKey();
  const navigate = useNavigate();
  const store = useStore();
  const dispatch = store?.dispatch ?? store?.[1];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // 1) Auth PocketBase
      await pb.collection("users").authWithPassword(email, password);

      // 2) Récupération du user et du salt (mêmes champs qu'avant)
      const user = pb.authStore.model;
      const salt =
        user?.encryption_salt ?? user?.profile?.salt ?? user?.salt ?? "";

      if (!salt) {
        setError("Aucun 'salt' sur le profil utilisateur.");
        return;
      }

      // 3) Dérivation Argon2id -> Uint8Array(32)
      const mainKeyBytes = await deriveKeyArgon2(password, salt);

      // 4) Place la clé brute (32 octets) dans le contexte (mémoire uniquement)
      setMainKey(mainKeyBytes);

      // 5) Navigate
      dispatch(setTab("home"));
      navigate("/", { replace: true });
    } catch (err) {
      setError("Identifiants invalides");
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <Logo className="mx-auto mb-3 w-1/2" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
          />
          <Button type="submit">Se connecter</Button>
          {error && <FormError message={error} />}
        </form>
        <div className="mt-6 text-center w-full">
          <span className="text-gray-600">Pas de compte ?</span>{" "}
          <a
            href="/register"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            Créer un compte
          </a>
        </div>
      </div>
    </div>
  );
}
```


## src\pages\NotFound.jsx

```jsx
export default function NotFound() {
  return (
    <div>
      <h1>Not found</h1>
    </div>
  );
}
```


## src\pages\Register.jsx

```jsx
import React, { useState } from "react";
import { deriveKeyArgon2, encryptAESGCM } from "@/services/webcrypto";
import pb from "@/services/pocketbase";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import FormFeedback from "../components/common/FormError";

// Utils base64 <-> Uint8Array (sans changer tes styles)
function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
}
function fromB64(b64) {
  return new Uint8Array(
    atob(b64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    // 1) Vérification du code d'invitation
    try {
      const codeResult = await pb.collection("invites_codes").getFullList({
        filter: `code="${inviteCode}"`,
      });
      if (!codeResult.length) {
        setError("Code d’invitation invalide ou déjà utilisé");
        return;
      }
    } catch (err) {
      setError("Erreur lors de la vérification du code");
      return;
    }

    // 2) Création du compte (nouvelle logique crypto alignée)
    try {
      // (a) Génère la clé principale (Uint8Array(32))
      const mainKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));

      // (b) Génère le salt (Uint8Array(16)) et encode en base64 pour la DB
      const saltRaw = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = toB64(saltRaw);

      // (c) Dérive la clé de protection (Uint8Array(32)) depuis password+salt
      const protectionKeyBytes32 = await deriveKeyArgon2(password, saltB64); // retourne Uint8Array(32)

      // (d) Chiffre la clé principale brute avec AES-GCM en passant la clé dérivée **bytes**
      const encrypted = await encryptAESGCM(mainKeyRaw, protectionKeyBytes32); // {iv: Uint8Array, data: Uint8Array}

      // (e) Prépare l'objet {iv, data} encodé en base64 pour stockage texte
      const encryptedForDB = JSON.stringify({
        iv: toB64(encrypted.iv),
        data: toB64(encrypted.data),
      });

      // (f) Envoi au backend : encrypted_key non vide + salt
      const userObj = {
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key: encryptedForDB, // texte JSON {iv,data} (base64)
        encryption_salt: saltB64, // texte base64
      };

      await pb.collection("users").create(userObj);

      // 3) Suppression du code d’invitation après usage (comme avant)
      try {
        const codeRecord = await pb
          .collection("invites_codes")
          .getFirstListItem(`code="${inviteCode}"`);
        if (codeRecord && codeRecord.id) {
          await pb.collection("invites_codes").delete(codeRecord.id);
        }
      } catch (_) {
        console.warn("Erreur suppression code invitation");
      }

      setSuccess("Utilisateur créé avec succès");
      setUsername("");
      setInviteCode("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      console.error("[Register] create error:", err);
      setError("Erreur lors de la création du compte");
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <h1 className="text-2xl font-bold mb-6 text-center w-full">
            Créer un compte
          </h1>
          <Input
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            placeholder="Code d’invitation"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            className="mb-2"
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-2"
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Confirme le mot de passe"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            className="mb-2"
          />
          <FormFeedback message={error} type="error" className="mb-4 w-full" />
          <FormFeedback
            message={success}
            type="success"
            className="mb-4 w-full"
          />

          <Button type="submit" className="w-full">
            Créer le compte
          </Button>
        </form>
        <div className="mt-6 text-center w-full">
          <span className="text-gray-600">Déjà un compte ?</span>{" "}
          <a
            href="/login"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            Se connecter
          </a>
        </div>
      </div>
    </div>
  );
}
```


## src\services\crypto-utils.js

```js
// crypto-utils.js
// -------------------------------------------------------------
// Petit toolkit côté client, basé sur WebCrypto, pour :
//   - encodage base64url
//   - génération aléatoire sécurisée
//   - hash (SHA-256) et HMAC
//   - IDs et secrets conformes à ton schéma PocketBase
//
// Fonctions exposées :
//   - toBase64url(bytes), fromBase64url(str)
//   - textToBytes(str), bytesToText(u8)
//   - randomBytes(n), randomSecret(n)
//   - hashPayload(input)          -> base64url
//   - hmac(secretBytes, message)  -> base64url
//   - generateModuleUserId(prefix='g_') -> "g_" + [a-z0-9_-]{16,}
//   - makeGuard() -> "g_" + 32 hex (pattern ^g_[a-z0-9]{32,}$)
// -------------------------------------------------------------

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  throw new Error(
    "WebCrypto indisponible : crypto.subtle est requis côté client."
  );
}

const te = new TextEncoder();
const td = new TextDecoder();

/** ---------------- Encodage ---------------- **/

export function toBase64url(bytes) {
  // bytes -> base64url (sans =) ; OK pour URL et patterns PB.
  let s = btoa(String.fromCharCode(...bytes));
  s = s.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return s;
}

export function fromBase64url(s) {
  // base64url -> bytes
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

export const textToBytes = (s) => te.encode(s);
export const bytesToText = (u8) => td.decode(u8);

/** ---------------- Aléa sécurisé ---------------- **/

export function randomBytes(n = 32) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// alias pratique pour nommage “secret”
export const randomSecret = (n = 32) => randomBytes(n);

/** ---------------- Hash & HMAC (base64url) ---------------- **/

export async function hashPayload(input) {
  // input: string | Uint8Array | objet JSON
  const bytes =
    input instanceof Uint8Array
      ? input
      : typeof input === "string"
      ? te.encode(input)
      : te.encode(JSON.stringify(input));

  const digest = await subtle.digest("SHA-256", bytes);
  return toBase64url(new Uint8Array(digest));
}

export async function hmac(secretBytes, message, algo = "SHA-256") {
  // secretBytes: Uint8Array ; message: string | Uint8Array
  const key = await subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: algo },
    false,
    ["sign"]
  );
  const msg = message instanceof Uint8Array ? message : te.encode(message);
  const sig = await subtle.sign("HMAC", key, msg);
  return toBase64url(new Uint8Array(sig));
}

/** ---------------- IDs & tokens conformes au schéma PB ---------------- **/

export function generateModuleUserId(prefix = "g_") {
  // Schéma PB : ^[a-z0-9_\\-]{16,}$
  // 12 octets -> 16 chars base64url ; on force en minuscules pour matcher le pattern.
  const raw = randomBytes(12);
  const id = toBase64url(raw).toLowerCase(); // [a-z0-9_-], pas de '='
  return prefix ? prefix + id : id; // ex: "g_manctvf3kzv-tn72"
}

export function bytesToHex(u8) {
  return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeGuard() {
  // Schéma PB : ^g_[a-z0-9]{32,}$
  // 16 octets -> 32 hex ; préfixe "g_"
  return "g_" + bytesToHex(randomBytes(16));
}
```


## src\services\crypto.js

```js
// crypto.js
// -------------------------------------------------------------
// Fonctions utilitaires autour du chiffrement symétrique (AES-GCM).
// Sert à sceller/dé-sceller des objets (seal/open) avec une clé binaire.
// Contient encore PBKDF2 (legacy, uniquement pour compatibilité).
// Pour toute nouvelle dérivation de clé, utiliser webcrypto.js (Argon2id).
// -------------------------------------------------------------

import CryptoJS from "crypto-js";

/** ---------------- Random helpers (crypto-safe) ---------------- **/

export function randomBytes(len = 32) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

export function generateRandomKey(len = 32) {
  return randomBytes(len);
}

export function generateSalt(len = 16) {
  return randomBytes(len);
}

/** ---------------- Legacy PBKDF2 (déprécié) ---------------- **/

// ⚠️ Ne pas utiliser pour les nouveaux flux, préférer deriveKeyArgon2 de webcrypto.js
export function deriveProtectionKey(
  password,
  salt,
  iterations = 100000,
  keySize = 256
) {
  return CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
    keySize: keySize / 32,
    iterations,
  }).toString(CryptoJS.enc.Hex);
}

/** ---------------- AES helpers ---------------- **/

export async function seal(data, key) {
  const iv = randomBytes(12);
  const algo = { name: "AES-GCM", iv };
  const cryptoKey = await crypto.subtle.importKey("raw", key, algo, false, [
    "encrypt",
  ]);

  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt(algo, cryptoKey, encoded);

  return {
    cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function open({ cipher, iv }, key) {
  const algo = {
    name: "AES-GCM",
    iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)),
  };
  const cryptoKey = await crypto.subtle.importKey("raw", key, algo, false, [
    "decrypt",
  ]);

  const cipherBytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt(algo, cryptoKey, cipherBytes);

  return JSON.parse(new TextDecoder().decode(plainBuf));
}
```


## src\services\guards.js

```js
// Stocke les guards par collection et par record.id en localStorage.
// Minimal, sans dépendance ni refacto.

const KEY = "nodea.guards.v1";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function setEntryGuard(collection, id, guard) {
  if (!collection || !id || !guard) return;
  const all = loadAll();
  all[collection] = all[collection] || {};
  all[collection][id] = guard;
  saveAll(all);
}

export function getEntryGuard(collection, id) {
  const all = loadAll();
  return all?.[collection]?.[id] || "";
}

export function deleteEntryGuard(collection, id) {
  const all = loadAll();
  if (all?.[collection]?.[id]) {
    delete all[collection][id];
    saveAll(all);
  }
}
```


## src\services\modules-config.js

```js
// modules-config.js
// -------------------------------------------------------------
// Lecture / écriture de la config chiffrée des modules dans users.modules.
// La clé binaire (mainKey) vient de ton hook / logique existante.
// On ne change PAS ton style, ni tes composants : juste la logique.
//
// Schéma stocké (exemple):
// {
//   mood:  { enabled: true,  module_user_id: "g_xxx", guard: "g_...", algo: "v1" },
//   goals: { enabled: false, module_user_id: null,     guard: null,  algo: "v1" },
// }
// -------------------------------------------------------------

import { seal, open } from "@/services/crypto"; // tes fonctions existantes AES-GCM

// charge, déchiffre, retourne un objet JS
export async function loadModulesConfig(pb, userId, mainKey) {
  // 1) lire user
  const user = await pb.collection("users").getOne(userId);
  const raw = user.modules || null;
  if (!raw) return {}; // pas encore de config

  // raw = string JSON chiffré { cipher, iv }
  try {
    const parsed = JSON.parse(raw);
    return await open(parsed, mainKey); // => objet
  } catch {
    // si jamais l’ancien format ou vide
    return {};
  }
}

// prend un objet JS, chiffre et sauvegarde
export async function saveModulesConfig(pb, userId, mainKey, obj) {
  const sealed = await seal(obj, mainKey); // => { cipher, iv }
  const payload = JSON.stringify(sealed);
  await pb.collection("users").update(userId, { modules: payload });
}

// helpers pour lire/écrire une entrée module
export function getModuleEntry(cfg, moduleId) {
  return (cfg && cfg[moduleId]) || null;
}

export function setModuleEntry(cfg, moduleId, entry) {
  const next = { ...(cfg || {}) };
  next[moduleId] = entry;
  return next;
}
```


## src\services\moodEntries.js

```js
// src/services/moodEntries.js
import pb from "@/services/pocketbase";
import { encryptAESGCM } from "@/services/webcrypto";

/* ------------------------- Helpers HMAC (local) ------------------------- */

const te = new TextEncoder();

function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacSha256(keyRaw, messageUtf8) {
  // keyRaw: ArrayBuffer|Uint8Array (clé brute, pas CryptoKey)
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}

async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard    = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  return "g_" + toHex(tag);
}

/* ------------------------------ CREATE (2 temps, HMAC) ------------------------------ */
/**
 * Crée une entrée Mood (chiffre le payload, POST "init", puis PATCH de promotion HMAC).
 *
 * @param {object} params
 * @param {import('pocketbase').default} [params.pb] - client PB optionnel (par défaut on utilise l'import global)
 * @param {string} params.moduleUserId
 * @param {CryptoKey|Uint8Array|ArrayBuffer} params.mainKey - clé utilisateur (brute préférable pour le HMAC)
 * @param {object} params.payload - objet clair (date, mood_score, etc.)
 * @returns {Promise<object>} l'objet créé retourné par le POST (avec id, created, ...)
 */
export async function createMoodEntry({
  pb: pbOverride,
  moduleUserId,
  mainKey,
  payload,
}) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!mainKey) throw new Error("mainKey manquante");

  const client = pbOverride || pb;

  // 1) Prépare la clé AES-GCM pour chiffrer le payload
  let aesKey = mainKey;
  if (!(aesKey instanceof CryptoKey)) {
    aesKey = await window.crypto.subtle.importKey(
      "raw",
      mainKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
  }

  // 2) Chiffre le payload
  const plaintext = JSON.stringify(payload || {});
  const { iv, data } = await encryptAESGCM(plaintext, aesKey);

  // 3) CREATE (étape A) : POST avec guard="init" (copié par le hook dans le champ hidden)
  const created = await client.send("/api/collections/mood_entries/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_user_id: String(moduleUserId),
      payload: String(data),
      cipher_iv: String(iv),
      guard: "init",
    }),
  });

  if (!created?.id) {
    throw new Error("Création incomplète (id manquant).");
  }

  // 4) Promotion (étape B) : calcule le guard HMAC et PATCH ?d=init
  //    ⚠️ Pour le HMAC il faut la clé brute; si mainKey est un CryptoKey non-extractible -> impossible.
  if (mainKey instanceof CryptoKey) {
    throw new Error(
      "MainKey fournie comme CryptoKey non exploitable pour HMAC. Fournis la clé brute (Uint8Array)."
    );
  }

  const guard = await deriveGuard(mainKey, moduleUserId, created.id);

  await client.send(
    `/api/collections/mood_entries/records/${encodeURIComponent(
      created.id
    )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guard }),
    }
  );

  return created; // id/created/...
}

/* ----------------------------------- LIST ----------------------------------- */
/** Liste les entrées Mood pour un module_user_id (les plus récentes d’abord). */
export async function listMoodEntries(moduleUserId) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  const url =
    `/api/collections/mood_entries/records` +
    `?sid=${encodeURIComponent(moduleUserId)}` +
    `&sort=-created`;
  const res = await pb.send(url, { method: "GET" });
  return Array.isArray(res?.items) ? res.items : [];
}

/* ---------------------------------- DELETE ---------------------------------- */
/**
 * Supprime une entrée par id en fournissant la preuve HMAC (guard).
 * Le guard doit être dérivé côté client (cf. deriveGuard) ou fournis en paramètre.
 */
export async function deleteMoodEntry(id, moduleUserId, guard) {
  if (!id) throw new Error("id manquant");
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!guard) throw new Error("guard manquant");

  const url =
    `/api/collections/mood_entries/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(moduleUserId)}` +
    `&d=${encodeURIComponent(guard)}`;

  return pb.send(url, { method: "DELETE" });
}

/* (optionnel) Si tu veux exposer le dérivé pour d'autres appels (ex. delete à la volée) */
export { deriveGuard };
```


## src\services\pocketbase.js

```js
import PocketBase from "pocketbase";
const baseUrl = import.meta.env.VITE_PB_URL;
const pb = new PocketBase(baseUrl);

export default pb;
```


## src\services\webcrypto.js

```js
// src/services/webcrypto.js
import Argon2 from "argon2-wasm";

/**
 * Dérive 32 octets (Uint8Array) via Argon2id à partir d'un mot de passe + salt.
 * Accepte un salt en base64, utf8, ou Uint8Array.
 */
export async function deriveKeyArgon2(password, salt) {
  let saltBytes;
  if (typeof salt === "string") {
    // essaie base64, sinon utf8
    try {
      saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    } catch {
      saltBytes = new TextEncoder().encode(salt);
    }
  } else {
    saltBytes = salt;
  }

  await Argon2.ready;
  const { hash } = await Argon2.hash({
    pass: password,
    salt: saltBytes,
    type: "Argon2id", // lib attend la string "Argon2id"
    hashLen: 32, // 256 bits pour AES-256
    time: 3,
    mem: 64 * 1024, // 64 MB
    parallelism: 1,
    raw: true,
  });

  return new Uint8Array(hash);
}

/** Importe 32 octets "raw" en CryptoKey AES-GCM 256 (non extractable). */
export function importAesKeyFromBytes(bytes32) {
  return window.crypto.subtle.importKey(
    "raw",
    bytes32,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Petits helpers base64 <-> ArrayBuffer/bytes */
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToArrayBuffer(base64) {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
export function bytesToBase64(u8) {
  return btoa(String.fromCharCode(...u8));
}
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Normalise une clé fournie: CryptoKey ou Uint8Array -> CryptoKey */
async function ensureCryptoKey(keyOrBytes) {
  if (
    keyOrBytes &&
    typeof keyOrBytes === "object" &&
    keyOrBytes.type === "secret"
  ) {
    // déjà une CryptoKey
    return keyOrBytes;
  }
  // sinon on considère que c'est un Uint8Array de 32 octets
  return importAesKeyFromBytes(keyOrBytes);
}

/**
 * Chiffre une chaîne en AES-GCM.
 * @param {string} plaintext - texte clair (UTF-8)
 * @param {CryptoKey|Uint8Array} keyOrBytes - CryptoKey AES-GCM OU 32 octets "raw"
 * @returns {{iv:string, data:string}} base64
 */
export async function encryptAESGCM(plaintext, keyOrBytes) {
  const key = await ensureCryptoKey(keyOrBytes);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Déchiffre un objet {iv,data} (base64) en texte clair (UTF-8).
 * @param {{iv:string, data:string}} encrypted
 * @param {CryptoKey|Uint8Array} keyOrBytes - CryptoKey AES-GCM OU 32 octets "raw"
 * @returns {Promise<string>}
 */
export async function decryptAESGCM(encrypted, keyOrBytes) {
  const key = await ensureCryptoKey(keyOrBytes);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const data = base64ToArrayBuffer(encrypted.data);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(plaintextBuffer);
}

/** Génère des octets aléatoires (utile pour clé principale & salt). */
export function randomBytes(length) {
  const u8 = new Uint8Array(length);
  window.crypto.getRandomValues(u8);
  return u8;
}
```


## src\store\actions.js

```js
import { types } from "./reducer";

/**
 * Définit l'onglet actif (ex: "home", "journal", "settings", etc.)
 * @param {string} id - L'identifiant de l'onglet à afficher.
 */
export const setTab = (id) => ({
  type: types.NAV_SET_TAB,
  payload: id,
});

/*** Ouvre le menu latéral en mode mobile. */
export const openMobile = () => ({
  type: types.UI_OPEN_MOBILE,
});

/*** Ferme le menu latéral en mode mobile. */
export const closeMobile = () => ({
  type: types.UI_CLOSE_MOBILE,
});

/*** Bascule l'état du menu latéral en mode mobile (ouvert <-> fermé). */
export const toggleMobile = () => ({
  type: types.UI_TOGGLE_MOBILE,
});

/*** Change le thème visuel de l'application.
 * @param {string} theme - Nom du thème à appliquer (ex: "light", "dark").
 */
export const setTheme = (theme) => ({
  type: types.UI_SET_THEME,
  payload: theme,
});

/**
 * Sauvegarde temporairement un brouillon de journal.
 * Utilisé avant soumission, pour éviter la perte de contenu.
 * @param {object} draft - Contenu du brouillon.
 */
export const setJournalDraft = (draft) => ({
  type: types.JOURNAL_SET_DRAFT,
  payload: draft,
});

/**
 * Efface le brouillon de journal actuellement sauvegardé.
 */
export const clearJournalDraft = () => ({
  type: types.JOURNAL_CLEAR_DRAFT,
});

/**
 * Ajoute une notification (toast) à l'écran.
 * @param {object} toast - Objet contenant { id, type, message }.
 *   - id {string} : identifiant unique
 *   - type {string} : ex. "success", "error", "info"
 *   - message {string} : texte affiché
 */
export const pushToast = (toast) => ({
  type: types.TOAST_PUSH,
  payload: toast,
});

/**
 * Supprime une notification (toast) par son identifiant.
 * @param {string} id - Identifiant du toast à retirer.
 */
export const dismissToast = (id) => ({
  type: types.TOAST_DISMISS,
  payload: id,
});
```


## src\store\modulesRuntime.js

```js
// src/store/modulesRuntime.js
import { useEffect, useSyncExternalStore } from "react";

/**
 * State = objet déchiffré des modules, ex:
 * {
 *   mood: { enabled: true, module_user_id: "...", delete_secret: "...", algo: "v1" },
 *   goals: { enabled: false, ... }
 * }
 */
let _state = {};
const _listeners = new Set();

function emit() {
  for (const cb of _listeners) cb();
}

export function getModulesState() {
  return _state;
}

export function setModulesState(next) {
  _state = next || {};
  emit();
}

export function updateSingleModule(moduleId, partial) {
  _state = {
    ..._state,
    [moduleId]: { ...(_state[moduleId] || {}), ...partial },
  };
  emit();
}

export function subscribe(callback) {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}

/**
 * Hook de lecture réactive de l’état runtime des modules.
 */
export function useModulesRuntime() {
  const snapshot = () => _state;
  const getServerSnapshot = () => _state;
  return useSyncExternalStore(subscribe, snapshot, getServerSnapshot);
}

/**
 * Helpers de lecture
 */
export function isModuleEnabled(state, moduleId) {
  return !!state?.[moduleId]?.enabled;
}

export function enabledModules(state) {
  return Object.entries(state || {})
    .filter(([, v]) => !!v?.enabled)
    .map(([k]) => k);
}
```


## src\store\reducer.js

```js
// ------------------------
// ÉTAT INITIAL
// ------------------------
// C'est la forme par défaut du store global.
// Chaque clé est un "sous-état" géré par le reducer.
export const initialState = {
  nav: {
    // Onglet actif dans l'application
    // Utilisé pour savoir quel composant afficher dans <Layout>
    currentTab: "home",
  },
  ui: {
    // true = le menu latéral mobile est ouvert
    // false = il est fermé
    mobileOpen: false,

    // Thème d'affichage : "light", "dark" ou "system"
    theme: "system",
  },
  journal: {
    // Brouillon de saisie du journal (Mood journal)
    // Peut contenir un objet avec mood, emoji, texte, etc.
    draft: null,

    // Filtres appliqués sur l’historique du journal
    // month/year sont null si aucun filtre actif
    filters: { month: null, year: null },
  },
  // Liste des notifications toast à afficher.
  // Chaque toast a { id, type: 'success'|'error', message }
  notifications: [],
};

// ------------------------
// TYPES D’ACTIONS
// ------------------------
// Chaque type correspond à une modification précise du store.
// Le nom est en "namespace/action" pour éviter les collisions.
export const types = {
  NAV_SET_TAB: "nav/setTab", // Changer l’onglet actif
  UI_OPEN_MOBILE: "ui/openMobile", // Ouvrir le menu mobile
  UI_CLOSE_MOBILE: "ui/closeMobile", // Fermer le menu mobile
  UI_TOGGLE_MOBILE: "ui/toggleMobile", // Basculer l’état du menu mobile
  UI_SET_THEME: "ui/setTheme", // Changer le thème
  JOURNAL_SET_DRAFT: "journal/setDraft", // Sauvegarder un brouillon
  JOURNAL_CLEAR_DRAFT: "journal/clearDraft", // Supprimer le brouillon
  TOAST_PUSH: "toast/push", // Ajouter un toast
  TOAST_DISMISS: "toast/dismiss", // Retirer un toast
};

// ------------------------
// REDUCER PRINCIPAL
// ------------------------
// Cette fonction reçoit :
// - l’état actuel (`state`)
// - une action { type, payload }
// et renvoie un nouvel état modifié sans toucher à l’original.
// Chaque `case` gère un type d’action.
export function reducer(state, action) {
  switch (action.type) {
    // NAVIGATION -------------------------
    case types.NAV_SET_TAB:
      // Met à jour l’onglet courant
      return { ...state, nav: { ...state.nav, currentTab: action.payload } };

    // UI : MENU MOBILE --------------------
    case types.UI_OPEN_MOBILE:
      // Force l'ouverture
      return { ...state, ui: { ...state.ui, mobileOpen: true } };
    case types.UI_CLOSE_MOBILE:
      // Force la fermeture
      return { ...state, ui: { ...state.ui, mobileOpen: false } };
    case types.UI_TOGGLE_MOBILE:
      // Inverse l’état actuel (ouvert/fermé)
      return {
        ...state,
        ui: { ...state.ui, mobileOpen: !state.ui.mobileOpen },
      };

    // UI : THÈME --------------------------
    case types.UI_SET_THEME:
      // Définit explicitement le thème
      return { ...state, ui: { ...state.ui, theme: action.payload } };

    // JOURNAL -----------------------------
    case types.JOURNAL_SET_DRAFT:
      // Sauvegarde un brouillon de journal
      return { ...state, journal: { ...state.journal, draft: action.payload } };
    case types.JOURNAL_CLEAR_DRAFT:
      // Efface le brouillon
      return { ...state, journal: { ...state.journal, draft: null } };

    // NOTIFICATIONS (TOASTS) ---------------
    case types.TOAST_PUSH:
      // Ajoute un toast à la liste
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case types.TOAST_DISMISS:
      // Supprime un toast en filtrant par id
      return {
        ...state,
        notifications: state.notifications.filter(
          (t) => t.id !== action.payload
        ),
      };

    // PAR DÉFAUT ---------------------------
    default:
      // Si l’action n’est pas reconnue, on ne change rien
      return state;
  }
}
```


## src\store\selectors.js

```js
// ------------------------
// SELECTORS
// ------------------------
// Les "selectors" sont des petites fonctions
// qui extraient une donnée précise du store global.
// Elles évitent de dupliquer la logique d'accès au state
// dans les composants.

// Onglet courant (id de l'onglet actif dans la navigation)
export const selectCurrentTab = (state) => state.nav.currentTab;

// État d'ouverture du menu mobile (true = ouvert, false = fermé)
export const selectMobileOpen = (state) => state.ui.mobileOpen;

// Thème actuel ("light", "dark", ou "system")
export const selectTheme = (state) => state.ui.theme;

// Brouillon actuel du journal (Mood journal)
export const selectJournalDraft = (state) => state.journal.draft;

// Liste complète des notifications toast en attente d'affichage
export const selectToasts = (state) => state.notifications;
```


## src\store\StoreProvider.jsx

```jsx
import { createContext, useContext, useMemo, useReducer } from "react";
import { reducer, initialState } from "./reducer";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
```


## src\theme\global.css

```css
/* global.css (ou équivalent) */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
```


## src\theme\index.css

```css
@import "tailwindcss";
@import "./theme.css";
@import "./global.css"
```


## src\theme\theme.css

```css
@theme {
  /* Principal, highlights, logo, boutons */
  --color-nodea-sage-lighter: #d7e7df;
  --color-nodea-sage-light: #bcd7c9;
  --color-nodea-sage: #90b6a2;
  --color-nodea-sage-dark: #587568;
  --color-nodea-sage-darker: #3e5448;

  /* Fond principal, background, cartes */
  --color-nodea-sand-lighter: #ffffff;
  /* déjà au max (identique à -light) */
  --color-nodea-sand-light: #ffffff;
  --color-nodea-sand: #f7f4ef;
  --color-nodea-sand-dark: #e5ded5;
  --color-nodea-sand-darker: #d1c7bb;

  /* Accent, secondary bg, notifications */
  --color-nodea-lavender-lighter: #f6eefb;
  --color-nodea-lavender-light: #eee3f5;
  --color-nodea-lavender: #d8c7e4;
  --color-nodea-lavender-dark: #9f8db0;
  --color-nodea-lavender-darker: #7f6c97;

  /* Accent, alertes, tags, hover */
  --color-nodea-blush-lighter: #fcf4f4;
  --color-nodea-blush-light: #f8ecec;
  --color-nodea-blush: #f4d8d9;
  --color-nodea-blush-dark: #c98995;
  --color-nodea-blush-darker: #a56571;

  /* Liens, hover, graphes */
  --color-nodea-sky-lighter: #eaf8fc;
  --color-nodea-sky-light: #d0edf6;
  --color-nodea-sky: #a9d6e5;
  --color-nodea-sky-dark: #53899d;
  --color-nodea-sky-darker: #3f6b7a;

  /* Texte principal, titres */
  --color-nodea-slate-lighter: #a2a5a8;
  --color-nodea-slate-light: #7a7c7e;
  --color-nodea-slate: #2b2d2f;
  --color-nodea-slate-dark: #18191a;
  --color-nodea-slate-darker: #0c0d0d;
}
```


## src\App.jsx

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { StoreProvider } from "./store/StoreProvider"; // <—

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/flow" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="flow" element={<div />} /> {/* plus de <Content /> */}
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}

import Layout from "./components/layout/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
```


## src\main.jsx

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { MainKeyProvider } from "./hooks/useMainKey";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainKeyProvider>
      <App />
    </MainKeyProvider>
  </StrictMode>
);

import App from "./App.jsx";
```


## .env

```
VITE_PB_URL=https://api.nodea.app
```


## .env_example

```
VITE_PB_URL=<Adress of pocketbase>
```


## .gitignore

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
package-lock.json
.env
export.md
eslint.config.js
```


## eslint.config.js

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```


## export.md

File is too large to process (1460942 bytes)


## index.html

```html
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nodea</title>
</head>

<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>

</html>
```


## LICENSE

```
Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at https://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```


## package-lock.json

```json
{
  "name": "project_name",
  "version": "0.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "project_name",
      "version": "0.0.0",
      "dependencies": {
        "@headlessui/react": "^2.2.7",
        "@heroicons/react": "^2.2.0",
        "@tailwindcss/vite": "^4.1.11",
        "argon2-browser": "^1.18.0",
        "argon2-wasm": "^0.9.0",
        "boring-avatars": "^2.0.1",
        "chart.js": "^4.5.0",
        "classnames": "^2.5.1",
        "crypto-js": "^4.2.0",
        "dayjs": "^1.11.13",
        "emoji-picker-react": "^4.13.2",
        "hash-wasm": "^4.12.0",
        "heroicons": "^2.2.0",
        "pocketbase": "^0.26.2",
        "react": "^19.1.0",
        "react-chartjs-2": "^5.3.0",
        "react-dom": "^19.1.0",
        "react-router-dom": "^7.7.1",
        "recharts": "^3.1.0",
        "tailwindcss": "^4.1.11"
      },
      "devDependencies": {
        "@eslint/js": "^9.30.1",
        "@types/react": "^19.1.8",
        "@types/react-dom": "^19.1.6",
        "@vitejs/plugin-react": "^4.6.0",
        "concurrently": "^9.2.0",
        "eslint": "^9.30.1",
        "eslint-plugin-react-hooks": "^5.2.0",
        "eslint-plugin-react-refresh": "^0.4.20",
        "globals": "^16.3.0",
        "kill-port": "^2.0.1",
        "vite": "^7.0.4"
      }
    },
    "node_modules/@ampproject/remapping": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz",
      "integrity": "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.5",
        "@jridgewell/trace-mapping": "^0.3.24"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/code-frame": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.27.1.tgz",
      "integrity": "sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.27.1",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.28.0.tgz",
      "integrity": "sha512-60X7qkglvrap8mn1lh2ebxXdZYtUcpd7gsmy9kLaBJ4i/WdY8PqTSdxyA8qraikqKQK5C1KRBKXqznrVapyNaw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.0.tgz",
      "integrity": "sha512-UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@ampproject/remapping": "^2.2.0",
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.0",
        "@babel/helper-compilation-targets": "^7.27.2",
        "@babel/helper-module-transforms": "^7.27.3",
        "@babel/helpers": "^7.27.6",
        "@babel/parser": "^7.28.0",
        "@babel/template": "^7.27.2",
        "@babel/traverse": "^7.28.0",
        "@babel/types": "^7.28.0",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/babel"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.28.0.tgz",
      "integrity": "sha512-lJjzvrbEeWrhB4P3QBsH7tey117PjLZnDbLiQEKjQ/fNJTjuq4HSqgFA+UNSwZT8D7dxxbnuSBMsa1lrWzKlQg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.28.0",
        "@babel/types": "^7.28.0",
        "@jridgewell/gen-mapping": "^0.3.12",
        "@jridgewell/trace-mapping": "^0.3.28",
        "jsesc": "^3.0.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz",
      "integrity": "sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.27.2",
        "@babel/helper-validator-option": "^7.27.1",
        "browserslist": "^4.24.0",
        "lru-cache": "^5.1.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-globals": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.28.0.tgz",
      "integrity": "sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-imports": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz",
      "integrity": "sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.27.1",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-transforms": {
      "version": "7.27.3",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.27.3.tgz",
      "integrity": "sha512-dSOvYwvyLsWBeIRyOeHXp5vPj5l1I011r52FM1+r1jCERv+aFXYk4whgQccYEGYxK2H3ZAIA8nuPkQ0HaUo3qg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.27.1",
        "@babel/traverse": "^7.27.3"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-plugin-utils": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-plugin-utils/-/helper-plugin-utils-7.27.1.tgz",
      "integrity": "sha512-1gn1Up5YXka3YYAHGKpbideQ5Yjf1tDa9qYcgysz+cNCXukyLl6DjPXhD3VRwSb8c0J9tA4b2+rHEZtc6R0tlw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.27.1.tgz",
      "integrity": "sha512-D2hP9eA+Sqx1kBZgzxZh0y1trbuU+JoDkiEwqhQ36nodYqJwyEIhPSdMNd7lOm/4io72luTPWH20Yda0xOuUow==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-option": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.27.1.tgz",
      "integrity": "sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helpers": {
      "version": "7.28.2",
      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.28.2.tgz",
      "integrity": "sha512-/V9771t+EgXz62aCcyofnQhGM8DQACbRhvzKFsXKC9QM+5MadF8ZmIm0crDMaz3+o0h0zXfJnd4EhbYbxsrcFw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.28.0.tgz",
      "integrity": "sha512-jVZGvOxOuNSsuQuLRTh13nU0AogFlw32w/MT+LV6D3sP5WdbW61E77RnkbaO2dUvmPAYrBDJXGn5gGS6tH4j8g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.28.0"
      },
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-self": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-self/-/plugin-transform-react-jsx-self-7.27.1.tgz",
      "integrity": "sha512-6UzkCs+ejGdZ5mFFC/OCUrv028ab2fp1znZmCZjAOBKiBK2jXD1O+BPSfX8X2qjJ75fZBMSnQn3Rq2mrBJK2mw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-source": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-source/-/plugin-transform-react-jsx-source-7.27.1.tgz",
      "integrity": "sha512-zbwoTsBruTeKB9hSq73ha66iFeJHuaFkUbwvqElnygoNbj/jHRsSeokowZFN3CZ64IvEqcmmkVe89OPXc7ldAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/template": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.27.2.tgz",
      "integrity": "sha512-LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/parser": "^7.27.2",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/traverse": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.28.0.tgz",
      "integrity": "sha512-mGe7UK5wWyh0bKRfupsUchrQGqvDbZDbKJw+kcRGSmdHVYrv+ltd0pnpDTVpiTqnaBru9iEvA8pz8W46v0Amwg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.0",
        "@babel/helper-globals": "^7.28.0",
        "@babel/parser": "^7.28.0",
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.0",
        "debug": "^4.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.28.2",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.28.2.tgz",
      "integrity": "sha512-ruv7Ae4J5dUYULmeXw1gmb7rYRz57OWCPM57pHojnLq/3Z1CK2lNSLTCVjxVk1F/TZHwOZZrOWi0ur95BbLxNQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@esbuild/aix-ppc64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.25.8.tgz",
      "integrity": "sha512-urAvrUedIqEiFR3FYSLTWQgLu5tb+m0qZw0NBEasUeo6wuqatkMDaRT+1uABiGXEu5vqgPd7FGE1BhsAIy9QVA==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "aix"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.25.8.tgz",
      "integrity": "sha512-RONsAvGCz5oWyePVnLdZY/HHwA++nxYWIX1atInlaW6SEkwq6XkP3+cb825EUcRs5Vss/lGh/2YxAb5xqc07Uw==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.25.8.tgz",
      "integrity": "sha512-OD3p7LYzWpLhZEyATcTSJ67qB5D+20vbtr6vHlHWSQYhKtzUYrETuWThmzFpZtFsBIxRvhO07+UgVA9m0i/O1w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.25.8.tgz",
      "integrity": "sha512-yJAVPklM5+4+9dTeKwHOaA+LQkmrKFX96BM0A/2zQrbS6ENCmxc4OVoBs5dPkCCak2roAD+jKCdnmOqKszPkjA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.25.8.tgz",
      "integrity": "sha512-Jw0mxgIaYX6R8ODrdkLLPwBqHTtYHJSmzzd+QeytSugzQ0Vg4c5rDky5VgkoowbZQahCbsv1rT1KW72MPIkevw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.25.8.tgz",
      "integrity": "sha512-Vh2gLxxHnuoQ+GjPNvDSDRpoBCUzY4Pu0kBqMBDlK4fuWbKgGtmDIeEC081xi26PPjn+1tct+Bh8FjyLlw1Zlg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.25.8.tgz",
      "integrity": "sha512-YPJ7hDQ9DnNe5vxOm6jaie9QsTwcKedPvizTVlqWG9GBSq+BuyWEDazlGaDTC5NGU4QJd666V0yqCBL2oWKPfA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.25.8.tgz",
      "integrity": "sha512-MmaEXxQRdXNFsRN/KcIimLnSJrk2r5H8v+WVafRWz5xdSVmWLoITZQXcgehI2ZE6gioE6HirAEToM/RvFBeuhw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.25.8.tgz",
      "integrity": "sha512-FuzEP9BixzZohl1kLf76KEVOsxtIBFwCaLupVuk4eFVnOZfU+Wsn+x5Ryam7nILV2pkq2TqQM9EZPsOBuMC+kg==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.25.8.tgz",
      "integrity": "sha512-WIgg00ARWv/uYLU7lsuDK00d/hHSfES5BzdWAdAig1ioV5kaFNrtK8EqGcUBJhYqotlUByUKz5Qo6u8tt7iD/w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ia32": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.25.8.tgz",
      "integrity": "sha512-A1D9YzRX1i+1AJZuFFUMP1E9fMaYY+GnSQil9Tlw05utlE86EKTUA7RjwHDkEitmLYiFsRd9HwKBPEftNdBfjg==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-loong64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.25.8.tgz",
      "integrity": "sha512-O7k1J/dwHkY1RMVvglFHl1HzutGEFFZ3kNiDMSOyUrB7WcoHGf96Sh+64nTRT26l3GMbCW01Ekh/ThKM5iI7hQ==",
      "cpu": [
        "loong64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-mips64el": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.25.8.tgz",
      "integrity": "sha512-uv+dqfRazte3BzfMp8PAQXmdGHQt2oC/y2ovwpTteqrMx2lwaksiFZ/bdkXJC19ttTvNXBuWH53zy/aTj1FgGw==",
      "cpu": [
        "mips64el"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ppc64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.25.8.tgz",
      "integrity": "sha512-GyG0KcMi1GBavP5JgAkkstMGyMholMDybAf8wF5A70CALlDM2p/f7YFE7H92eDeH/VBtFJA5MT4nRPDGg4JuzQ==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-riscv64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.25.8.tgz",
      "integrity": "sha512-rAqDYFv3yzMrq7GIcen3XP7TUEG/4LK86LUPMIz6RT8A6pRIDn0sDcvjudVZBiiTcZCY9y2SgYX2lgK3AF+1eg==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-s390x": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.25.8.tgz",
      "integrity": "sha512-Xutvh6VjlbcHpsIIbwY8GVRbwoviWT19tFhgdA7DlenLGC/mbc3lBoVb7jxj9Z+eyGqvcnSyIltYUrkKzWqSvg==",
      "cpu": [
        "s390x"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.25.8.tgz",
      "integrity": "sha512-ASFQhgY4ElXh3nDcOMTkQero4b1lgubskNlhIfJrsH5OKZXDpUAKBlNS0Kx81jwOBp+HCeZqmoJuihTv57/jvQ==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.25.8.tgz",
      "integrity": "sha512-d1KfruIeohqAi6SA+gENMuObDbEjn22olAR7egqnkCD9DGBG0wsEARotkLgXDu6c4ncgWTZJtN5vcgxzWRMzcw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.25.8.tgz",
      "integrity": "sha512-nVDCkrvx2ua+XQNyfrujIG38+YGyuy2Ru9kKVNyh5jAys6n+l44tTtToqHjino2My8VAY6Lw9H7RI73XFi66Cg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.25.8.tgz",
      "integrity": "sha512-j8HgrDuSJFAujkivSMSfPQSAa5Fxbvk4rgNAS5i3K+r8s1X0p1uOO2Hl2xNsGFppOeHOLAVgYwDVlmxhq5h+SQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.25.8.tgz",
      "integrity": "sha512-1h8MUAwa0VhNCDp6Af0HToI2TJFAn1uqT9Al6DJVzdIBAd21m/G0Yfc77KDM3uF3T/YaOgQq3qTJHPbTOInaIQ==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openharmony-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.25.8.tgz",
      "integrity": "sha512-r2nVa5SIK9tSWd0kJd9HCffnDHKchTGikb//9c7HX+r+wHYCpQrSgxhlY6KWV1nFo1l4KFbsMlHk+L6fekLsUg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/sunos-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.25.8.tgz",
      "integrity": "sha512-zUlaP2S12YhQ2UzUfcCuMDHQFJyKABkAjvO5YSndMiIkMimPmxA+BYSBikWgsRpvyxuRnow4nS5NPnf9fpv41w==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.25.8.tgz",
      "integrity": "sha512-YEGFFWESlPva8hGL+zvj2z/SaK+pH0SwOM0Nc/d+rVnW7GSTFlLBGzZkuSU9kFIGIo8q9X3ucpZhu8PDN5A2sQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-ia32": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.25.8.tgz",
      "integrity": "sha512-hiGgGC6KZ5LZz58OL/+qVVoZiuZlUYlYHNAmczOm7bs2oE1XriPFi5ZHHrS8ACpV5EjySrnoCKmcbQMN+ojnHg==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.25.8.tgz",
      "integrity": "sha512-cn3Yr7+OaaZq1c+2pe+8yxC8E144SReCQjN6/2ynubzYjvyqZjTXfQJpAcQpsdJq3My7XADANiYGHoFC69pLQw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.7.0",
      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.7.0.tgz",
      "integrity": "sha512-dyybb3AcajC7uha6CvhdVRJqaKyn7w2YKqKyAN37NKYgZT36w+iRb0Dymmc5qEJ549c/S31cMMSFd75bteCpCw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz",
      "integrity": "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.1",
      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz",
      "integrity": "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/config-array": {
      "version": "0.21.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-array/-/config-array-0.21.0.tgz",
      "integrity": "sha512-ENIdc4iLu0d93HeYirvKmrzshzofPw6VkZRKQGe9Nv46ZnWUzcF1xV01dcvEg/1wXUR61OmmlSfyeyO7EvjLxQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/object-schema": "^2.1.6",
        "debug": "^4.3.1",
        "minimatch": "^3.1.2"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/config-helpers": {
      "version": "0.3.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-helpers/-/config-helpers-0.3.0.tgz",
      "integrity": "sha512-ViuymvFmcJi04qdZeDc2whTHryouGcDlaxPqarTD0ZE10ISpxGUVZGZDx4w01upyIynL3iu6IXH2bS1NhclQMw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/core": {
      "version": "0.15.1",
      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-0.15.1.tgz",
      "integrity": "sha512-bkOp+iumZCCbt1K1CmWf0R9pM5yKpDv+ZXtvSyQpudrI9kuFLp+bM2WOPXImuD/ceQuaa8f5pj93Y7zyECIGNA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@types/json-schema": "^7.0.15"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/eslintrc": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/@eslint/eslintrc/-/eslintrc-3.3.1.tgz",
      "integrity": "sha512-gtF186CXhIl1p4pJNGZw8Yc6RlshoePRvE0X91oPGb3vZ8pM3qOS9W9NGPat9LziaBV7XrJWGylNQXkGcnM3IQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ajv": "^6.12.4",
        "debug": "^4.3.2",
        "espree": "^10.0.1",
        "globals": "^14.0.0",
        "ignore": "^5.2.0",
        "import-fresh": "^3.2.1",
        "js-yaml": "^4.1.0",
        "minimatch": "^3.1.2",
        "strip-json-comments": "^3.1.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint/eslintrc/node_modules/globals": {
      "version": "14.0.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-14.0.0.tgz",
      "integrity": "sha512-oahGvuMGQlPw/ivIYBjVSrWAfWLBeku5tpPE2fOPLi+WHffIWbuh2tCjhyQhTBPMf5E9jDEH4FOmTYgYwbKwtQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@eslint/js": {
      "version": "9.32.0",
      "resolved": "https://registry.npmjs.org/@eslint/js/-/js-9.32.0.tgz",
      "integrity": "sha512-BBpRFZK3eX6uMLKz8WxFOBIFFcGFJ/g8XuwjTHCqHROSIsopI+ddn/d5Cfh36+7+e5edVS8dbSHnBNhrLEX0zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      }
    },
    "node_modules/@eslint/object-schema": {
      "version": "2.1.6",
      "resolved": "https://registry.npmjs.org/@eslint/object-schema/-/object-schema-2.1.6.tgz",
      "integrity": "sha512-RBMg5FRL0I0gs51M/guSAj5/e14VQ4tpZnQNWwuDT66P14I43ItmPfIZRhO9fUVIPOAQXU47atlywZ/czoqFPA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/plugin-kit": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.3.4.tgz",
      "integrity": "sha512-Ul5l+lHEcw3L5+k8POx6r74mxEYKG5kOb6Xpy2gCRW6zweT6TEhAf8vhxGgjhqrd/VO/Dirhsb+1hNpD1ue9hw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^0.15.1",
        "levn": "^0.4.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@floating-ui/core": {
      "version": "1.7.3",
      "resolved": "https://registry.npmjs.org/@floating-ui/core/-/core-1.7.3.tgz",
      "integrity": "sha512-sGnvb5dmrJaKEZ+LDIpguvdX3bDlEllmv4/ClQ9awcmCZrlx5jQyyMWFM5kBI+EyNOCDDiKk8il0zeuX3Zlg/w==",
      "license": "MIT",
      "dependencies": {
        "@floating-ui/utils": "^0.2.10"
      }
    },
    "node_modules/@floating-ui/dom": {
      "version": "1.7.3",
      "resolved": "https://registry.npmjs.org/@floating-ui/dom/-/dom-1.7.3.tgz",
      "integrity": "sha512-uZA413QEpNuhtb3/iIKoYMSK07keHPYeXF02Zhd6e213j+d1NamLix/mCLxBUDW/Gx52sPH2m+chlUsyaBs/Ag==",
      "license": "MIT",
      "dependencies": {
        "@floating-ui/core": "^1.7.3",
        "@floating-ui/utils": "^0.2.10"
      }
    },
    "node_modules/@floating-ui/react": {
      "version": "0.26.28",
      "resolved": "https://registry.npmjs.org/@floating-ui/react/-/react-0.26.28.tgz",
      "integrity": "sha512-yORQuuAtVpiRjpMhdc0wJj06b9JFjrYF4qp96j++v2NBpbi6SEGF7donUJ3TMieerQ6qVkAv1tgr7L4r5roTqw==",
      "license": "MIT",
      "dependencies": {
        "@floating-ui/react-dom": "^2.1.2",
        "@floating-ui/utils": "^0.2.8",
        "tabbable": "^6.0.0"
      },
      "peerDependencies": {
        "react": ">=16.8.0",
        "react-dom": ">=16.8.0"
      }
    },
    "node_modules/@floating-ui/react-dom": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@floating-ui/react-dom/-/react-dom-2.1.5.tgz",
      "integrity": "sha512-HDO/1/1oH9fjj4eLgegrlH3dklZpHtUYYFiVwMUwfGvk9jWDRWqkklA2/NFScknrcNSspbV868WjXORvreDX+Q==",
      "license": "MIT",
      "dependencies": {
        "@floating-ui/dom": "^1.7.3"
      },
      "peerDependencies": {
        "react": ">=16.8.0",
        "react-dom": ">=16.8.0"
      }
    },
    "node_modules/@floating-ui/utils": {
      "version": "0.2.10",
      "resolved": "https://registry.npmjs.org/@floating-ui/utils/-/utils-0.2.10.tgz",
      "integrity": "sha512-aGTxbpbg8/b5JfU1HXSrbH3wXZuLPJcNEcZQFMxLs3oSzgtVu6nFPkbbGGUvBcUjKV2YyB9Wxxabo+HEH9tcRQ==",
      "license": "MIT"
    },
    "node_modules/@headlessui/react": {
      "version": "2.2.7",
      "resolved": "https://registry.npmjs.org/@headlessui/react/-/react-2.2.7.tgz",
      "integrity": "sha512-WKdTymY8Y49H8/gUc/lIyYK1M+/6dq0Iywh4zTZVAaiTDprRfioxSgD0wnXTQTBpjpGJuTL1NO/mqEvc//5SSg==",
      "license": "MIT",
      "dependencies": {
        "@floating-ui/react": "^0.26.16",
        "@react-aria/focus": "^3.20.2",
        "@react-aria/interactions": "^3.25.0",
        "@tanstack/react-virtual": "^3.13.9",
        "use-sync-external-store": "^1.5.0"
      },
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "react": "^18 || ^19 || ^19.0.0-rc",
        "react-dom": "^18 || ^19 || ^19.0.0-rc"
      }
    },
    "node_modules/@heroicons/react": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/@heroicons/react/-/react-2.2.0.tgz",
      "integrity": "sha512-LMcepvRaS9LYHJGsF0zzmgKCUim/X3N/DQKc4jepAXJ7l8QxJ1PmxJzqplF2Z3FE4PqBAIGyJAQ/w4B5dsqbtQ==",
      "license": "MIT",
      "peerDependencies": {
        "react": ">= 16 || ^19.0.0-rc"
      }
    },
    "node_modules/@humanfs/core": {
      "version": "0.19.1",
      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.1.tgz",
      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node": {
      "version": "0.16.6",
      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.6.tgz",
      "integrity": "sha512-YuI2ZHQL78Q5HbhDiBA1X4LmYdXCKCMQIfw0pw7piHJwyREFebJUvrQN4cMssyES6x+vfUbx1CIpaQUKYdQZOw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/core": "^0.19.1",
        "@humanwhocodes/retry": "^0.3.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node/node_modules/@humanwhocodes/retry": {
      "version": "0.3.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.3.1.tgz",
      "integrity": "sha512-JBxkERygn7Bv/GbN5Rv8Ul6LVknS+5Bp6RgDC/O8gEBU/yeH5Ui5C/OlWrTb6qct7LjjfT6Re2NxB0ln0yYybA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
      "integrity": "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/retry": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.4.3.tgz",
      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@isaacs/fs-minipass": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
      "integrity": "sha512-wgm9Ehl2jpeqP3zw/7mo3kRHFp5MEDhqAdwy1fTGkHAwnkGOVsgpvQhL8B5n1qlb01jV3n/bI0ZfZp5lWA1k4w==",
      "license": "ISC",
      "dependencies": {
        "minipass": "^7.0.4"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.12",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.12.tgz",
      "integrity": "sha512-OuLGC46TjB5BbN1dH8JULVVZY4WTdkF7tV9Ys6wLL1rubZnCMstOhNHueU5bLCrnRuDhKPDM4g6sw4Bel5Gzqg==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.4",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.4.tgz",
      "integrity": "sha512-VT2+G1VQs/9oz078bLrYbecdZKs912zQlkelYpuf+SXF+QvZDYJlbx/LSx+meSAwdDFnF8FVXW92AVjjkVmgFw==",
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.29",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.29.tgz",
      "integrity": "sha512-uw6guiW/gcAGPDhLmd77/6lW8QLeiV5RUTsAX46Db6oLhGaVj4lhnPwb184s1bkc8kdVg/+h988dro8GRDpmYQ==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@kurkle/color": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/@kurkle/color/-/color-0.3.4.tgz",
      "integrity": "sha512-M5UknZPHRu3DEDWoipU6sE8PdkZ6Z/S+v4dD+Ke8IaNlpdSQah50lz1KtcFBa2vsdOnwbbnxJwVM4wty6udA5w==",
      "license": "MIT"
    },
    "node_modules/@react-aria/focus": {
      "version": "3.21.0",
      "resolved": "https://registry.npmjs.org/@react-aria/focus/-/focus-3.21.0.tgz",
      "integrity": "sha512-7NEGtTPsBy52EZ/ToVKCu0HSelE3kq9qeis+2eEq90XSuJOMaDHUQrA7RC2Y89tlEwQB31bud/kKRi9Qme1dkA==",
      "license": "Apache-2.0",
      "dependencies": {
        "@react-aria/interactions": "^3.25.4",
        "@react-aria/utils": "^3.30.0",
        "@react-types/shared": "^3.31.0",
        "@swc/helpers": "^0.5.0",
        "clsx": "^2.0.0"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1",
        "react-dom": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@react-aria/interactions": {
      "version": "3.25.4",
      "resolved": "https://registry.npmjs.org/@react-aria/interactions/-/interactions-3.25.4.tgz",
      "integrity": "sha512-HBQMxgUPHrW8V63u9uGgBymkMfj6vdWbB0GgUJY49K9mBKMsypcHeWkWM6+bF7kxRO728/IK8bWDV6whDbqjHg==",
      "license": "Apache-2.0",
      "dependencies": {
        "@react-aria/ssr": "^3.9.10",
        "@react-aria/utils": "^3.30.0",
        "@react-stately/flags": "^3.1.2",
        "@react-types/shared": "^3.31.0",
        "@swc/helpers": "^0.5.0"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1",
        "react-dom": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@react-aria/ssr": {
      "version": "3.9.10",
      "resolved": "https://registry.npmjs.org/@react-aria/ssr/-/ssr-3.9.10.tgz",
      "integrity": "sha512-hvTm77Pf+pMBhuBm760Li0BVIO38jv1IBws1xFm1NoL26PU+fe+FMW5+VZWyANR6nYL65joaJKZqOdTQMkO9IQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/helpers": "^0.5.0"
      },
      "engines": {
        "node": ">= 12"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@react-aria/utils": {
      "version": "3.30.0",
      "resolved": "https://registry.npmjs.org/@react-aria/utils/-/utils-3.30.0.tgz",
      "integrity": "sha512-ydA6y5G1+gbem3Va2nczj/0G0W7/jUVo/cbN10WA5IizzWIwMP5qhFr7macgbKfHMkZ+YZC3oXnt2NNre5odKw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@react-aria/ssr": "^3.9.10",
        "@react-stately/flags": "^3.1.2",
        "@react-stately/utils": "^3.10.8",
        "@react-types/shared": "^3.31.0",
        "@swc/helpers": "^0.5.0",
        "clsx": "^2.0.0"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1",
        "react-dom": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@react-stately/flags": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@react-stately/flags/-/flags-3.1.2.tgz",
      "integrity": "sha512-2HjFcZx1MyQXoPqcBGALwWWmgFVUk2TuKVIQxCbRq7fPyWXIl6VHcakCLurdtYC2Iks7zizvz0Idv48MQ38DWg==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/helpers": "^0.5.0"
      }
    },
    "node_modules/@react-stately/utils": {
      "version": "3.10.8",
      "resolved": "https://registry.npmjs.org/@react-stately/utils/-/utils-3.10.8.tgz",
      "integrity": "sha512-SN3/h7SzRsusVQjQ4v10LaVsDc81jyyR0DD5HnsQitm/I5WDpaSr2nRHtyloPFU48jlql1XX/S04T2DLQM7Y3g==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/helpers": "^0.5.0"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@react-types/shared": {
      "version": "3.31.0",
      "resolved": "https://registry.npmjs.org/@react-types/shared/-/shared-3.31.0.tgz",
      "integrity": "sha512-ua5U6V66gDcbLZe4P2QeyNgPp4YWD1ymGA6j3n+s8CGExtrCPe64v+g4mvpT8Bnb985R96e4zFT61+m0YCwqMg==",
      "license": "Apache-2.0",
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1"
      }
    },
    "node_modules/@reduxjs/toolkit": {
      "version": "2.8.2",
      "resolved": "https://registry.npmjs.org/@reduxjs/toolkit/-/toolkit-2.8.2.tgz",
      "integrity": "sha512-MYlOhQ0sLdw4ud48FoC5w0dH9VfWQjtCjreKwYTT3l+r427qYC5Y8PihNutepr8XrNaBUDQo9khWUwQxZaqt5A==",
      "license": "MIT",
      "dependencies": {
        "@standard-schema/spec": "^1.0.0",
        "@standard-schema/utils": "^0.3.0",
        "immer": "^10.0.3",
        "redux": "^5.0.1",
        "redux-thunk": "^3.1.0",
        "reselect": "^5.1.0"
      },
      "peerDependencies": {
        "react": "^16.9.0 || ^17.0.0 || ^18 || ^19",
        "react-redux": "^7.2.1 || ^8.1.3 || ^9.0.0"
      },
      "peerDependenciesMeta": {
        "react": {
          "optional": true
        },
        "react-redux": {
          "optional": true
        }
      }
    },
    "node_modules/@rolldown/pluginutils": {
      "version": "1.0.0-beta.27",
      "resolved": "https://registry.npmjs.org/@rolldown/pluginutils/-/pluginutils-1.0.0-beta.27.tgz",
      "integrity": "sha512-+d0F4MKMCbeVUJwG96uQ4SgAznZNSq93I3V+9NHA4OpvqG8mRCpGdKmK8l/dl02h2CCDHwW2FqilnTyDcAnqjA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@rollup/rollup-android-arm-eabi": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.46.2.tgz",
      "integrity": "sha512-Zj3Hl6sN34xJtMv7Anwb5Gu01yujyE/cLBDB2gnHTAHaWS1Z38L7kuSG+oAh0giZMqG060f/YBStXtMH6FvPMA==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-android-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.46.2.tgz",
      "integrity": "sha512-nTeCWY83kN64oQ5MGz3CgtPx8NSOhC5lWtsjTs+8JAJNLcP3QbLCtDDgUKQc/Ro/frpMq4SHUaHN6AMltcEoLQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-darwin-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.46.2.tgz",
      "integrity": "sha512-HV7bW2Fb/F5KPdM/9bApunQh68YVDU8sO8BvcW9OngQVN3HHHkw99wFupuUJfGR9pYLLAjcAOA6iO+evsbBaPQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-darwin-x64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.46.2.tgz",
      "integrity": "sha512-SSj8TlYV5nJixSsm/y3QXfhspSiLYP11zpfwp6G/YDXctf3Xkdnk4woJIF5VQe0of2OjzTt8EsxnJDCdHd2xMA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-arm64/-/rollup-freebsd-arm64-4.46.2.tgz",
      "integrity": "sha512-ZyrsG4TIT9xnOlLsSSi9w/X29tCbK1yegE49RYm3tu3wF1L/B6LVMqnEWyDB26d9Ecx9zrmXCiPmIabVuLmNSg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-x64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-x64/-/rollup-freebsd-x64-4.46.2.tgz",
      "integrity": "sha512-pCgHFoOECwVCJ5GFq8+gR8SBKnMO+xe5UEqbemxBpCKYQddRQMgomv1104RnLSg7nNvgKy05sLsY51+OVRyiVw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-gnueabihf": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-gnueabihf/-/rollup-linux-arm-gnueabihf-4.46.2.tgz",
      "integrity": "sha512-EtP8aquZ0xQg0ETFcxUbU71MZlHaw9MChwrQzatiE8U/bvi5uv/oChExXC4mWhjiqK7azGJBqU0tt5H123SzVA==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-musleabihf": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-musleabihf/-/rollup-linux-arm-musleabihf-4.46.2.tgz",
      "integrity": "sha512-qO7F7U3u1nfxYRPM8HqFtLd+raev2K137dsV08q/LRKRLEc7RsiDWihUnrINdsWQxPR9jqZ8DIIZ1zJJAm5PjQ==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.46.2.tgz",
      "integrity": "sha512-3dRaqLfcOXYsfvw5xMrxAk9Lb1f395gkoBYzSFcc/scgRFptRXL9DOaDpMiehf9CO8ZDRJW2z45b6fpU5nwjng==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-musl/-/rollup-linux-arm64-musl-4.46.2.tgz",
      "integrity": "sha512-fhHFTutA7SM+IrR6lIfiHskxmpmPTJUXpWIsBXpeEwNgZzZZSg/q4i6FU4J8qOGyJ0TR+wXBwx/L7Ho9z0+uDg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loongarch64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loongarch64-gnu/-/rollup-linux-loongarch64-gnu-4.46.2.tgz",
      "integrity": "sha512-i7wfGFXu8x4+FRqPymzjD+Hyav8l95UIZ773j7J7zRYc3Xsxy2wIn4x+llpunexXe6laaO72iEjeeGyUFmjKeA==",
      "cpu": [
        "loong64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-gnu/-/rollup-linux-ppc64-gnu-4.46.2.tgz",
      "integrity": "sha512-B/l0dFcHVUnqcGZWKcWBSV2PF01YUt0Rvlurci5P+neqY/yMKchGU8ullZvIv5e8Y1C6wOn+U03mrDylP5q9Yw==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-gnu/-/rollup-linux-riscv64-gnu-4.46.2.tgz",
      "integrity": "sha512-32k4ENb5ygtkMwPMucAb8MtV8olkPT03oiTxJbgkJa7lJ7dZMr0GCFJlyvy+K8iq7F/iuOr41ZdUHaOiqyR3iQ==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-musl/-/rollup-linux-riscv64-musl-4.46.2.tgz",
      "integrity": "sha512-t5B2loThlFEauloaQkZg9gxV05BYeITLvLkWOkRXogP4qHXLkWSbSHKM9S6H1schf/0YGP/qNKtiISlxvfmmZw==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-s390x-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-s390x-gnu/-/rollup-linux-s390x-gnu-4.46.2.tgz",
      "integrity": "sha512-YKjekwTEKgbB7n17gmODSmJVUIvj8CX7q5442/CK80L8nqOUbMtf8b01QkG3jOqyr1rotrAnW6B/qiHwfcuWQA==",
      "cpu": [
        "s390x"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-gnu/-/rollup-linux-x64-gnu-4.46.2.tgz",
      "integrity": "sha512-Jj5a9RUoe5ra+MEyERkDKLwTXVu6s3aACP51nkfnK9wJTraCC8IMe3snOfALkrjTYd2G1ViE1hICj0fZ7ALBPA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-musl/-/rollup-linux-x64-musl-4.46.2.tgz",
      "integrity": "sha512-7kX69DIrBeD7yNp4A5b81izs8BqoZkCIaxQaOpumcJ1S/kmqNFjPhDu1LHeVXv0SexfHQv5cqHsxLOjETuqDuA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-win32-arm64-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-arm64-msvc/-/rollup-win32-arm64-msvc-4.46.2.tgz",
      "integrity": "sha512-wiJWMIpeaak/jsbaq2HMh/rzZxHVW1rU6coyeNNpMwk5isiPjSTx0a4YLSlYDwBH/WBvLz+EtsNqQScZTLJy3g==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-ia32-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-ia32-msvc/-/rollup-win32-ia32-msvc-4.46.2.tgz",
      "integrity": "sha512-gBgaUDESVzMgWZhcyjfs9QFK16D8K6QZpwAaVNJxYDLHWayOta4ZMjGm/vsAEy3hvlS2GosVFlBlP9/Wb85DqQ==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.46.2.tgz",
      "integrity": "sha512-CvUo2ixeIQGtF6WvuB87XWqPQkoFAFqW+HUo/WzHwuHDvIwZCtjdWXoYCcr06iKGydiqTclC4jU/TNObC/xKZg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@standard-schema/spec": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.0.0.tgz",
      "integrity": "sha512-m2bOd0f2RT9k8QJx1JN85cZYyH1RqFBdlwtkSlf4tBDYLCiiZnv1fIIwacK6cqwXavOydf0NPToMQgpKq+dVlA==",
      "license": "MIT"
    },
    "node_modules/@standard-schema/utils": {
      "version": "0.3.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/utils/-/utils-0.3.0.tgz",
      "integrity": "sha512-e7Mew686owMaPJVNNLs55PUvgz371nKgwsc4vxE49zsODpJEnxgxRo2y/OKrqueavXgZNMDVj3DdHFlaSAeU8g==",
      "license": "MIT"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.17",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.17.tgz",
      "integrity": "sha512-5IKx/Y13RsYd+sauPb2x+U/xZikHjolzfuDgTAl/Tdf3Q8rslRvC19NKDLgAJQ6wsqADk10ntlv08nPFw/gO/A==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/@tailwindcss/node": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/node/-/node-4.1.11.tgz",
      "integrity": "sha512-yzhzuGRmv5QyU9qLNg4GTlYI6STedBWRE7NjxP45CsFYYq9taI0zJXZBMqIC/c8fViNLhmrbpSFS57EoxUmD6Q==",
      "license": "MIT",
      "dependencies": {
        "@ampproject/remapping": "^2.3.0",
        "enhanced-resolve": "^5.18.1",
        "jiti": "^2.4.2",
        "lightningcss": "1.30.1",
        "magic-string": "^0.30.17",
        "source-map-js": "^1.2.1",
        "tailwindcss": "4.1.11"
      }
    },
    "node_modules/@tailwindcss/oxide": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide/-/oxide-4.1.11.tgz",
      "integrity": "sha512-Q69XzrtAhuyfHo+5/HMgr1lAiPP/G40OMFAnws7xcFEYqcypZmdW8eGXaOUIeOl1dzPJBPENXgbjsOyhg2nkrg==",
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.4",
        "tar": "^7.4.3"
      },
      "engines": {
        "node": ">= 10"
      },
      "optionalDependencies": {
        "@tailwindcss/oxide-android-arm64": "4.1.11",
        "@tailwindcss/oxide-darwin-arm64": "4.1.11",
        "@tailwindcss/oxide-darwin-x64": "4.1.11",
        "@tailwindcss/oxide-freebsd-x64": "4.1.11",
        "@tailwindcss/oxide-linux-arm-gnueabihf": "4.1.11",
        "@tailwindcss/oxide-linux-arm64-gnu": "4.1.11",
        "@tailwindcss/oxide-linux-arm64-musl": "4.1.11",
        "@tailwindcss/oxide-linux-x64-gnu": "4.1.11",
        "@tailwindcss/oxide-linux-x64-musl": "4.1.11",
        "@tailwindcss/oxide-wasm32-wasi": "4.1.11",
        "@tailwindcss/oxide-win32-arm64-msvc": "4.1.11",
        "@tailwindcss/oxide-win32-x64-msvc": "4.1.11"
      }
    },
    "node_modules/@tailwindcss/oxide-android-arm64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-android-arm64/-/oxide-android-arm64-4.1.11.tgz",
      "integrity": "sha512-3IfFuATVRUMZZprEIx9OGDjG3Ou3jG4xQzNTvjDoKmU9JdmoCohQJ83MYd0GPnQIu89YoJqvMM0G3uqLRFtetg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-arm64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-arm64/-/oxide-darwin-arm64-4.1.11.tgz",
      "integrity": "sha512-ESgStEOEsyg8J5YcMb1xl8WFOXfeBmrhAwGsFxxB2CxY9evy63+AtpbDLAyRkJnxLy2WsD1qF13E97uQyP1lfQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-x64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-x64/-/oxide-darwin-x64-4.1.11.tgz",
      "integrity": "sha512-EgnK8kRchgmgzG6jE10UQNaH9Mwi2n+yw1jWmof9Vyg2lpKNX2ioe7CJdf9M5f8V9uaQxInenZkOxnTVL3fhAw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-freebsd-x64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-freebsd-x64/-/oxide-freebsd-x64-4.1.11.tgz",
      "integrity": "sha512-xdqKtbpHs7pQhIKmqVpxStnY1skuNh4CtbcyOHeX1YBE0hArj2romsFGb6yUmzkq/6M24nkxDqU8GYrKrz+UcA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm-gnueabihf": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm-gnueabihf/-/oxide-linux-arm-gnueabihf-4.1.11.tgz",
      "integrity": "sha512-ryHQK2eyDYYMwB5wZL46uoxz2zzDZsFBwfjssgB7pzytAeCCa6glsiJGjhTEddq/4OsIjsLNMAiMlHNYnkEEeg==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-gnu": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-gnu/-/oxide-linux-arm64-gnu-4.1.11.tgz",
      "integrity": "sha512-mYwqheq4BXF83j/w75ewkPJmPZIqqP1nhoghS9D57CLjsh3Nfq0m4ftTotRYtGnZd3eCztgbSPJ9QhfC91gDZQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-musl": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-musl/-/oxide-linux-arm64-musl-4.1.11.tgz",
      "integrity": "sha512-m/NVRFNGlEHJrNVk3O6I9ggVuNjXHIPoD6bqay/pubtYC9QIdAMpS+cswZQPBLvVvEF6GtSNONbDkZrjWZXYNQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-gnu": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-gnu/-/oxide-linux-x64-gnu-4.1.11.tgz",
      "integrity": "sha512-YW6sblI7xukSD2TdbbaeQVDysIm/UPJtObHJHKxDEcW2exAtY47j52f8jZXkqE1krdnkhCMGqP3dbniu1Te2Fg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-musl": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-musl/-/oxide-linux-x64-musl-4.1.11.tgz",
      "integrity": "sha512-e3C/RRhGunWYNC3aSF7exsQkdXzQ/M+aYuZHKnw4U7KQwTJotnWsGOIVih0s2qQzmEzOFIJ3+xt7iq67K/p56Q==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-wasm32-wasi": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/oxide-wasm32-wasi-4.1.11.tgz",
      "integrity": "sha512-Xo1+/GU0JEN/C/dvcammKHzeM6NqKovG+6921MR6oadee5XPBaKOumrJCXvopJ/Qb5TH7LX/UAywbqrP4lax0g==",
      "bundleDependencies": [
        "@napi-rs/wasm-runtime",
        "@emnapi/core",
        "@emnapi/runtime",
        "@tybys/wasm-util",
        "@emnapi/wasi-threads",
        "tslib"
      ],
      "cpu": [
        "wasm32"
      ],
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "^1.4.3",
        "@emnapi/runtime": "^1.4.3",
        "@emnapi/wasi-threads": "^1.0.2",
        "@napi-rs/wasm-runtime": "^0.2.11",
        "@tybys/wasm-util": "^0.9.0",
        "tslib": "^2.8.0"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-arm64-msvc": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-arm64-msvc/-/oxide-win32-arm64-msvc-4.1.11.tgz",
      "integrity": "sha512-UgKYx5PwEKrac3GPNPf6HVMNhUIGuUh4wlDFR2jYYdkX6pL/rn73zTq/4pzUm8fOjAn5L8zDeHp9iXmUGOXZ+w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-x64-msvc": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-x64-msvc/-/oxide-win32-x64-msvc-4.1.11.tgz",
      "integrity": "sha512-YfHoggn1j0LK7wR82TOucWc5LDCguHnoS879idHekmmiR7g9HUtMw9MI0NHatS28u/Xlkfi9w5RJWgz2Dl+5Qg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/vite": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/vite/-/vite-4.1.11.tgz",
      "integrity": "sha512-RHYhrR3hku0MJFRV+fN2gNbDNEh3dwKvY8XJvTxCSXeMOsCRSr+uKvDWQcbizrHgjML6ZmTE5OwMrl5wKcujCw==",
      "license": "MIT",
      "dependencies": {
        "@tailwindcss/node": "4.1.11",
        "@tailwindcss/oxide": "4.1.11",
        "tailwindcss": "4.1.11"
      },
      "peerDependencies": {
        "vite": "^5.2.0 || ^6 || ^7"
      }
    },
    "node_modules/@tanstack/react-virtual": {
      "version": "3.13.12",
      "resolved": "https://registry.npmjs.org/@tanstack/react-virtual/-/react-virtual-3.13.12.tgz",
      "integrity": "sha512-Gd13QdxPSukP8ZrkbgS2RwoZseTTbQPLnQEn7HY/rqtM+8Zt95f7xKC7N0EsKs7aoz0WzZ+fditZux+F8EzYxA==",
      "license": "MIT",
      "dependencies": {
        "@tanstack/virtual-core": "3.13.12"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/tannerlinsley"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/@tanstack/virtual-core": {
      "version": "3.13.12",
      "resolved": "https://registry.npmjs.org/@tanstack/virtual-core/-/virtual-core-3.13.12.tgz",
      "integrity": "sha512-1YBOJfRHV4sXUmWsFSf5rQor4Ss82G8dQWLRbnk3GA4jeP8hQt1hxXh0tmflpC0dz3VgEv/1+qwPyLeWkQuPFA==",
      "license": "MIT",
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/tannerlinsley"
      }
    },
    "node_modules/@types/babel__core": {
      "version": "7.20.5",
      "resolved": "https://registry.npmjs.org/@types/babel__core/-/babel__core-7.20.5.tgz",
      "integrity": "sha512-qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.20.7",
        "@babel/types": "^7.20.7",
        "@types/babel__generator": "*",
        "@types/babel__template": "*",
        "@types/babel__traverse": "*"
      }
    },
    "node_modules/@types/babel__generator": {
      "version": "7.27.0",
      "resolved": "https://registry.npmjs.org/@types/babel__generator/-/babel__generator-7.27.0.tgz",
      "integrity": "sha512-ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__template": {
      "version": "7.4.4",
      "resolved": "https://registry.npmjs.org/@types/babel__template/-/babel__template-7.4.4.tgz",
      "integrity": "sha512-h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.1.0",
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__traverse": {
      "version": "7.20.7",
      "resolved": "https://registry.npmjs.org/@types/babel__traverse/-/babel__traverse-7.20.7.tgz",
      "integrity": "sha512-dkO5fhS7+/oos4ciWxyEyjWe48zmG6wbCheo/G2ZnHx4fs3EU6YC6UM8rk56gAjNJ9P3MTH2jo5jb92/K6wbng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.20.7"
      }
    },
    "node_modules/@types/d3-array": {
      "version": "3.2.1",
      "resolved": "https://registry.npmjs.org/@types/d3-array/-/d3-array-3.2.1.tgz",
      "integrity": "sha512-Y2Jn2idRrLzUfAKV2LyRImR+y4oa2AntrgID95SHJxuMUrkNXmanDSed71sRNZysveJVt1hLLemQZIady0FpEg==",
      "license": "MIT"
    },
    "node_modules/@types/d3-color": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/@types/d3-color/-/d3-color-3.1.3.tgz",
      "integrity": "sha512-iO90scth9WAbmgv7ogoq57O9YpKmFBbmoEoCHDB2xMBY0+/KVrqAaCDyCE16dUspeOvIxFFRI+0sEtqDqy2b4A==",
      "license": "MIT"
    },
    "node_modules/@types/d3-ease": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/@types/d3-ease/-/d3-ease-3.0.2.tgz",
      "integrity": "sha512-NcV1JjO5oDzoK26oMzbILE6HW7uVXOHLQvHshBUW4UMdZGfiY6v5BeQwh9a9tCzv+CeefZQHJt5SRgK154RtiA==",
      "license": "MIT"
    },
    "node_modules/@types/d3-interpolate": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/@types/d3-interpolate/-/d3-interpolate-3.0.4.tgz",
      "integrity": "sha512-mgLPETlrpVV1YRJIglr4Ez47g7Yxjl1lj7YKsiMCb27VJH9W8NVM6Bb9d8kkpG/uAQS5AmbA48q2IAolKKo1MA==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-color": "*"
      }
    },
    "node_modules/@types/d3-path": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/@types/d3-path/-/d3-path-3.1.1.tgz",
      "integrity": "sha512-VMZBYyQvbGmWyWVea0EHs/BwLgxc+MKi1zLDCONksozI4YJMcTt8ZEuIR4Sb1MMTE8MMW49v0IwI5+b7RmfWlg==",
      "license": "MIT"
    },
    "node_modules/@types/d3-scale": {
      "version": "4.0.9",
      "resolved": "https://registry.npmjs.org/@types/d3-scale/-/d3-scale-4.0.9.tgz",
      "integrity": "sha512-dLmtwB8zkAeO/juAMfnV+sItKjlsw2lKdZVVy6LRr0cBmegxSABiLEpGVmSJJ8O08i4+sGR6qQtb6WtuwJdvVw==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-time": "*"
      }
    },
    "node_modules/@types/d3-shape": {
      "version": "3.1.7",
      "resolved": "https://registry.npmjs.org/@types/d3-shape/-/d3-shape-3.1.7.tgz",
      "integrity": "sha512-VLvUQ33C+3J+8p+Daf+nYSOsjB4GXp19/S/aGo60m9h1v6XaxjiT82lKVWJCfzhtuZ3yD7i/TPeC/fuKLLOSmg==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-path": "*"
      }
    },
    "node_modules/@types/d3-time": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/@types/d3-time/-/d3-time-3.0.4.tgz",
      "integrity": "sha512-yuzZug1nkAAaBlBBikKZTgzCeA+k1uy4ZFwWANOfKw5z5LRhV0gNA7gNkKm7HoK+HRN0wX3EkxGk0fpbWhmB7g==",
      "license": "MIT"
    },
    "node_modules/@types/d3-timer": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/@types/d3-timer/-/d3-timer-3.0.2.tgz",
      "integrity": "sha512-Ps3T8E8dZDam6fUyNiMkekK3XUsaUEik+idO9/YjPtfj2qruF8tFBXS7XhtE4iIXBLxhmLjP3SXpLhVf21I9Lw==",
      "license": "MIT"
    },
    "node_modules/@types/estree": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.8.tgz",
      "integrity": "sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==",
      "license": "MIT"
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/react": {
      "version": "19.1.9",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.1.9.tgz",
      "integrity": "sha512-WmdoynAX8Stew/36uTSVMcLJJ1KRh6L3IZRx1PZ7qJtBqT3dYTgyDTx8H1qoRghErydW7xw9mSJ3wS//tCRpFA==",
      "devOptional": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.0.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.1.7",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.1.7.tgz",
      "integrity": "sha512-i5ZzwYpqjmrKenzkoLM2Ibzt6mAsM7pxB6BCIouEVVmgiqaMj1TjaK7hnA36hbW5aZv20kx7Lw6hWzPWg0Rurw==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.0.0"
      }
    },
    "node_modules/@types/use-sync-external-store": {
      "version": "0.0.6",
      "resolved": "https://registry.npmjs.org/@types/use-sync-external-store/-/use-sync-external-store-0.0.6.tgz",
      "integrity": "sha512-zFDAD+tlpf2r4asuHEj0XH6pY6i0g5NeAHPn+15wk3BV6JA69eERFXC1gyGThDkVa1zCyKr5jox1+2LbV/AMLg==",
      "license": "MIT"
    },
    "node_modules/@vitejs/plugin-react": {
      "version": "4.7.0",
      "resolved": "https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-4.7.0.tgz",
      "integrity": "sha512-gUu9hwfWvvEDBBmgtAowQCojwZmJ5mcLn3aufeCsitijs3+f2NsrPtlAWIR6OPiqljl96GVCUbLe0HyqIpVaoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.28.0",
        "@babel/plugin-transform-react-jsx-self": "^7.27.1",
        "@babel/plugin-transform-react-jsx-source": "^7.27.1",
        "@rolldown/pluginutils": "1.0.0-beta.27",
        "@types/babel__core": "^7.20.5",
        "react-refresh": "^0.17.0"
      },
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "peerDependencies": {
        "vite": "^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0"
      }
    },
    "node_modules/acorn": {
      "version": "8.15.0",
      "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz",
      "integrity": "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz",
      "integrity": "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.12.6",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.12.6.tgz",
      "integrity": "sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/argon2-browser": {
      "version": "1.18.0",
      "resolved": "https://registry.npmjs.org/argon2-browser/-/argon2-browser-1.18.0.tgz",
      "integrity": "sha512-ImVAGIItnFnvET1exhsQB7apRztcoC5TnlSqernMJDUjbc/DLq3UEYeXFrLPrlaIl8cVfwnXb6wX2KpFf2zxHw==",
      "license": "MIT"
    },
    "node_modules/argon2-wasm": {
      "version": "0.9.0",
      "resolved": "https://registry.npmjs.org/argon2-wasm/-/argon2-wasm-0.9.0.tgz",
      "integrity": "sha512-bt5xqrDt5FnA1gdLLouOwi2NN1h9BeML8DmKth7CCYhygoXUEDeIxEMB++q+CUPQ8U5gju065Z0MjI+hVSXX7A==",
      "license": "MIT"
    },
    "node_modules/argparse": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz",
      "integrity": "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==",
      "dev": true,
      "license": "Python-2.0"
    },
    "node_modules/balanced-match": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
      "integrity": "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/boring-avatars": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/boring-avatars/-/boring-avatars-2.0.1.tgz",
      "integrity": "sha512-TeBnZrp7WxHcQPuLhGQamklgNqaL7eUAUh3E11kFj9rTn0Hari2ZKVTchqNrp62UOHN/XOe5bZGcbzVGwHjHwg==",
      "license": "MIT",
      "peerDependencies": {
        "react": ">=18.0.0",
        "react-dom": ">=18.0.0"
      }
    },
    "node_modules/brace-expansion": {
      "version": "1.1.12",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0",
        "concat-map": "0.0.1"
      }
    },
    "node_modules/browserslist": {
      "version": "4.25.1",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.25.1.tgz",
      "integrity": "sha512-KGj0KoOMXLpSNkkEI6Z6mShmQy0bc1I+T7K9N81k4WWMrfz+6fQ6es80B/YLAeRoKvjYE1YSHHOW1qe9xIVzHw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "caniuse-lite": "^1.0.30001726",
        "electron-to-chromium": "^1.5.173",
        "node-releases": "^2.0.19",
        "update-browserslist-db": "^1.1.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/callsites": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/callsites/-/callsites-3.1.0.tgz",
      "integrity": "sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001731",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001731.tgz",
      "integrity": "sha512-lDdp2/wrOmTRWuoB5DpfNkC0rJDU8DqRa6nYL6HK6sytw70QMopt/NIc/9SM7ylItlBWfACXk0tEn37UWM/+mg==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chart.js": {
      "version": "4.5.0",
      "resolved": "https://registry.npmjs.org/chart.js/-/chart.js-4.5.0.tgz",
      "integrity": "sha512-aYeC/jDgSEx8SHWZvANYMioYMZ2KX02W6f6uVfyteuCGcadDLcYVHdfdygsTQkQ4TKn5lghoojAsPj5pu0SnvQ==",
      "license": "MIT",
      "dependencies": {
        "@kurkle/color": "^0.3.0"
      },
      "engines": {
        "pnpm": ">=8"
      }
    },
    "node_modules/chownr": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-3.0.0.tgz",
      "integrity": "sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/classnames": {
      "version": "2.5.1",
      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
      "license": "MIT"
    },
    "node_modules/cliui": {
      "version": "8.0.1",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-8.0.1.tgz",
      "integrity": "sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.1",
        "wrap-ansi": "^7.0.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/clsx": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/clsx/-/clsx-2.1.1.tgz",
      "integrity": "sha512-eYm0QWBtUrBWZWG0d386OGAw16Z995PiOVo2B7bjWSbHedGl5e0ZWaq65kOGgUSNesEIDkB9ISbTg/JK9dhCZA==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concat-map": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concurrently": {
      "version": "9.2.0",
      "resolved": "https://registry.npmjs.org/concurrently/-/concurrently-9.2.0.tgz",
      "integrity": "sha512-IsB/fiXTupmagMW4MNp2lx2cdSN2FfZq78vF90LBB+zZHArbIQZjQtzXCiXnvTxCZSvXanTqFLWBjw2UkLx1SQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chalk": "^4.1.2",
        "lodash": "^4.17.21",
        "rxjs": "^7.8.1",
        "shell-quote": "^1.8.1",
        "supports-color": "^8.1.1",
        "tree-kill": "^1.2.2",
        "yargs": "^17.7.2"
      },
      "bin": {
        "conc": "dist/bin/concurrently.js",
        "concurrently": "dist/bin/concurrently.js"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/open-cli-tools/concurrently?sponsor=1"
      }
    },
    "node_modules/concurrently/node_modules/supports-color": {
      "version": "8.1.1",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz",
      "integrity": "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/supports-color?sponsor=1"
      }
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cookie": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/cookie/-/cookie-1.0.2.tgz",
      "integrity": "sha512-9Kr/j4O16ISv8zBBhJoi4bXOYNTkFLOqSL3UDB0njXxCXNezjeyVrJyGOWtgfs/q2km1gwBcfH8q1yEGoMYunA==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/crypto-js": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/crypto-js/-/crypto-js-4.2.0.tgz",
      "integrity": "sha512-KALDyEYgpY+Rlob/iriUtjV6d5Eq+Y191A5g4UqLAi8CyGP9N1+FdVbkc1SxKc2r4YAYqG8JzO2KGL+AizD70Q==",
      "license": "MIT"
    },
    "node_modules/csstype": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/csstype/-/csstype-3.1.3.tgz",
      "integrity": "sha512-M1uQkMl8rQK/szD0LNhtqxIPLpimGm8sOBwU7lLnCpSbTyY3yeU1Vc7l4KT5zT4s/yOxHH5O7tIuuLOCnLADRw==",
      "devOptional": true,
      "license": "MIT"
    },
    "node_modules/d3-array": {
      "version": "3.2.4",
      "resolved": "https://registry.npmjs.org/d3-array/-/d3-array-3.2.4.tgz",
      "integrity": "sha512-tdQAmyA18i4J7wprpYq8ClcxZy3SC31QMeByyCFyRt7BVHdREQZ5lpzoe5mFEYZUWe+oq8HBvk9JjpibyEV4Jg==",
      "license": "ISC",
      "dependencies": {
        "internmap": "1 - 2"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-color": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-color/-/d3-color-3.1.0.tgz",
      "integrity": "sha512-zg/chbXyeBtMQ1LbD/WSoW2DpC3I0mpmPdW+ynRTj/x2DAWYrIY7qeZIHidozwV24m4iavr15lNwIwLxRmOxhA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-ease": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-ease/-/d3-ease-3.0.1.tgz",
      "integrity": "sha512-wR/XK3D3XcLIZwpbvQwQ5fK+8Ykds1ip7A2Txe0yxncXSdq1L9skcG7blcedkOX+ZcgxGAmLX1FrRGbADwzi0w==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-format": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-format/-/d3-format-3.1.0.tgz",
      "integrity": "sha512-YyUI6AEuY/Wpt8KWLgZHsIU86atmikuoOmCfommt0LYHiQSPjvX2AcFc38PX0CBpr2RCyZhjex+NS/LPOv6YqA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-interpolate": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-interpolate/-/d3-interpolate-3.0.1.tgz",
      "integrity": "sha512-3bYs1rOD33uo8aqJfKP3JWPAibgw8Zm2+L9vBKEHJ2Rg+viTR7o5Mmv5mZcieN+FRYaAOWX5SJATX6k1PWz72g==",
      "license": "ISC",
      "dependencies": {
        "d3-color": "1 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-path": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-path/-/d3-path-3.1.0.tgz",
      "integrity": "sha512-p3KP5HCf/bvjBSSKuXid6Zqijx7wIfNW+J/maPs+iwR35at5JCbLUT0LzF1cnjbCHWhqzQTIN2Jpe8pRebIEFQ==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-scale": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/d3-scale/-/d3-scale-4.0.2.tgz",
      "integrity": "sha512-GZW464g1SH7ag3Y7hXjf8RoUuAFIqklOAq3MRl4OaWabTFJY9PN/E1YklhXLh+OQ3fM9yS2nOkCoS+WLZ6kvxQ==",
      "license": "ISC",
      "dependencies": {
        "d3-array": "2.10.0 - 3",
        "d3-format": "1 - 3",
        "d3-interpolate": "1.2.0 - 3",
        "d3-time": "2.1.1 - 3",
        "d3-time-format": "2 - 4"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-shape": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/d3-shape/-/d3-shape-3.2.0.tgz",
      "integrity": "sha512-SaLBuwGm3MOViRq2ABk3eLoxwZELpH6zhl3FbAoJ7Vm1gofKx6El1Ib5z23NUEhF9AsGl7y+dzLe5Cw2AArGTA==",
      "license": "ISC",
      "dependencies": {
        "d3-path": "^3.1.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-time": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-time/-/d3-time-3.1.0.tgz",
      "integrity": "sha512-VqKjzBLejbSMT4IgbmVgDjpkYrNWUYJnbCGo874u7MMKIWsILRX+OpX/gTk8MqjpT1A/c6HY2dCA77ZN0lkQ2Q==",
      "license": "ISC",
      "dependencies": {
        "d3-array": "2 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-time-format": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/d3-time-format/-/d3-time-format-4.1.0.tgz",
      "integrity": "sha512-dJxPBlzC7NugB2PDLwo9Q8JiTR3M3e4/XANkreKSUxF8vvXKqm1Yfq4Q5dl8budlunRVlUUaDUgFt7eA8D6NLg==",
      "license": "ISC",
      "dependencies": {
        "d3-time": "1 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-timer": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-timer/-/d3-timer-3.0.1.tgz",
      "integrity": "sha512-ndfJ/JxxMd3nw31uyKoY2naivF+r29V+Lc0svZxe1JvvIRmi8hUsrMvdOwgS1o6uBHmiz91geQ0ylPP0aj1VUA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/dayjs": {
      "version": "1.11.13",
      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.13.tgz",
      "integrity": "sha512-oaMBel6gjolK862uaPQOVTA7q3TZhuSvuMQAAglQDOWYO9A91IrAOUJEyKVlqJlHE0vq5p5UXxzdPfMH/x6xNg==",
      "license": "MIT"
    },
    "node_modules/debug": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.1.tgz",
      "integrity": "sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decimal.js-light": {
      "version": "2.5.1",
      "resolved": "https://registry.npmjs.org/decimal.js-light/-/decimal.js-light-2.5.1.tgz",
      "integrity": "sha512-qIMFpTMZmny+MMIitAB6D7iVPEorVw6YQRWkvarTkT4tBeSLLiHzcwj6q0MmYSFCiVpiqPJTJEYIrpcPzVEIvg==",
      "license": "MIT"
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz",
      "integrity": "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/detect-libc": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.0.4.tgz",
      "integrity": "sha512-3UDv+G9CsCKO1WKMGw9fwq/SWJYbI0c5Y7LU1AXYoDdbhE2AHQ6N6Nb34sG8Fj7T5APy8qXDCKuuIHd1BR0tVA==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.193",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.193.tgz",
      "integrity": "sha512-eePuBZXM9OVCwfYUhd2OzESeNGnWmLyeu0XAEjf7xjijNjHFdeJSzuRUGN4ueT2tEYo5YqjHramKEFxz67p3XA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/emoji-picker-react": {
      "version": "4.13.2",
      "resolved": "https://registry.npmjs.org/emoji-picker-react/-/emoji-picker-react-4.13.2.tgz",
      "integrity": "sha512-azaJQLTshEOZVhksgU136izJWJyZ4Clx6xQ6Vctzk1gOdPPAUbTa/JYDwZJ8rh97QxnjpyeftXl99eRlYr3vNA==",
      "license": "MIT",
      "dependencies": {
        "flairup": "1.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "react": ">=16"
      }
    },
    "node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/enhanced-resolve": {
      "version": "5.18.2",
      "resolved": "https://registry.npmjs.org/enhanced-resolve/-/enhanced-resolve-5.18.2.tgz",
      "integrity": "sha512-6Jw4sE1maoRJo3q8MsSIn2onJFbLTOjY9hlx4DZXmOKvLRd1Ok2kXmAGXaafL2+ijsJZ1ClYbl/pmqr9+k4iUQ==",
      "license": "MIT",
      "dependencies": {
        "graceful-fs": "^4.2.4",
        "tapable": "^2.2.0"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/es-toolkit": {
      "version": "1.39.8",
      "resolved": "https://registry.npmjs.org/es-toolkit/-/es-toolkit-1.39.8.tgz",
      "integrity": "sha512-A8QO9TfF+rltS8BXpdu8OS+rpGgEdnRhqIVxO/ZmNvnXBYgOdSsxukT55ELyP94gZIntWJ+Li9QRrT2u1Kitpg==",
      "license": "MIT",
      "workspaces": [
        "docs",
        "benchmarks"
      ]
    },
    "node_modules/esbuild": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.25.8.tgz",
      "integrity": "sha512-vVC0USHGtMi8+R4Kz8rt6JhEWLxsv9Rnu/lGYbPR8u47B+DCBksq9JarW0zOO7bs37hyOK1l2/oqtbciutL5+Q==",
      "hasInstallScript": true,
      "license": "MIT",
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.25.8",
        "@esbuild/android-arm": "0.25.8",
        "@esbuild/android-arm64": "0.25.8",
        "@esbuild/android-x64": "0.25.8",
        "@esbuild/darwin-arm64": "0.25.8",
        "@esbuild/darwin-x64": "0.25.8",
        "@esbuild/freebsd-arm64": "0.25.8",
        "@esbuild/freebsd-x64": "0.25.8",
        "@esbuild/linux-arm": "0.25.8",
        "@esbuild/linux-arm64": "0.25.8",
        "@esbuild/linux-ia32": "0.25.8",
        "@esbuild/linux-loong64": "0.25.8",
        "@esbuild/linux-mips64el": "0.25.8",
        "@esbuild/linux-ppc64": "0.25.8",
        "@esbuild/linux-riscv64": "0.25.8",
        "@esbuild/linux-s390x": "0.25.8",
        "@esbuild/linux-x64": "0.25.8",
        "@esbuild/netbsd-arm64": "0.25.8",
        "@esbuild/netbsd-x64": "0.25.8",
        "@esbuild/openbsd-arm64": "0.25.8",
        "@esbuild/openbsd-x64": "0.25.8",
        "@esbuild/openharmony-arm64": "0.25.8",
        "@esbuild/sunos-x64": "0.25.8",
        "@esbuild/win32-arm64": "0.25.8",
        "@esbuild/win32-ia32": "0.25.8",
        "@esbuild/win32-x64": "0.25.8"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz",
      "integrity": "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "9.32.0",
      "resolved": "https://registry.npmjs.org/eslint/-/eslint-9.32.0.tgz",
      "integrity": "sha512-LSehfdpgMeWcTZkWZVIJl+tkZ2nuSkyyB9C27MZqFWXuph7DvaowgcTvKqxvpLW1JZIk8PN7hFY3Rj9LQ7m7lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.2.0",
        "@eslint-community/regexpp": "^4.12.1",
        "@eslint/config-array": "^0.21.0",
        "@eslint/config-helpers": "^0.3.0",
        "@eslint/core": "^0.15.0",
        "@eslint/eslintrc": "^3.3.1",
        "@eslint/js": "9.32.0",
        "@eslint/plugin-kit": "^0.3.4",
        "@humanfs/node": "^0.16.6",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@humanwhocodes/retry": "^0.4.2",
        "@types/estree": "^1.0.6",
        "@types/json-schema": "^7.0.15",
        "ajv": "^6.12.4",
        "chalk": "^4.0.0",
        "cross-spawn": "^7.0.6",
        "debug": "^4.3.2",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^8.4.0",
        "eslint-visitor-keys": "^4.2.1",
        "espree": "^10.4.0",
        "esquery": "^1.5.0",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "^8.0.0",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "lodash.merge": "^4.6.2",
        "minimatch": "^3.1.2",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "jiti": "*"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-plugin-react-hooks": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-hooks/-/eslint-plugin-react-hooks-5.2.0.tgz",
      "integrity": "sha512-+f15FfK64YQwZdJNELETdn5ibXEUQmW1DZL6KXhNnc2heoy/sg9VJJeT7n8TlMWouzWqSWavFkIhHyIbIAEapg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0"
      }
    },
    "node_modules/eslint-plugin-react-refresh": {
      "version": "0.4.20",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-refresh/-/eslint-plugin-react-refresh-0.4.20.tgz",
      "integrity": "sha512-XpbHQ2q5gUF8BGOX4dHe+71qoirYMhApEPZ7sfhF/dNnOF1UXnCMGZf79SFTBO7Bz5YEIT4TMieSlJBWhP9WBA==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "eslint": ">=8.40"
      }
    },
    "node_modules/eslint-scope": {
      "version": "8.4.0",
      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-8.4.0.tgz",
      "integrity": "sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "4.2.1",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-4.2.1.tgz",
      "integrity": "sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "10.4.0",
      "resolved": "https://registry.npmjs.org/espree/-/espree-10.4.0.tgz",
      "integrity": "sha512-j6PAQ2uUr79PZhBjP5C5fhl8e39FmRnOjsD5lGnWrFU8i2G776tBK7+nP8KuQUTTyAZUwfQqXAgrVH5MbH9CYQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.15.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^4.2.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/esquery/-/esquery-1.6.0.tgz",
      "integrity": "sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/eventemitter3": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/eventemitter3/-/eventemitter3-5.0.1.tgz",
      "integrity": "sha512-GWkBvjiSZK87ELrYOSESUYeVIc9mvLLf/nXalMOS5dYrgZq9o5OVkbZAVM06CVxYsCwH9BDZFPlQTlPA1j4ahA==",
      "license": "MIT"
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz",
      "integrity": "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fdir": {
      "version": "6.4.6",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.4.6.tgz",
      "integrity": "sha512-hiFoqpyZcfNm1yc4u8oWCf9A2c4D3QjCrks3zmoVKVxpQRzmPNar1hUJcBG2RQHvEVGDN+Jm81ZheVLAQMK6+w==",
      "license": "MIT",
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/file-entry-cache": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-8.0.0.tgz",
      "integrity": "sha512-XXTUwCvisa5oacNGRP9SfNtYBNAMi+RPwBFmblZEF7N7swHYQS6/Zfk7SRwx4D5j3CH211YNRco1DEMNVfZCnQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^4.0.0"
      },
      "engines": {
        "node": ">=16.0.0"
      }
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz",
      "integrity": "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/flairup": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/flairup/-/flairup-1.0.0.tgz",
      "integrity": "sha512-IKlE+pNvL2R+kVL1kEhUYqRxVqeFnjiIvHWDMLFXNaqyUdFXQM2wte44EfMYJNHkW16X991t2Zg8apKkhv7OBA==",
      "license": "MIT"
    },
    "node_modules/flat-cache": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-4.0.1.tgz",
      "integrity": "sha512-f7ccFPK3SXFHpx15UIGyRJ/FJQctuKZ0zVuN3frBo4HnK3cay9VEW0R6yPYFHC0AgqhukPzKjq22t5DmAyqGyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flatted": "^3.2.9",
        "keyv": "^4.5.4"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/flatted": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/flatted/-/flatted-3.3.3.tgz",
      "integrity": "sha512-GX+ysw4PBCz0PzosHDepZGANEuFCMLrnRTiEy9McGjmkCQYwRq4A/X786G/fjM/+OjsWSU1ZrY5qyARZmO/uwg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/gensync": {
      "version": "1.0.0-beta.2",
      "resolved": "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz",
      "integrity": "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/get-them-args": {
      "version": "1.3.2",
      "resolved": "https://registry.npmjs.org/get-them-args/-/get-them-args-1.3.2.tgz",
      "integrity": "sha512-LRn8Jlk+DwZE4GTlDbT3Hikd1wSHgLMme/+7ddlqKd7ldwR6LjJgTVWzBnR01wnYGe4KgrXjg287RaI22UHmAw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "16.3.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-16.3.0.tgz",
      "integrity": "sha512-bqWEnJ1Nt3neqx2q5SFfGS8r/ahumIakg3HcwtNlrVlwXIeNumWn/c7Pn/wKzGhf6SaW6H6uWXLqC30STCMchQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "license": "ISC"
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/hash-wasm": {
      "version": "4.12.0",
      "resolved": "https://registry.npmjs.org/hash-wasm/-/hash-wasm-4.12.0.tgz",
      "integrity": "sha512-+/2B2rYLb48I/evdOIhP+K/DD2ca2fgBjp6O+GBEnCDk2e4rpeXIK8GvIyRPjTezgmWn9gmKwkQjjx6BtqDHVQ==",
      "license": "MIT"
    },
    "node_modules/heroicons": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/heroicons/-/heroicons-2.2.0.tgz",
      "integrity": "sha512-yOwvztmNiBWqR946t+JdgZmyzEmnRMC2nxvHFC90bF1SUttwB6yJKYeme1JeEcBfobdOs827nCyiWBS2z/brog==",
      "license": "MIT"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/immer": {
      "version": "10.1.1",
      "resolved": "https://registry.npmjs.org/immer/-/immer-10.1.1.tgz",
      "integrity": "sha512-s2MPrmjovJcoMaHtx6K11Ra7oD05NT97w1IC5zpMkT6Atjr7H8LjaDd81iIxUYpMKSRRNMJE703M1Fhr/TctHw==",
      "license": "MIT",
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/immer"
      }
    },
    "node_modules/import-fresh": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/import-fresh/-/import-fresh-3.3.1.tgz",
      "integrity": "sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "parent-module": "^1.0.0",
        "resolve-from": "^4.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/internmap": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/internmap/-/internmap-2.0.3.tgz",
      "integrity": "sha512-5Hh7Y1wQbvY5ooGgPbDaL5iYLAPzMTUrjMulskHLH6wnv/A+1q5rgEaiuqEjB+oxGXIVZs1FF+R/KPN3ZSQYYg==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/jiti": {
      "version": "2.5.1",
      "resolved": "https://registry.npmjs.org/jiti/-/jiti-2.5.1.tgz",
      "integrity": "sha512-twQoecYPiVA5K/h6SxtORw/Bs3ar+mLUtoPSc7iMXzQzK8d7eJ/R09wmTwAjiamETn1cXYPGfNnu7DMoHgu12w==",
      "license": "MIT",
      "bin": {
        "jiti": "lib/jiti-cli.mjs"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
      "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/js-yaml": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz",
      "integrity": "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "argparse": "^2.0.1"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/jsesc": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz",
      "integrity": "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/json-buffer": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/json-buffer/-/json-buffer-3.0.1.tgz",
      "integrity": "sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
      "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
      "integrity": "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json5": {
      "version": "2.2.3",
      "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
      "integrity": "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "json5": "lib/cli.js"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/keyv": {
      "version": "4.5.4",
      "resolved": "https://registry.npmjs.org/keyv/-/keyv-4.5.4.tgz",
      "integrity": "sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "json-buffer": "3.0.1"
      }
    },
    "node_modules/kill-port": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/kill-port/-/kill-port-2.0.1.tgz",
      "integrity": "sha512-e0SVOV5jFo0mx8r7bS29maVWp17qGqLBZ5ricNSajON6//kmb7qqqNnml4twNE8Dtj97UQD+gNFOaipS/q1zzQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "get-them-args": "1.3.2",
        "shell-exec": "1.0.2"
      },
      "bin": {
        "kill-port": "cli.js"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz",
      "integrity": "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/lightningcss": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss/-/lightningcss-1.30.1.tgz",
      "integrity": "sha512-xi6IyHML+c9+Q3W0S4fCQJOym42pyurFiJUHEcEyHS0CeKzia4yZDEsLlqOFykxOdHpNy0NmvVO31vcSqAxJCg==",
      "license": "MPL-2.0",
      "dependencies": {
        "detect-libc": "^2.0.3"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      },
      "optionalDependencies": {
        "lightningcss-darwin-arm64": "1.30.1",
        "lightningcss-darwin-x64": "1.30.1",
        "lightningcss-freebsd-x64": "1.30.1",
        "lightningcss-linux-arm-gnueabihf": "1.30.1",
        "lightningcss-linux-arm64-gnu": "1.30.1",
        "lightningcss-linux-arm64-musl": "1.30.1",
        "lightningcss-linux-x64-gnu": "1.30.1",
        "lightningcss-linux-x64-musl": "1.30.1",
        "lightningcss-win32-arm64-msvc": "1.30.1",
        "lightningcss-win32-x64-msvc": "1.30.1"
      }
    },
    "node_modules/lightningcss-darwin-arm64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-arm64/-/lightningcss-darwin-arm64-1.30.1.tgz",
      "integrity": "sha512-c8JK7hyE65X1MHMN+Viq9n11RRC7hgin3HhYKhrMyaXflk5GVplZ60IxyoVtzILeKr+xAJwg6zK6sjTBJ0FKYQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-x64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-x64/-/lightningcss-darwin-x64-1.30.1.tgz",
      "integrity": "sha512-k1EvjakfumAQoTfcXUcHQZhSpLlkAuEkdMBsI/ivWw9hL+7FtilQc0Cy3hrx0AAQrVtQAbMI7YjCgYgvn37PzA==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-freebsd-x64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-freebsd-x64/-/lightningcss-freebsd-x64-1.30.1.tgz",
      "integrity": "sha512-kmW6UGCGg2PcyUE59K5r0kWfKPAVy4SltVeut+umLCFoJ53RdCUWxcRDzO1eTaxf/7Q2H7LTquFHPL5R+Gjyig==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm-gnueabihf": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm-gnueabihf/-/lightningcss-linux-arm-gnueabihf-1.30.1.tgz",
      "integrity": "sha512-MjxUShl1v8pit+6D/zSPq9S9dQ2NPFSQwGvxBCYaBYLPlCWuPh9/t1MRS8iUaR8i+a6w7aps+B4N0S1TYP/R+Q==",
      "cpu": [
        "arm"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-gnu": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-gnu/-/lightningcss-linux-arm64-gnu-1.30.1.tgz",
      "integrity": "sha512-gB72maP8rmrKsnKYy8XUuXi/4OctJiuQjcuqWNlJQ6jZiWqtPvqFziskH3hnajfvKB27ynbVCucKSm2rkQp4Bw==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-musl": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-musl/-/lightningcss-linux-arm64-musl-1.30.1.tgz",
      "integrity": "sha512-jmUQVx4331m6LIX+0wUhBbmMX7TCfjF5FoOH6SD1CttzuYlGNVpA7QnrmLxrsub43ClTINfGSYyHe2HWeLl5CQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-gnu": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-gnu/-/lightningcss-linux-x64-gnu-1.30.1.tgz",
      "integrity": "sha512-piWx3z4wN8J8z3+O5kO74+yr6ze/dKmPnI7vLqfSqI8bccaTGY5xiSGVIJBDd5K5BHlvVLpUB3S2YCfelyJ1bw==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-musl": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-musl/-/lightningcss-linux-x64-musl-1.30.1.tgz",
      "integrity": "sha512-rRomAK7eIkL+tHY0YPxbc5Dra2gXlI63HL+v1Pdi1a3sC+tJTcFrHX+E86sulgAXeI7rSzDYhPSeHHjqFhqfeQ==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-arm64-msvc": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-arm64-msvc/-/lightningcss-win32-arm64-msvc-1.30.1.tgz",
      "integrity": "sha512-mSL4rqPi4iXq5YVqzSsJgMVFENoa4nGTT/GjO2c0Yl9OuQfPsIfncvLrEW6RbbB24WtZ3xP/2CCmI3tNkNV4oA==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-x64-msvc": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-x64-msvc/-/lightningcss-win32-x64-msvc-1.30.1.tgz",
      "integrity": "sha512-PVqXh48wh4T53F/1CCu8PIPCxLzWyCnn/9T5W1Jpmdy5h9Cwd+0YQS6/LwhHXSafuc61/xg9Lv5OrCby6a++jg==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz",
      "integrity": "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/lodash": {
      "version": "4.17.21",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
      "integrity": "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/lodash.merge": {
      "version": "4.6.2",
      "resolved": "https://registry.npmjs.org/lodash.merge/-/lodash.merge-4.6.2.tgz",
      "integrity": "sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/lru-cache": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz",
      "integrity": "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "yallist": "^3.0.2"
      }
    },
    "node_modules/magic-string": {
      "version": "0.30.17",
      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.17.tgz",
      "integrity": "sha512-sNPKHvyjVf7gyjwS4xGTaW/mCnF8wnjtifKBEhxfZ7E/S8tQ0rssrwGNn6q8JH/ohItJfSQp9mBtQYuTlH5QnA==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0"
      }
    },
    "node_modules/minimatch": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz",
      "integrity": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^1.1.7"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/minipass": {
      "version": "7.1.2",
      "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.2.tgz",
      "integrity": "sha512-qOOzS1cBTWYF4BH8fVePDBOO9iptMnGUEZwNc/cMWnTV2nVLZ7VoNWEPHkYczZA0pdoA7dl6e7FL659nX9S2aw==",
      "license": "ISC",
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/minizlib": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/minizlib/-/minizlib-3.0.2.tgz",
      "integrity": "sha512-oG62iEk+CYt5Xj2YqI5Xi9xWUeZhDI8jjQmC5oThVH5JGCTgIjr7ciJDzC7MBzYd//WvR1OTmP5Q38Q8ShQtVA==",
      "license": "MIT",
      "dependencies": {
        "minipass": "^7.1.2"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/mkdirp": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/mkdirp/-/mkdirp-3.0.1.tgz",
      "integrity": "sha512-+NsyUUAZDmo6YVHzL/stxSu3t9YS1iljliy3BSDrXJ/dkn1KYdmtZODGGjLcc9XLgVVpH4KshHB8XmZgMhaBXg==",
      "license": "MIT",
      "bin": {
        "mkdirp": "dist/cjs/src/bin.js"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/nanoid": {
      "version": "3.3.11",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.11.tgz",
      "integrity": "sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-releases": {
      "version": "2.0.19",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.19.tgz",
      "integrity": "sha512-xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "resolved": "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz",
      "integrity": "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz",
      "integrity": "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/parent-module": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/parent-module/-/parent-module-1.0.1.tgz",
      "integrity": "sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "callsites": "^3.0.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.3.tgz",
      "integrity": "sha512-5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==",
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pocketbase": {
      "version": "0.26.2",
      "resolved": "https://registry.npmjs.org/pocketbase/-/pocketbase-0.26.2.tgz",
      "integrity": "sha512-WA8EOBc3QnSJh8rJ3iYoi9DmmPOMFIgVfAmIGux7wwruUEIzXgvrO4u0W2htfQjGIcyezJkdZOy5Xmh7SxAftw==",
      "license": "MIT"
    },
    "node_modules/postcss": {
      "version": "8.5.6",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.6.tgz",
      "integrity": "sha512-3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.11",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz",
      "integrity": "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/react": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react/-/react-19.1.1.tgz",
      "integrity": "sha512-w8nqGImo45dmMIfljjMwOGtbmC/mk4CMYhWIicdSflH91J9TyCyczcPFXJzrZ/ZXcgGRFeP6BU0BEJTw6tZdfQ==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-chartjs-2": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/react-chartjs-2/-/react-chartjs-2-5.3.0.tgz",
      "integrity": "sha512-UfZZFnDsERI3c3CZGxzvNJd02SHjaSJ8kgW1djn65H1KK8rehwTjyrRKOG3VTMG8wtHZ5rgAO5oTHtHi9GCCmw==",
      "license": "MIT",
      "peerDependencies": {
        "chart.js": "^4.1.1",
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.1.1.tgz",
      "integrity": "sha512-Dlq/5LAZgF0Gaz6yiqZCf6VCcZs1ghAJyrsu84Q/GT0gV+mCxbfmKNoGRKBYMJ8IEdGPqu49YWXD02GCknEDkw==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.26.0"
      },
      "peerDependencies": {
        "react": "^19.1.1"
      }
    },
    "node_modules/react-is": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react-is/-/react-is-19.1.1.tgz",
      "integrity": "sha512-tr41fA15Vn8p4X9ntI+yCyeGSf1TlYaY5vlTZfQmeLBrFo3psOPX6HhTDnFNL9uj3EhP0KAQ80cugCl4b4BERA==",
      "license": "MIT",
      "peer": true
    },
    "node_modules/react-redux": {
      "version": "9.2.0",
      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-9.2.0.tgz",
      "integrity": "sha512-ROY9fvHhwOD9ySfrF0wmvu//bKCQ6AeZZq1nJNtbDC+kk5DuSuNX/n6YWYF/SYy7bSba4D4FSz8DJeKY/S/r+g==",
      "license": "MIT",
      "dependencies": {
        "@types/use-sync-external-store": "^0.0.6",
        "use-sync-external-store": "^1.4.0"
      },
      "peerDependencies": {
        "@types/react": "^18.2.25 || ^19",
        "react": "^18.0 || ^19",
        "redux": "^5.0.0"
      },
      "peerDependenciesMeta": {
        "@types/react": {
          "optional": true
        },
        "redux": {
          "optional": true
        }
      }
    },
    "node_modules/react-refresh": {
      "version": "0.17.0",
      "resolved": "https://registry.npmjs.org/react-refresh/-/react-refresh-0.17.0.tgz",
      "integrity": "sha512-z6F7K9bV85EfseRCp2bzrpyQ0Gkw1uLoCel9XBVWPg/TjRj94SkJzUTGfOa4bs7iJvBWtQG0Wq7wnI0syw3EBQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-router": {
      "version": "7.7.1",
      "resolved": "https://registry.npmjs.org/react-router/-/react-router-7.7.1.tgz",
      "integrity": "sha512-jVKHXoWRIsD/qS6lvGveckwb862EekvapdHJN/cGmzw40KnJH5gg53ujOJ4qX6EKIK9LSBfFed/xiQ5yeXNrUA==",
      "license": "MIT",
      "dependencies": {
        "cookie": "^1.0.1",
        "set-cookie-parser": "^2.6.0"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
      },
      "peerDependenciesMeta": {
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/react-router-dom": {
      "version": "7.7.1",
      "resolved": "https://registry.npmjs.org/react-router-dom/-/react-router-dom-7.7.1.tgz",
      "integrity": "sha512-bavdk2BA5r3MYalGKZ01u8PGuDBloQmzpBZVhDLrOOv1N943Wq6dcM9GhB3x8b7AbqPMEezauv4PeGkAJfy7FQ==",
      "license": "MIT",
      "dependencies": {
        "react-router": "7.7.1"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
      }
    },
    "node_modules/recharts": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/recharts/-/recharts-3.1.0.tgz",
      "integrity": "sha512-NqAqQcGBmLrfDs2mHX/bz8jJCQtG2FeXfE0GqpZmIuXIjkpIwj8sd9ad0WyvKiBKPd8ZgNG0hL85c8sFDwascw==",
      "license": "MIT",
      "dependencies": {
        "@reduxjs/toolkit": "1.x.x || 2.x.x",
        "clsx": "^2.1.1",
        "decimal.js-light": "^2.5.1",
        "es-toolkit": "^1.39.3",
        "eventemitter3": "^5.0.1",
        "immer": "^10.1.1",
        "react-redux": "8.x.x || 9.x.x",
        "reselect": "5.1.1",
        "tiny-invariant": "^1.3.3",
        "use-sync-external-store": "^1.2.2",
        "victory-vendor": "^37.0.2"
      },
      "engines": {
        "node": ">=18"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        "react-dom": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        "react-is": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/redux": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/redux/-/redux-5.0.1.tgz",
      "integrity": "sha512-M9/ELqF6fy8FwmkpnF0S3YKOqMyoWJ4+CS5Efg2ct3oY9daQvd/Pc71FpGZsVsbl3Cpb+IIcjBDUnnyBdQbq4w==",
      "license": "MIT"
    },
    "node_modules/redux-thunk": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/redux-thunk/-/redux-thunk-3.1.0.tgz",
      "integrity": "sha512-NW2r5T6ksUKXCabzhL9z+h206HQw/NJkcLm1GPImRQ8IzfXwRGqjVhKJGauHirT0DAuyy6hjdnMZaRoAcy0Klw==",
      "license": "MIT",
      "peerDependencies": {
        "redux": "^5.0.0"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/reselect": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/reselect/-/reselect-5.1.1.tgz",
      "integrity": "sha512-K/BG6eIky/SBpzfHZv/dd+9JBFiS4SWV7FIujVyJRux6e45+73RaUHXLmIR1f7WOMaQ0U1km6qwklRQxpJJY0w==",
      "license": "MIT"
    },
    "node_modules/resolve-from": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/resolve-from/-/resolve-from-4.0.0.tgz",
      "integrity": "sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/rollup": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/rollup/-/rollup-4.46.2.tgz",
      "integrity": "sha512-WMmLFI+Boh6xbop+OAGo9cQ3OgX9MIg7xOQjn+pTCwOkk+FNDAeAemXkJ3HzDJrVXleLOFVa1ipuc1AmEx1Dwg==",
      "license": "MIT",
      "dependencies": {
        "@types/estree": "1.0.8"
      },
      "bin": {
        "rollup": "dist/bin/rollup"
      },
      "engines": {
        "node": ">=18.0.0",
        "npm": ">=8.0.0"
      },
      "optionalDependencies": {
        "@rollup/rollup-android-arm-eabi": "4.46.2",
        "@rollup/rollup-android-arm64": "4.46.2",
        "@rollup/rollup-darwin-arm64": "4.46.2",
        "@rollup/rollup-darwin-x64": "4.46.2",
        "@rollup/rollup-freebsd-arm64": "4.46.2",
        "@rollup/rollup-freebsd-x64": "4.46.2",
        "@rollup/rollup-linux-arm-gnueabihf": "4.46.2",
        "@rollup/rollup-linux-arm-musleabihf": "4.46.2",
        "@rollup/rollup-linux-arm64-gnu": "4.46.2",
        "@rollup/rollup-linux-arm64-musl": "4.46.2",
        "@rollup/rollup-linux-loongarch64-gnu": "4.46.2",
        "@rollup/rollup-linux-ppc64-gnu": "4.46.2",
        "@rollup/rollup-linux-riscv64-gnu": "4.46.2",
        "@rollup/rollup-linux-riscv64-musl": "4.46.2",
        "@rollup/rollup-linux-s390x-gnu": "4.46.2",
        "@rollup/rollup-linux-x64-gnu": "4.46.2",
        "@rollup/rollup-linux-x64-musl": "4.46.2",
        "@rollup/rollup-win32-arm64-msvc": "4.46.2",
        "@rollup/rollup-win32-ia32-msvc": "4.46.2",
        "@rollup/rollup-win32-x64-msvc": "4.46.2",
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/rxjs": {
      "version": "7.8.2",
      "resolved": "https://registry.npmjs.org/rxjs/-/rxjs-7.8.2.tgz",
      "integrity": "sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.1.0"
      }
    },
    "node_modules/scheduler": {
      "version": "0.26.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.26.0.tgz",
      "integrity": "sha512-NlHwttCI/l5gCPR3D1nNXtWABUmBwvZpEQiD4IXSbIDq8BzLIK/7Ir5gTFSGZDUu37K5cMNp0hFtzO38sC7gWA==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/set-cookie-parser": {
      "version": "2.7.1",
      "resolved": "https://registry.npmjs.org/set-cookie-parser/-/set-cookie-parser-2.7.1.tgz",
      "integrity": "sha512-IOc8uWeOZgnb3ptbCURJWNjWUPcO3ZnTTdzsurqERrP6nPyv+paC55vJM0LpOlT2ne+Ix+9+CRG1MNLlyZ4GjQ==",
      "license": "MIT"
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shell-exec": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/shell-exec/-/shell-exec-1.0.2.tgz",
      "integrity": "sha512-jyVd+kU2X+mWKMmGhx4fpWbPsjvD53k9ivqetutVW/BQ+WIZoDoP4d8vUMGezV6saZsiNoW2f9GIhg9Dondohg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/shell-quote": {
      "version": "1.8.3",
      "resolved": "https://registry.npmjs.org/shell-quote/-/shell-quote-1.8.3.tgz",
      "integrity": "sha512-ObmnIF4hXNg1BqhnHmgbDETF8dLPCggZWBjkQfhZpbszZnYur5DUljTcCHii5LC3J5E0yeO/1LIMyH+UvHQgyw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-3.1.1.tgz",
      "integrity": "sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/tabbable": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/tabbable/-/tabbable-6.2.0.tgz",
      "integrity": "sha512-Cat63mxsVJlzYvN51JmVXIgNoUokrIaT2zLclCXjRd8boZ0004U4KCs/sToJ75C6sdlByWxpYnb5Boif1VSFew==",
      "license": "MIT"
    },
    "node_modules/tailwindcss": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-4.1.11.tgz",
      "integrity": "sha512-2E9TBm6MDD/xKYe+dvJZAmg3yxIEDNRc0jwlNyDg/4Fil2QcSLjFKGVff0lAf1jjeaArlG/M75Ey/EYr/OJtBA==",
      "license": "MIT"
    },
    "node_modules/tapable": {
      "version": "2.2.2",
      "resolved": "https://registry.npmjs.org/tapable/-/tapable-2.2.2.tgz",
      "integrity": "sha512-Re10+NauLTMCudc7T5WLFLAwDhQ0JWdrMK+9B2M8zR5hRExKmsRDCBA7/aV/pNJFltmBFO5BAMlQFi/vq3nKOg==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/tar": {
      "version": "7.4.3",
      "resolved": "https://registry.npmjs.org/tar/-/tar-7.4.3.tgz",
      "integrity": "sha512-5S7Va8hKfV7W5U6g3aYxXmlPoZVAwUMy9AOKyF2fVuZa2UD3qZjg578OrLRt8PcNN1PleVaL/5/yYATNL0ICUw==",
      "license": "ISC",
      "dependencies": {
        "@isaacs/fs-minipass": "^4.0.0",
        "chownr": "^3.0.0",
        "minipass": "^7.1.2",
        "minizlib": "^3.0.1",
        "mkdirp": "^3.0.1",
        "yallist": "^5.0.0"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tar/node_modules/yallist": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-5.0.0.tgz",
      "integrity": "sha512-YgvUTfwqyc7UXVMrB+SImsVYSmTS8X/tSrtdNZMImM+n7+QTriRXyXim0mBrTXNeqzVF0KWGgHPeiyViFFrNDw==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tiny-invariant": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/tiny-invariant/-/tiny-invariant-1.3.3.tgz",
      "integrity": "sha512-+FbBPE1o9QAYvviau/qC5SE3caw21q3xkvWKBtja5vgqOWIHHJ3ioaq1VPfn/Szqctz2bU/oYeKd9/z5BL+PVg==",
      "license": "MIT"
    },
    "node_modules/tinyglobby": {
      "version": "0.2.14",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.14.tgz",
      "integrity": "sha512-tX5e7OM1HnYr2+a2C/4V0htOcSQcoSTH9KgJnVvNm5zm/cyEWKJ7j7YutsH9CxMdtOkkLFy2AHrMci9IM8IPZQ==",
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.4.4",
        "picomatch": "^4.0.2"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tree-kill": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/tree-kill/-/tree-kill-1.2.2.tgz",
      "integrity": "sha512-L0Orpi8qGpRG//Nd+H90vFB+3iHnue1zSSGmNOOCh1GLJ7rUKVwV2HvijphGQS2UmhUZewS9VgvxYIdgr+fG1A==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "tree-kill": "cli.js"
      }
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz",
      "integrity": "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/update-browserslist-db": {
      "version": "1.1.3",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.3.tgz",
      "integrity": "sha512-UxhIZQ+QInVdunkDAaiazvvT/+fXL5Osr0JZlJulepYu6Jd7qJtDZjlur0emRlT71EN3ScPoE7gvsuIKKNavKw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz",
      "integrity": "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/use-sync-external-store": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/use-sync-external-store/-/use-sync-external-store-1.5.0.tgz",
      "integrity": "sha512-Rb46I4cGGVBmjamjphe8L/UnvJD+uPPtTkNvX5mZgqdbavhI4EbgIWJiIHXJ8bc/i9EQGPRh4DwEURJ552Do0A==",
      "license": "MIT",
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/victory-vendor": {
      "version": "37.3.6",
      "resolved": "https://registry.npmjs.org/victory-vendor/-/victory-vendor-37.3.6.tgz",
      "integrity": "sha512-SbPDPdDBYp+5MJHhBCAyI7wKM3d5ivekigc2Dk2s7pgbZ9wIgIBYGVw4zGHBml/qTFbexrofXW6Gu4noGxrOwQ==",
      "license": "MIT AND ISC",
      "dependencies": {
        "@types/d3-array": "^3.0.3",
        "@types/d3-ease": "^3.0.0",
        "@types/d3-interpolate": "^3.0.1",
        "@types/d3-scale": "^4.0.2",
        "@types/d3-shape": "^3.1.0",
        "@types/d3-time": "^3.0.0",
        "@types/d3-timer": "^3.0.0",
        "d3-array": "^3.1.6",
        "d3-ease": "^3.0.1",
        "d3-interpolate": "^3.0.1",
        "d3-scale": "^4.0.2",
        "d3-shape": "^3.1.0",
        "d3-time": "^3.0.0",
        "d3-timer": "^3.0.1"
      }
    },
    "node_modules/vite": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/vite/-/vite-7.0.6.tgz",
      "integrity": "sha512-MHFiOENNBd+Bd9uvc8GEsIzdkn1JxMmEeYX35tI3fv0sJBUTfW5tQsoaOwuY4KhBI09A3dUJ/DXf2yxPVPUceg==",
      "license": "MIT",
      "dependencies": {
        "esbuild": "^0.25.0",
        "fdir": "^6.4.6",
        "picomatch": "^4.0.3",
        "postcss": "^8.5.6",
        "rollup": "^4.40.0",
        "tinyglobby": "^0.2.14"
      },
      "bin": {
        "vite": "bin/vite.js"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "funding": {
        "url": "https://github.com/vitejs/vite?sponsor=1"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      },
      "peerDependencies": {
        "@types/node": "^20.19.0 || >=22.12.0",
        "jiti": ">=1.21.0",
        "less": "^4.0.0",
        "lightningcss": "^1.21.0",
        "sass": "^1.70.0",
        "sass-embedded": "^1.70.0",
        "stylus": ">=0.54.8",
        "sugarss": "^5.0.0",
        "terser": "^5.16.0",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "jiti": {
          "optional": true
        },
        "less": {
          "optional": true
        },
        "lightningcss": {
          "optional": true
        },
        "sass": {
          "optional": true
        },
        "sass-embedded": {
          "optional": true
        },
        "stylus": {
          "optional": true
        },
        "sugarss": {
          "optional": true
        },
        "terser": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz",
      "integrity": "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yargs": {
      "version": "17.7.2",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-17.7.2.tgz",
      "integrity": "sha512-7dSzzRQ++CKnNI/krKnYRV7JKKPUXMEh61soaHKg9mrWEhzFWhFnxPxGl+69cD1Ou63C13NUPCnmIcrvqCuM6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^8.0.1",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.3",
        "y18n": "^5.0.5",
        "yargs-parser": "^21.1.1"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/yargs-parser": {
      "version": "21.1.1",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-21.1.1.tgz",
      "integrity": "sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    }
  }
}
```


## package.json

```json
{
  "name": "project_name",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "kill-port": "kill-port 8089",
    "dev": "npm run kill-port && vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@headlessui/react": "^2.2.7",
    "@heroicons/react": "^2.2.0",
    "@tailwindcss/vite": "^4.1.11",
    "argon2-browser": "^1.18.0",
    "argon2-wasm": "^0.9.0",
    "boring-avatars": "^2.0.1",
    "chart.js": "^4.5.0",
    "classnames": "^2.5.1",
    "crypto-js": "^4.2.0",
    "dayjs": "^1.11.13",
    "emoji-picker-react": "^4.13.2",
    "hash-wasm": "^4.12.0",
    "heroicons": "^2.2.0",
    "pocketbase": "^0.26.2",
    "react": "^19.1.0",
    "react-chartjs-2": "^5.3.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.7.1",
    "recharts": "^3.1.0",
    "tailwindcss": "^4.1.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "concurrently": "^9.2.0",
    "eslint": "^9.30.1",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "kill-port": "^2.0.1",
    "vite": "^7.0.4"
  }
}
```


## README.md

```md
# 🍃 Nodea — Journal positif chiffré

**Nodea** est une application web pour écrire chaque jour trois points positifs, noter son humeur et répondre à une question originale.  
Toutes les données sont **chiffrées côté client** avant d’être envoyées au serveur : toi seul·e peux les lire, même l’admin n’y a jamais accès.

---

## Principes

- **Confidentialité réelle** : chiffrement de bout en bout, personne d’autre que toi ne peut lire tes écrits.
- **Journal quotidien** : trois points positifs obligatoires, humeur (score + emoji), question du jour aléatoire, commentaire libre.
- **Aucune analyse automatique, aucun tracking, aucun partage des données** : tu restes propriétaire de tout ce que tu écris.
- **Interface minimaliste, rapide et accessible.**

---

## Stack technique

- **Frontend** : React, TailwindCSS
- **Backend** : PocketBase auto-hébergé
- **Chiffrement** :  
  - AES-GCM (WebCrypto), avec dérivation de clé via Argon2.
  - Tous les contenus sensibles sont chiffrés côté client : positifs, humeur, emoji, question/réponse, commentaire.
  - La clé principale est dérivée du mot de passe et stockée chiffrée avec un salt unique. Aucune donnée sensible ne circule ou n’est stockée en clair.
- **Pas de tracking, pas d’export CSV ni d’API publique.**

---

## Fonctionnement du chiffrement

- Toutes les données sont chiffrées localement dans le navigateur, avant envoi.
- Le chiffrement utilise l’API WebCrypto en mode AES-GCM.
- La clé est dérivée via Argon2 à partir du mot de passe utilisateur·ice et d’un salt unique.
- La clé principale sert à chiffrer/déchiffrer les données du journal. Elle est elle-même stockée chiffrée côté serveur.
- Même l’admin n’a jamais accès à tes données, même avec un dump complet de la base.
- L’export se fait localement en données déchiffrées, à la demande.

---

## Fonctionnalités

- **Entrée quotidienne** (3 positifs, humeur, question, commentaire)
- **Historique** : filtrage, suppression d’entrées
- **Graphique** : humeur sur 6 mois glissants
- **Export** : téléchargement de toutes tes données en JSON
- **Gestion du compte** : email, mot de passe, suppression, export
- **Admin** : gestion utilisateurs et invitations

---

## Installation

### Prérequis

- Node.js >= 18
- PocketBase (serveur à installer localement ou sur un serveur dédié)

### Déploiement local

1. **Cloner le repo**  
   ```bash
   git clone https://github.com/aliceout/daily.git
   cd daily
   ```
2. **Installer les dépendances**
    Installer les dépendances
   ```bash
   npm install
   ```
3. **Installer et lancer PocketBase**
- Télécharger PocketBase depuis pocketbase.io
- Lancer PocketBase sur le port 8090
   ```bash
   ./pocketbase serve
   ```


4. **Configurer l’environnement**
- Créer un fichier .env à la racine avec :
   ```ini
   VITE_PB_URL=<Adress of pocketbase>
   ```
5. **Lancer l’application**
   ```bash
   npm run dev
   ```
6. **Ouvrir dans ton navigateur**

   http://localhost:5173

   ---

## Sécurité et limites

- **La sécurité dépend de la force de ton mot de passe**.
- **Perte du mot de passe = perte irrémédiable des données** (aucune récupération possible).
- **Aucune sauvegarde serveur** : exporte régulièrement tes données si besoin.
- **Pas d’application mobile native** pour l’instant, mais utilisable sur mobile via navigateur.

---

## Roadmap

- Module **Goals** de suivi des objectifs annuels
- Module **Review** qui s'inspire du projet [YearCompass](https://yearcompass.com)

---

## Crédits

Développé par aliceout
Projet open source, sous licence Mozilla Public License 2.0
```


## vite.config.js

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 8089,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:8089", changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

