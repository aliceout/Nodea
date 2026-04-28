# Module Goals (`goals_entries`)

## Description fonctionnelle

Suivi des objectifs annuels (ou pluri-annuels).
- Une entrée = un objectif.
- Possibilité de grouper par thread (tag libre) et de filtrer par statut (`open` → `wip` → `done`).
- Pas de logs automatiques : l'historique se limite aux timestamps `created_at` / `updated_at`.

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
- `thread` est utilisé par l'historique et pour l'autocomplétion côté formulaire.

## Sécurité

Goals applique les règles communes à tous les modules — voir
[Modules.md §1-3](../Modules.md#1-structure-commune) pour le détail
(AES-GCM, guard HMAC, création en deux temps, validation
`requireGuard`).

## Export / Import

- Export clair : `modules.goals[]`.
- Import : re-chiffre localement puis rejoue le flux POST init →
  PATCH promotion.
- Clé naturelle de déduplication : tuple `(thread, date, title)`.
- Pagination de la lecture : 200 entrées par requête. Les enregistrements illisibles sont signalés dans le UI d'import via un `legend` listant les payloads manquants.

### Exemple d'export

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
3. Serveur aveugle : les objectifs sont entièrement chiffrés ; seules les métadonnées techniques (`id`, `created_at`, `updated_at`, `iv`) sont visibles.
4. Export/Import respectent la même structure que les payloads métier, facilitant l'archivage utilisateur.
