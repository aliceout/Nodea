# BDD.md

## Table `users`

| Champ            | Type       | Description                                                                                 |
|------------------|------------|---------------------------------------------------------------------------------------------|
| `id`             | string     | ID auto-généré par PocketBase                                                               |
| `username`       | string     | Nom d’utilisateur·rice                                                                      |
| `email`          | string     | Email de connexion                                                                          |
| `role`           | string     | `admin` ou `user`                                                                           |
| `encrypted_key`  | string     | Clé chiffrée de l’utilisateur·rice (clé AES chiffrée avec son mot de passe via Argon2id)    |
| `encryption_salt`| string     | Salt utilisée pour dériver la clé avec Argon2id                                             |
| `modules`        | string (JSON chiffré) | Contient la configuration des modules (activés ou non, avec ID secondaire)       |

### Exemple de champ `modules` après déchiffrement :
```json
{
  "mood": {
    "enabled": true,
    "id": "m_abc123"
  },
  "goals": {
    "enabled": false,
    "id": "g_deadbeef"
  }
}
```

## Tables `*_entries` (ex : `goals_entries`, `mood_entries`, etc.)

| Champ            | Type                | Description                                                                |
|------------------|---------------------|----------------------------------------------------------------------------|
| `id`             | `string`            | ID unique de l’entrée (généré par PocketBase)                              |
| `module_user_id` | `string`            | Identifiant secondaire (lié au champ `id` de `users.modules`)              |
| `payload`        | `string` (chiffré)  | Données chiffrées en AES-GCM (contenu propre au module)                    |
| `cipher_iv`      | `string`            | IV (initialisation vector) utilisé pour chiffrer `payload`                 |
| `guard`          | `string`            | Secret unique requis pour modifier ou supprimer l’entrée (`?d=guard`)      |


## Notes :
- Le lien entre un utilisateur·rice et ses entrées se fait uniquement via le champ module_user_id.
- Le champ guard est exigé dans toutes les requêtes DELETE ou PATCH, et doit correspondre à celui stocké dans l’entrée.
- Aucune relation n’est déclarée entre users.id et les entrées : le lien est purement implicite et chiffré.
