# Module Library

> Statut : **en conception** (refacto K · Sauge). Décisions de cadrage
> validées le 2026-04-26 (cf. §10) ; reste à coder selon le plan §11.

---

## 1. Objet & cadrage

Library est le module **bibliothèque personnelle de livres** : les
ouvrages que la personne a lus / abandonnés / a en cours, avec ses
notes, extraits et impressions.

L'objectif explicite est de **remplacer Babelio / Goodreads /
StoryGraph** dans une version auto-hébergée et chiffrée bout en bout.
Le serveur ne sait jamais ce que la personne lit.

**Livres uniquement.** Les médias audiovisuels (films, séries,
documentaires) feront l'objet d'un module séparé — leurs APIs
(TMDB) et leurs sémantiques (épisodes, runtime, plateformes de
streaming) sont assez différentes pour mériter leur propre surface.

---

## 2. Disparition du module Passage

Le module Passage **disparaît purement** — pas de migration, pas de
données à préserver :

- les rows existantes dans `passage_entries` rattachées au
  `module_user_id` du module **Passage** sont **supprimées** (wipe).
  C'étaient des données de test ;
- la configuration côté frontend (`modules_list.tsx`, sidebar, store,
  i18n) retire l'entrée `passage` ;
- le module **Journal reste totalement intact**. Il utilise la même
  table `passage_entries` avec son propre `module_user_id` —
  aucune ligne du Journal n'est touchée par le wipe, aucun code
  Journal n'est modifié.

L'idée originale de Passage — **noter les extraits qu'on aime dans
ses lectures** — est reprise ici sous la forme des reviews
`kind: "quote"` (cf. §3.2). C'est la seule chose qui survit du
concept Passage, et elle vit désormais dans Library.

---

## 3. Schéma des données

Trois tables chiffrées E2E (mêmes règles crypto que Mood / Goals /
Journal — `module_user_id`, `payload` AES-GCM, `cipher_iv`, `guard`
HMAC déterministe, création en deux temps).

### 3.1 `library_items_entries` (œuvres)

```jsonc
{
  "type": "book",
  "title": "Les Misérables",         // requis

  // Identité externe — pour fetch métadonnées + dédup à l'import.
  // Tous optionnels (saisie manuelle possible).
  "providers": {
    "openlibrary": "OL45804W",
    "googlebooks": "abc123",
    "isbn13": "9782070409228",
    "isbn10": "2070409228"
  },

  // Métadonnées descriptives — figées au fetch (snapshot).
  // Convention de nom : `<Prénom> <NOM>` avec le NOM en MAJUSCULES.
  // Appliquée à la saisie manuelle, à l'import (Babelio livre les
  // noms inversés et en casse normale, on flippe et on uppercase),
  // et aux résultats des providers (Open Library / Google Books
  // donnent souvent juste un blob de texte qu'on normalise).
  "creators": [
    { "name": "Victor HUGO", "role": "author" }
  ],
  "year": 1862,
  "language": "fr",                  // langue de l'édition lue
  "original_language": "fr",
  "page_count": 1463,
  "publisher": "Folio classique",
  "summary": "Texte court, optionnel",
  "series": {                        // optionnel
    "name": "Les Misérables",
    "position": 2,
    "of": 5
  },

  // Cover stockée en blob chiffré dans `library_covers_entries`
  // (cf. §6). On ne garde ici qu'un pointeur logique.
  "cover_rid": "rec_cov_xyz",        // null si pas de cover

  // État et expérience personnelle.
  "status": "in_progress",           // planned | in_progress | finished | abandoned
  "format": "paper",                 // paper | ebook | audio | unknown
  "started_at": "2024-11-03",        // optionnel
  "finished_at": null,               // null tant que pas terminé
  "current_page": 318,               // utile pour status === in_progress
  "rating": 4,                       // 0..5, optionnel
  "tags": ["classique", "à offrir"], // libre, propre à la personne
  "is_favorite": false
}
```

> **Pas de tableau de relectures.** Si la personne relit, elle peut
> mettre à jour la note ou ajouter une review datée — mais on ne
> conserve pas l'historique des dates de lecture. C'est un comportement
> de machine, pas d'humain·e (validé 2026-04-26).

