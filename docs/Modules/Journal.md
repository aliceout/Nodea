# Module Journal (`passage_entries`)

## Description fonctionnelle

Module de **journal libre** — entrées longues groupées par thread,
pour prises de notes au fil de l'eau, journal intime, ou suivi
structuré en fils thématiques.

- Une entrée = un texte daté avec un titre optionnel et un contenu
  en Markdown.
- Regroupement par **thread** (chaîne libre type `#voyage`,
  `#thérapie`, `#projet-X`) — autocomplete sur les threads existants
  via le `ThreadSuggestInput`.
- Attachments inline : 0 à 3 photos par entrée, base64 dans le
  payload chiffré.

## Payload clair attendu

```jsonc
{
  "type": "passage.entry",
  "date": "YYYY-MM-DD",
  "thread": "string",                       // fil thématique libre, optionnel
  "title": "string|null",                   // titre, optionnel
  "content": "string",                      // Markdown libre, requis
  "attachments": [
    {
      "id": "string",                       // identifiant local unique
      "mime": "image/png|jpeg|jpg|webp|gif",
      "data": "base64..."                   // bytes bruts en base64 (pas de préfixe data:)
    }
  ]
}
```

- `content` est requis ; tout le reste est optionnel.
- `attachments` est inline tant que le volume reste raisonnable
  (~quelques centaines de KB par entrée). Si l'usage demande plus,
  une collection séparée `journal_attachments` mirrorant
  `library_covers_entries` sera ajoutée.

## Sécurité

Journal applique les règles communes à tous les modules — voir
[Architecture.md §7](../Architecture.md#7-schéma-commun-des-modules) pour le détail
(AES-GCM, guard HMAC, création en deux temps, validation
`requireGuard`).

## Export / Import

- Export clair : tableau `modules.passage[]` dans `export.json`.
- Import : re-chiffre localement puis rejoue le flux POST init →
  PATCH promotion.
- Pagination de la lecture : 200 entrées par requête.
- Pas de clé naturelle de déduplication : l'utilisateur·ice peut
  écrire plusieurs entrées le même jour sur le même thread.
  L'import ne dédoublonne pas.

## Points clés

1. Une entrée = un texte daté libre, sans contrainte de nombre par jour.
2. Le **thread** sert de regroupement libre — pas de hiérarchie
   imposée. L'UI affiche les entrées agrégées par thread, ordre
   anti-chronologique.
3. Les attachments restent inline (base64) — adaptés à l'usage
   « 0-3 petites photos par entrée ».
4. Serveur aveugle : titre, contenu, photos, threads — tout est
   chiffré, rien n'apparaît en plain SQL.
