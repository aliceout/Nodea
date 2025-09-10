# Module Passage

## But
Suivi des **périodes de transition** (ruptures, deuil, changements de vie…).  
Chaque entrée est rattachée à un **hashtag obligatoire** (ex. `#Rupture2025`, `#Deuil`) pour regrouper les notes d’une même histoire.

## Table
- **Collection** : `passage_entries`
- **Schéma technique** : identique aux autres modules  
  (`id`, `module_user_id`, `payload`, `cipher_iv`, `guard` caché, `created`, `updated`).

## Payload clair attendu
```json
{
  "type": "passage.entry",
  "date": "2025-09-10T14:21:00.000Z",
  "thread": "#Rupture2025",                // obligatoire : identifiant d’histoire/hashtag
  "title": "Jour 3 — pourquoi c'était juste", // optionnel
  "content": "Texte libre sur le cheminement" // requis
}
```

## Flux
- Création : en 2 temps
    POST avec guard:"init".
    PATCH …?sid=<module_user_id>&d=init avec le guard calculé (HMAC).
- Lecture :
    GET /passage_entries?sid=<module_user_id> → renvoie payload chiffré + métadonnées.
- Mise à jour / suppression :
    PATCH ou DELETE …?sid=<module_user_id>&d=<guard>.

## Export / Import
Export clair = tableau modules.passage[] dans export.json.
Import = re-chiffrement local + flux création en 2 temps.
Jamais exportés : payload chiffré, cipher_iv, guard, id.

Exemple d’export clair :

``` json
{
  "modules": {
    "passage": [
      {
        "date": "2025-09-10",
        "thread": "#Rupture2025",
        "title": "Jour 3 — pourquoi c'était juste",
        "content": "Texte libre sur le cheminement"
      }
    ]
  }
}
```

## Notes
Le champ thread est obligatoire et sert à regrouper les entrées dans l’historique.
L’historique est affiché par thread, avec un tri antichronologique à l’intérieur de chaque groupe.
Comme pour tous les modules :
- Les données sont chiffrées côté client (AES-GCM).
- Le guard assure l’intégrité (jamais renvoyé).
- L’export ne contient que les payloads clairs (jamais id, cipher_iv, guard).