### 3.2 `library_reviews_entries` (notes & extraits)

Une œuvre peut avoir **plusieurs reviews datées**. C'est la place où
on consigne les extraits qu'on aime, les pensées en cours de
lecture, ou la fiche-bilan.

```jsonc
{
  "item_rid": "rec_abc123",          // requis — id de l'œuvre liée
  "date": "2025-01-08T19:42:00.000Z",
  "kind": "quote",                   // quote | note
  "title": "Chapitre 12 — Cosette",  // optionnel
  "content": "Markdown libre…",      // requis
  "page": 318,                       // optionnel (typique pour quote)
  "spoiler": false                   // toggle de masquage côté UI
}
```

- **`quote`** = un extrait du livre, souvent court, avec une page de
  référence. Reprend l'usage Passage : « les passages qu'on aime
  dans les livres qu'on lit ».
- **`note`** = tout le reste : réflexion en cours, fiche-bilan
  finale, impression, lien avec d'autres lectures…

L'UI rendra les deux différemment (italique + indentation pour les
quotes, prose normale pour les notes) sans forker le modèle.

### 3.3 `library_covers_entries` (couvertures, table dédiée)

```jsonc
{
  "item_rid": "rec_abc123",          // requis — clé de jointure
  "mime": "image/jpeg",
  "blob_b64": "/9j/4AAQSkZJRgABAQ…", // taille raisonnable (≤80 KB)
  "fetched_from": "openlibrary",     // info, peut être null
  "fetched_at": "2026-04-26T12:00:00Z"
}
```

> Table dédiée (plutôt qu'inline dans `library_items_entries`) pour
> garder les payloads d'items légers et permettre une suppression /
> re-fetch de la cover indépendamment.

---

## 4. Métadonnées externes — proxy Nodea

Architecture validée : **proxy via le serveur Nodea**. Les requêtes
client passent par `POST /library/lookup` côté API Nodea, qui :

1. Cache la réponse (clé : ISBN ou query normalisée).
2. Si miss, appelle le provider externe avec **la clé API de
   l'instance Nodea** (clé partagée par tous les utilisateur·ice·s
   de cette instance — pas par utilisateur·ice).
3. Renvoie au client le résultat normalisé.

Le provider externe ne voit qu'**une IP par instance Nodea** sans
corrélation entre comptes. Le serveur Nodea voit les recherches —
acceptable puisque la personne est aussi celle qui héberge.

### 4.1 Providers retenus

| Provider | Auth | Couverture | Notes |
|---|---|---|---|
| **Open Library** | aucune | très bonne, livres internationaux | par défaut |
| **Google Books** | clé API | bonne, résumés | utile pour les éditions récentes / françaises mal couvertes par OL |
| **BNF (data.bnf.fr)** | aucune | livres FR, autorité auteur | en complément, surtout pour la langue française |

