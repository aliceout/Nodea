# MODULES

Ce document décrit les conventions communes à tous les modules chiffrés et résume les fiches détaillées (`documentation/Modules/*.md`).  
Pour la gestion de la clé maîtresse et des guards, se référer également à `documentation/Security.md`.

---

## 1. Structure commune (`<module>_entries`)

| Champ            | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `id`             | Identifiant PocketBase.                                                     |
| `module_user_id` | Identifiant secondaire opaque, généré lors de l’activation du module.       |
| `payload`        | Contenu JSON chiffré AES-GCM (base64).                                      |
| `cipher_iv`      | IV 96 bits (base64) utilisé pour le chiffrement AES-GCM.                   |
| `guard`          | HMAC caché (champ hidden), calculé à partir de la clé maîtresse.           |
| `created/updated`| Timestamps PocketBase.                                                     |

- **Création** : toujours en **deux temps** (`POST guard:"init"` puis `PATCH` promotion).  
- **Update/Delete** : exigent `?sid=<module_user_id>&d=<guard>` (guard HMAC).  
- **Lecture** : `GET /<module>_entries?sid=<module_user_id>` retourne uniquement les données chiffrées.

Le serveur ne voit jamais le contenu clair. Toute logique métier s’opère après déchiffrement côté client.

---

## 2. Gestion de la clé maîtresse (rappel)

1. Clé maîtresse aléatoire (32 octets) générée à l’inscription.  
2. Stockée chiffrée dans `users.encrypted_key` (protection Argon2id).  
3. Au login, déchiffrement côté client puis import de deux CryptoKey non extractibles (AES/HMAC).  
4. `markMissing()` déclenche un logout immédiat si la clé disparaît ou ne peut être déchiffrée.  
5. Le cache local des guards (`nodea.guards.v1`) est purgé au login et au logout.

Ces invariants sont détaillés dans `documentation/Security.md`. Les fiches module supposent qu’une clé maîtresse valide est disponible dans le store (`state.mainKey`).  

---

## 3. Guards et intégrité

- `guard = "g_" + hex( HMAC( HMAC(mainKey, "guard:"+sid), recordId ) )`.  
- Le champ `guard` n’est jamais renvoyé par l’API.  
- Les services modules (Mood/Goals/Passage/…) utilisent :  
  - `deriveGuard(mainKey, sid, recordId)` pour calculer le guard.  
  - `deleteEntryGuard`, `setEntryGuard`, `clearGuardsCache` pour gérer le cache local.  
- Suppression ou mise à jour : fallback `d=init` prévu pour les enregistrements legacy non promus.

---

## 4. Import / Export

Format commun export :
```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "<module>": [ ...payloads clairs... ]
  }
}
```

- Export : pagination (200 éléments) + déchiffrement local via les plugins `core/utils/ImportExport/*.jsx`.  
- Import : re-chiffre localement puis rejoue le flux POST/PATCH. Les plugins gèrent la déduplication via `listExistingKeys`/`getNaturalKey` quand c’est pertinent.  
- Formats acceptés : export Nodea v1, tableau legacy (Mood), NDJSON (une ligne par payload).

---

## 5. Fiches module

| Module  | Fiche                                        | Notes principales |
|---------|----------------------------------------------|-------------------|
| Mood    | `documentation/Modules/Mood.md`              | Humeur quotidienne, positifs, question/réponse. |
| Passage | `documentation/Modules/Passage.md`           | Entrées longues (thread, titre, contenu).       |
| Goals   | `documentation/Modules/Goals.md`             | Objectifs annuels (statuts open/wip/done).      |
| Review  | `documentation/Modules/Review.md`            | Bilan annuel, structure question/réponse.       |
| Habits  | `documentation/Modules/Habits.md`            | Items + logs (habitude + occurrences).          |
| Library | `documentation/Modules/Library.md`           | Items + reviews (œuvres, notes).                |

Chaque fiche précise :
- le payload clair attendu (schéma JSON),  
- les règles fonctionnelles (cardinalité, champs obligatoires),  
- les particularités d’export/import (déduplication, clés naturelles).  

---

## 6. Suppression de compte

Le flux de suppression client supprime l’utilisateur **après** avoir :
1. Rechargé la configuration modules (`loadModulesConfig`).  
2. Pour chaque module activé :  
   - listé toutes les entrées (`listAllBySid`),  
   - supprimé chaque enregistrement avec dérivation du guard HMAC,  
   - vérifié qu’aucune entrée ne reste (`remaining.length === 0`).  
3. Supprimé l’utilisateur sur PocketBase puis vidé la session locale.

Cela garantit qu’aucune donnée chiffrée n’est laissée orpheline avec un guard actif.

---

## 7. Résumé des invariants

1. **Clé maîtresse uniquement côté client** (aleatoire, stockée chiffrée + CryptoKey non extractible).  
2. **Création en deux temps** (POST init → PATCH guard).  
3. **Accès lecture** via `sid` uniquement, sans guard, mais retour chiffré.  
4. **Mutations** nécessitant guard + sid (intégrité forte).  
5. **Import/Export** toujours chiffré/déchiffré localement.  
6. **Logout forcé** à la moindre perte de clé.

Ces règles valent pour tous les modules actuels et futurs. Toute nouvelle fonctionnalité doit s’aligner sur ces conventions pour préserver le modèle E2E.
