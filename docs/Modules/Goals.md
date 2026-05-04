# Module Goals (`goals_entries`)

## Description fonctionnelle

Suivi des objectifs annuels (ou pluri-annuels).
- Une entrée = un objectif.
- Possibilité de grouper par thread (tag libre) et de filtrer par statut (`open` → `wip` → `done`).
- Pas de logs automatiques. Le payload chiffré porte un `updated_at` que le client bumpe à chaque save (utilisé par le tri « Récent ») et un `completed_at` quand le statut passe à `done`.

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
[Architecture.md §7](../Architecture.md#7-schéma-commun-des-modules) pour le détail
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
3. Serveur aveugle : les objectifs sont entièrement chiffrés. Seuls `id` (UUID handle), `module_user_id` (sid d'accès) et `cipher_iv` (IV AES-GCM) sont visibles. Pas de `user_id`, pas de timestamps colonnes — l'opérateur ne peut pas lier un objectif à un user, ni dater une écriture côté DB.
4. Export/Import respectent la même structure que les payloads métier, facilitant l'archivage utilisateur.
