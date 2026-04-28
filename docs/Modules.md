# Modules

Nodea expose plusieurs **modules** indépendants, chacun avec sa
propre logique métier mais bâtis sur la **même base technique
chiffrée** : une table dédiée par module, une création en deux
temps avec validation HMAC, des données illisibles côté serveur.

| Module | À quoi ça sert | Détail |
|---|---|---|
| **Mood** | Humeur quotidienne, trois positifs, question d'introspection optionnelle | [Modules/Mood.md](./Modules/Mood.md) |
| **Goals** | Objectifs annuels avec statuts `open` / `wip` / `done`, regroupables par tag | [Modules/Goals.md](./Modules/Goals.md) |
| **Passage** | Entrées longues (titre + contenu en thread), pour journal libre | (fiche à compléter) |
| **Habits** | Habitudes (`items`) + occurrences datées (`logs`) → heatmap, taux de régularité | [Modules/Habits.md](./Modules/Habits.md) |
| **Library** | Bibliothèque (`items` + `reviews` + `covers`) — œuvres lues/vues, notes, vignettes chiffrées | [Modules/Library.md](./Modules/Library.md) |
| **Review** | Bilan annuel guidé, parcours YearCompass en 15 sections | [Modules/Review.md](./Modules/Review.md) |

---

## 1. Structure commune

Chaque module a **une ou plusieurs tables Postgres** dédiées
(suffixées `_entries`), enregistrées dans une seule liste source de
vérité — `packages/api/src/collections/registry.ts`. Ajouter un
module = ajouter une ligne ; toute la plomberie REST (4 routes par
collection) et la validation HMAC sont automatiquement câblées par
le factory `collection-factory.ts`. Impossible d'enregistrer une
collection sans validation guard.

| Champ           | Description                                                                  |
|-----------------|------------------------------------------------------------------------------|
| `id`            | UUID généré côté serveur (PK).                                               |
| `user_id`       | FK → `users.id`, **ON DELETE CASCADE**.                                      |
| `module_user_id`| Identifiant secondaire opaque, dérivé localement via la clé maître. Utilisé comme `sid` dans toutes les requêtes pour découpler l'identité utilisateur du contenu module. |
| `cipher_iv`     | IV 96 bits aléatoire (base64) utilisé pour le chiffrement AES-GCM.           |
| `payload`       | Contenu JSON chiffré AES-GCM (base64). **Le serveur ne déchiffre jamais.**   |
| `guard`         | HMAC-SHA-256 stocké côté serveur, jamais renvoyé en lecture. Cf. §3.         |
| `created_at` / `updated_at` | Timestamps `timestamptz` standard.                                |

---

## 2. Cycle de vie d'un enregistrement

Création en **deux temps**, géré par le client :

1. **POST `/{collection}/records`** avec `guard: "init"` — le
   serveur insère la ligne avec un guard sentinelle.
2. **PATCH `/{collection}/records/:id?sid=...&d=init`** avec le
   nouveau guard calculé localement (`g_<hex>`) — promote la ligne
   en remplaçant `init` par le vrai guard.

Cette séparation existe parce que le guard dépend de l'`id`
généré par le serveur ; on ne peut pas le calculer avant l'insert.
Une fois promu, l'enregistrement est intègre.

**Update / Delete** : `PATCH` ou `DELETE /{collection}/records/:id?sid=...&d=<guard>`.
Le middleware `requireGuard` valide le tuple `(user, sid, guard)`
dans une seule passe centralisée — aucun moyen d'oublier la
validation pour une collection donnée.

**Read** : `GET /{collection}/records?sid=<sid>` retourne uniquement
le `payload` chiffré + l'`iv` + les timestamps. Le `guard` est
**toujours retiré** des réponses (sa raison d'être étant d'être un
secret partagé client/serveur).

Le serveur ne voit jamais le contenu clair. Toute logique métier
s'opère après déchiffrement côté navigateur.

---

## 3. Guards et intégrité

```
guard = "g_" + hex( HMAC-SHA-256( hmacSubKey, moduleUserId + ":" + recordId ) )
```

- `hmacSubKey` est dérivée de la clé maître via HKDF avec le label
  `"nodea:hmac"` (séparation de domaine — la clé AES utilise
  `"nodea:aes"`). Cf. [Security.md §1](./Security.md).
- Le calcul est **déterministe** et purement local — jamais de
  round-trip réseau.
- Sans la clé maître, impossible de forger un guard valide. Donc
  sans la clé maître : pas de mutation possible.

Le cache local des guards (`nodea.guards.v1` en mémoire process,
**jamais en localStorage**) est purgé au login et au logout.

---

## 4. Import / Export

Format commun :

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "<module>": [ ...payloads clairs... ]
  }
}
```

- **Export** : le client liste page par page (200 entrées), déchiffre
  chaque payload localement, agrège dans le JSON. Aucun accès au
  contenu clair côté serveur — c'est le navigateur qui produit
  l'archive.
- **Import** : le client re-chiffre chaque payload avec la clé
  maître courante puis rejoue le flux POST + PATCH. Les modules à
  doublons potentiels (Mood, Goals, Habits…) ont une clé naturelle
  documentée dans leur fiche pour la déduplication.
- Formats acceptés : export Nodea v1, NDJSON (une ligne par
  payload), tableau brut pour la rétrocompatibilité Mood.

---

## 5. Suppression de compte

`DELETE /auth/me` (côté client) supprime la ligne `users`. Toutes
les tables modules ont `user_id` en FK avec `ON DELETE CASCADE` :
les enregistrements chiffrés disparaissent **dans la même
transaction**, sans orphelins possibles.

L'écran de suppression demande une preuve OPAQUE de mot de passe
fraîche (re-auth Phase 7B), une coche d'acknowledgement explicite
et une saisie du mot `SUPPRIMER` pour éviter les clics
accidentels.

---

## 6. Invariants tous modules confondus

1. **Clé maître uniquement côté client** — aléatoire, stockée
   chiffrée (KEK + OPAQUE `exportKey`), importée comme `CryptoKey`
   non-extractible au login. Cf. [Security.md §2](./Security.md).
2. **Création en deux temps** — POST init → PATCH promotion. Le
   guard ne peut être calculé qu'après que le serveur a attribué
   un `id`.
3. **Lecture par `sid`** — le `module_user_id` découple l'identité
   utilisateur du contenu module (utile pour les futurs partages
   intra-utilisateur ; aujourd'hui, un seul `sid` par module).
4. **Mutations gardées** — `requireGuard` valide systématiquement
   `(user, sid, guard)` côté serveur. Forger un guard nécessite la
   clé maître ; la clé maître nécessite le mot de passe (ou une
   passkey PRF). Pas de raccourci.
5. **Import/Export E2E** — chiffrement et déchiffrement
   exclusivement dans le navigateur.
6. **Logout = perte de clé** — le store Zustand purge le `CryptoKey`
   ; toute tentative de mutation post-logout déclenche le
   `KeyMissingModal` et redirige vers la connexion.

Toute nouvelle fonctionnalité module doit s'aligner sur ces six
invariants — le modèle E2E ne tolère pas d'exception silencieuse.