> **Clé API partagée** : la valeur vit dans la config serveur
> (variable d'environnement type `LIBRARY_GOOGLE_BOOKS_API_KEY`).
> Aucun secret côté client.

### 4.2 Endpoints proxy (côté API Nodea)

```
POST /library/lookup/by-isbn      { "isbn": "9782070409228" }
POST /library/lookup/by-query     { "q": "les misérables hugo" }
GET  /library/cover/proxy?u=<...>  // optionnel — sert au download
                                   // d'une URL distante côté serveur
                                   // pour stockage en blob ensuite
```

Toutes les routes sont rate-limitées (alignées sur `auth/login`
~10/min/IP) et tracent les requêtes a minima (pas de payload, pas
d'utilisateur·ice).

### 4.3 Toggle Préférences

Une option dans Préférences permet de **désactiver complètement**
les appels externes (saisie manuelle uniquement). Par défaut activé.

---

## 5. Import

Sources, par priorité de support :

1. **Babelio** — CSV avec format confirmé (cf. §5.1).
2. **Inventaire.io** — service libre fédéré basé sur Wikidata
   ([inventaire.io](https://inventaire.io/)). Export disponible côté
   utilisateur·ice ; format à confirmer à l'implémentation. Bonus :
   les œuvres ont déjà des Wikidata IDs (Q-numbers) qui permettent
   de retrouver les métadonnées sans appeler Open Library.
3. **Goodreads** — CSV très standard et stable.
4. **The StoryGraph** — CSV.
5. **Format générique CSV** — colonnes mappables manuellement.

### 5.1 Format Babelio (confirmé)

Séparateur `;`, double-quotes autour de chaque champ, encodage
UTF-8. Header :

```
ISBN;Titre;Auteur;Editeur;Date de publication;Date d'entrée dans Babelio;Statut;Note
```

Mapping vers le schéma Nodea :

| Babelio | Nodea | Notes |
|---|---|---|
| `ISBN` | `providers.isbn13` ou `providers.isbn10` | détection par longueur (13 ou 10) |
| `Titre` | `title` | tel quel |
| `Auteur` | `creators[0].name` | Babelio livre `Nom Prénom` (« Hugo Victor »). On **flippe** et on met le NOM en **MAJUSCULES** → « Victor HUGO ». Convention valable partout dans Library (§3.1). |
| `Editeur` | `publisher` | tel quel |
| `Date de publication` | `year` | extraire `YYYY` depuis `YYYY-MM-DD` ; `0000-00-00` → `null` |
| `Date d'entrée dans Babelio` | (ignoré) | métadonnée Babelio, pas pertinent côté Nodea |
| `Statut` | `status` | `Lu` → `finished` ; `A lire` → `planned` ; `En cours` → `in_progress` |
| `Note` | `rating` | parseFloat puis arrondi sur 0..5 ; `0.0` est traité comme « pas de note » → `null` (Babelio met 0.0 par défaut quand non noté) |

> **Subtilité** : Babelio ne distingue pas « note 0 explicite » et
> « pas de note » — les deux sortent `0.0` dans l'export. Comme noter
> 0/5 explicitement est un usage très rare, on traite `0.0` comme
> « non noté ». Si la personne veut conserver les 0 explicites, on
> ajoutera un toggle à l'import.

### 5.1 Pipeline

```
fichier CSV
   │
   ▼
parser spécifique (Goodreads / Babelio / …)
   │  → normalise vers `library_items_entries`
   ▼
(optionnel) enrichissement métadonnées via /library/lookup
   │  → ISBN connu → fetch cover + page_count si manquants
   ▼
chiffrement local + upload (POST guard:"init" → PATCH promotion)
   │
   ▼
mapping reviews
   │  → "My Review" Goodreads → entrée `library_reviews_entries`
   │     kind="note"
   ▼
récap : X œuvres, Y reviews, Z doublons fusionnés sur ISBN
```

### 5.2 Déduplication

Clé de dédup, par ordre de priorité :
1. `providers.isbn13`
2. `providers.isbn10`
3. `(title, creators[0].name)` normalisés (lowercased, sans accents)
4. fallback : pas de fusion automatique, l'UI propose un merge manuel.

### 5.3 Format export Nodea

```jsonc
{
  "meta": { "version": 2, "exported_at": "2026-04-26T12:00:00Z", "app": "Nodea" },
  "modules": {
    "library_items": [ /* … schéma §3.1 … */ ],
    "library_reviews": [ /* … schéma §3.2 … */ ],
    "library_covers": [ /* … schéma §3.3 … */ ]
  }
}
```

---

## 6. Sécurité

- **Confidentialité** : titres, notes, ratings, tags, lus — tout est
  chiffré E2E. Le serveur stocke `payload` AES-GCM + `guard` HMAC.
- **Métadonnées externes** : voir §4. Le proxy serveur évite la
  fuite directe vers les providers ; le serveur Nodea voit les
  requêtes mais c'est l'instance auto-hébergée de la personne.
- **Couvertures** : blob chiffré local, pas de leak au rendu.
- **Imports** : fichier traité côté client, jamais transmis brut au
  serveur.

---

## 7. Stats & intégration Goals — V2

Possibilités évoquées, **hors MVP** :

- Compteur "X livres lus en 2026" sur Home + page Library.
- Heatmap des sessions de lecture (similaire à Mood).
- Goal "Lire 30 livres en 2026" auto-coché à `status: finished`.

À cadrer après le MVP. Rien n'est requis tant que la base ne marche
pas de bout en bout.

---

## 8. Tags — à laisser libre au MVP

Les tags restent **free-form** (chaîne libre, séparée par virgules
dans l'UI, suggestions sur les tags déjà utilisés — comme le
ThreadSuggestInput du Journal).

Une éventuelle taxonomie de genres pré-définie (roman / essai /
poésie / théâtre / BD / etc.) pourra être ajoutée plus tard si
l'usage le réclame, sans casser le format existant.

---

## 9. Décisions de cadrage (validées 2026-04-26)

| # | Sujet | Décision |
|---|---|---|
| Q1 | Périmètre média | **Livres only.** Audiovisuel = module séparé, ultérieur. |
| Q2 | Fetch métadonnées | **Proxy serveur** avec clé API partagée par instance Nodea. Toggle dans Préférences pour désactiver. |
| Q3 | Couvertures | **Blob chiffré** dans table dédiée `library_covers_entries`. |
| Q4 | Imports prioritaires | **Babelio** (format confirmé, cf. §5.1), **Inventaire.io**, puis **Goodreads** / **StoryGraph** / CSV générique. |
| Q5 | Migration Passage | **Wipe** des rows Passage existantes (données fakes). |
| Q6 | Multi-lectures | **Pas de tableau `reads[]`** — `started_at` / `finished_at` flat. |
| Q7 | Distinction reviews | **Deux kinds** : `quote` (extraits / passages) et `note` (le reste). |
| Q8 | Tags | **Libres** au MVP, pas de taxonomie pré-définie. |

---

## 10. Plan d'implémentation

### Phase 1 — Fondations (bouge déjà sans APIs externes)

- Schémas Zod dans `@nodea/shared` (`LibraryItemPayload`,
  `LibraryReviewPayload`, `LibraryCoverPayload`).
- Tables Drizzle + migration : `library_items_entries`,
  `library_reviews_entries`, `library_covers_entries`.
- Routes back via `collection-factory` (factory déjà en place pour
  les autres modules).
- Page K du module : liste des items + filtres (status, tags,
  favoris) + détail item avec ses reviews. Réutilise le
  MarkdownEditor du Journal pour les reviews.
- Composer pour ajout / édition manuelle d'item + review.
- Wipe des données Passage (script `seed:wipe-passage` ou
  équivalent) + retrait du module Passage côté front (modules_list,
  sidebar, store, i18n).

### Phase 2 — Proxy métadonnées

- Endpoint API `/library/lookup/by-isbn` + `/library/lookup/by-query`.
- Cache en mémoire (ou Redis si dispo) côté serveur.
- Adaptateur Open Library (sans clé), Google Books (clé env),
  BNF (sans clé).
- Toggle Préférences "Métadonnées externes" + bandeau d'info.
- Composer enrichi : "Chercher par ISBN ou titre…" → résultats →
  click → préremplit le formulaire.

### Phase 3 — Couvertures

- Endpoint `/library/cover/proxy` pour download serveur d'une URL
  distante (évite le mixed-content + leaks d'IP côté client).
- Récupération automatique au moment de l'ajout d'un item.
- Stockage blob chiffré → table `library_covers_entries`.

### Phase 4 — Imports

- Parser **Babelio** CSV (format confirmé §5.1).
- Parser **Inventaire.io** (à confirmer à l'implémentation —
  l'export est probablement JSON avec Wikidata IDs).
- Parser **Goodreads** CSV.
- Parser **StoryGraph** CSV.
- Parser **CSV générique** avec mapping de colonnes.
- UI d'import : upload → preview → mapping → progress + récap.

---

## 11. Références

- Composer / éditeur Markdown réutilisé : `packages/web/src/ui/dirk/ComposerModal.tsx`
- Page modèle K : `packages/web/src/app/flow/Journal/index.tsx`
  (liste groupée + Markdown viewer)
- Pattern `collection-client` : `packages/web/src/core/api/modules/collection-client.ts`
- Factory routes back : `packages/api/src/routes/collection-factory.ts`
