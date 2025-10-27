# Module Passage (`passage_entries`)

## Objet

Consigner des périodes de transition (deuil, rupture, reconversion, etc.).  
Chaque entrée appartient à un **thread** (`#Hashtag`) qui permet de regrouper les notes d’une même histoire et de les consulter chronologiquement.

## Payload clair attendu

```json
{
  "type": "passage.entry",
  "date": "2025-09-10T14:21:00.000Z",
  "thread": "#Rupture2025",                // obligatoire
  "title": "Jour 3 – pourquoi c'était juste", // optionnel
  "content": "Texte libre sur le cheminement" // requis
}
```

- `thread` (obligatoire) sert de clé fonctionnelle et de filtre principal dans l’historique.  
- `title` est facultatif ; `content` est requis.

## Sécurité

- Chiffrement AES-GCM avec la clé maîtresse (CryptoKey non extractible).  
- Guard HMAC dérivé de `mainKey + module_user_id + recordId`.  
- Création en deux temps (`POST` → `PATCH` promotion).  
- `deletePassageEntry` gère le fallback `d=init` si le guard n’a jamais été promu.  
- L’historique (`listPassageDecrypted`) utilise `decryptWithRetry`; en cas d’échec, `markMissing()` force le logout.

## Export / Import

- Export clair : `modules.passage[]`.  
- Import : normalise les champs, chiffre localement, gère les doublons via (`thread + date` éventuels) et rejoue le flux POST/PATCH.  
- `core/utils/ImportExport/Passage.jsx` filtre les payloads incomplets (thread ou content manquants).  
- Les threads existants sont listés via `listDistinctThreads` (paginé) avec propagation `markMissing`.

### Exemple d’export

```json
{
  "modules": {
    "passage": [
      {
        "date": "2025-09-10T14:21:00.000Z",
        "thread": "#Rupture2025",
        "title": "Jour 3 – pourquoi c'était juste",
        "content": "Texte libre sur le cheminement"
      }
    ]
  }
}
```

## Points clés

1. Historique affiché par thread, trié de la plus récente à la plus ancienne.  
2. Un thread peut contenir des entrées longues ; l’édition inline gère l’auto‑resize des zones de texte.  
3. Serveur aveugle : seules les métadonnées minimalistes sont visibles (`thread` n’est connu qu’après déchiffrement local).  
4. Les gardes sont nettoyés au logout pour éviter toute manipulation hors session.
