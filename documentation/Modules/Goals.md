# Module Goals (`goals_entries`)

## Description fonctionnelle

Suivi des objectifs annuels (ou pluri-annuels).  
- Une entrée = un objectif.  
- Possibilité de grouper par thread (tag libre) et de filtrer par statut (`open` → `wip` → `done`).  
- Pas de logs automatiques : l’historique se limite aux champs `created/updated` PocketBase.

## Payload clair attendu

```json
{
  "date": "YYYY-MM-DD",        // date de référence (création, échéance…)
  "title": "string",           // intitulé
  "note": "string|optional",   // description libre
  "status": "open|wip|done",   // progression
  "thread": "string"           // tag / groupe libre (optionnel)
}
```

- `title` et `status` sont obligatoires.  
- `thread` est utilisé par l’historique et pour l’autocomplétion côté formulaire.

## Sécurité

- Chiffrement AES-GCM avec la clé maîtresse (CryptoKey non extractible).  
- Guard HMAC dérivé de la clé maîtresse (`deriveGuard(mainKey, sid, id)`).  
- Création en deux temps (`POST init` → `PATCH` promotion).  
- Update/Delete : `?sid=<sid>&d=<guard>` obligatoire (fallback `d=init` géré côté client).  
- `StoreProvider` purge les guards au logout pour éviter toute réutilisation post-session.

## Export / Import

- Export clair : `modules.goals[]`.  
- Import : re-chiffre localement puis rejoue le flux POST/PATCH.  
- Le plugin `core/utils/ImportExport/Goals.jsx` :  
  - utilise `thread/date/title` comme clé « naturelle » (`getNaturalKey`) pour détecter les doublons,  
  - pagine les lectures et ignore les enregistrements illisibles,  
  - expose un `legend` UI indiquant les données manquantes si besoin.

### Exemple d’export

```json
{
  "modules": {
    "goals": [
      {
        "date": "2025-01-01",
        "title": "Apprendre React",
        "note": "Faire un mini-projet perso",
        "status": "wip",
        "thread": "#apprentissage"
      },
      {
        "date": "2025-03-15",
        "title": "Tennis chaque semaine",
        "status": "open",
        "thread": "#sport"
      }
    ]
  }
}
```

## Points clés

1. Interface : formulaire détaillé (date, statut, tags) + historique filtrable / groupable.  
2. Les mutations rapides (toggle de statut) utilisent les guards HMAC calculés localement.  
3. Serveur aveugle : les objectifs sont entièrement chiffrés ; seules les métadonnées PocketBase sont visibles.  
4. Export/Import respectent la même structure que les payloads métier, facilitant l’archivage utilisateur.
