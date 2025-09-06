# SECURITY

Ce document décrit les mécanismes de sécurité de Nodea.  
Il explique les choix faits, leur rôle, et le fonctionnement attendu côté client et serveur.

## 1. Principes fondamentaux

- **Chiffrement de bout en bout (E2E)**  
  Toutes les données utilisateurs sont chiffrées **avant** d’être envoyées au serveur.  
  Le serveur **ne voit jamais** le contenu clair. Il ne stocke que des blobs chiffrés (`payload`) et les métadonnées nécessaires pour la synchronisation.

- **Séparation des clés**  
  - Chaque utilisateur possède une **mainKey**, dérivée de son mot de passe.  
  - Chaque module activé génère un **module_user_id** (clé secondaire opaque).  
  - Le serveur ne connaît ni la mainKey ni les clés dérivées.

- **Intégrité**  
  Les modifications et suppressions sont protégées par un **guard** (HMAC) que seul le client peut calculer, car il nécessite la mainKey.  
  → Cela empêche tout tiers (y compris l’admin serveur) de modifier ou supprimer des entrées sans la clé de l’utilisateur.


## 2. Dérivation des clés

- **Entrée utilisateur** : email + mot de passe.  
- **Sel (salt)** : généré et stocké lors de la création du compte (champ `encryption_salt` côté serveur).  
- **Dérivation** :  
  - Utilisation d’Argon2id via WebCrypto.  
  - Paramètres choisis pour résister au brute force (mémoire, itérations).  
  - Résultat : une **mainKey** 256 bits.

Cette mainKey n’est jamais transmise au serveur. Elle reste en mémoire uniquement côté client.


## 3. Chiffrement des données

Chaque enregistrement (entrée d’un module) contient :  
- `payload` : JSON clair (dépend du module) → chiffré avec AES-GCM et encodé en base64url.  
- `cipher_iv` : vecteur d’initialisation aléatoire (12 octets).  
- `module_user_id` : identifiant secondaire (lié à l’utilisateur, mais opaque).  

**Algorithme** :  
- AES-256-GCM, clé dérivée de la mainKey.  
- IV généré aléatoirement à chaque chiffrement.  
- Auth tag intégré (GCM).  

**Important** : tout le contenu métier (titres, notes, catégories, etc.) est dans `payload` chiffré.  
Le serveur ne voit que : `{ id, module_user_id, payload (opaque), cipher_iv, guard (hidden), created, updated }`.


## 4. Guard (intégrité et autorisations)

Chaque entrée possède un champ `guard`.  
- C’est un **HMAC déterministe**, caché côté serveur (champ hidden).  
- Calcul :  

``` json
guard = "g\_" + HMAC( HMAC(mainKey, "guard:" + module\_user\_id), id )
```

- Utilité :  
- **Création** : se fait en deux temps. On poste avec `guard:"init"`, puis on “promote” en calculant le vrai guard.  
- **Update/Delete** : requièrent le passage de `?sid=<module_user_id>&d=<guard>`.  
  → Si le guard calculé côté client ne correspond pas à celui stocké, l’opération est rejetée.

Le serveur ne renvoie jamais le champ `guard`. Seul le client peut le recalculer.


## 5. Flux d’opérations

### Création (2 temps)
1. **POST init**  

``` json
POST /<module>\_entries
{ module\_user\_id, payload, cipher\_iv, guard:"init" }
```
→ crée une entrée provisoire.

2. **PATCH promotion**  
3. 

``` json
PATCH /<module>\_entries/<id>?sid=\<module\_user\_id>\&d=init
{ guard: "\<guard\_calculé>" }
```

→ remplace `init` par le vrai guard calculé côté client.

### Lecture
- `GET /<module>_entries?sid=<module_user_id>`  
- Retourne : `id, payload (chiffré), cipher_iv, created, updated`.  
- Ne retourne jamais : guard, mainKey, clair.

### Mise à jour
- `PATCH /<module>_entries/<id>?sid=<sid>&d=<guard>`  
- Requiert : le bon `guard` calculé par le client.

### Suppression
- `DELETE /<module>_entries/<id>?sid=<sid>&d=<guard>`  
- Même principe : sans guard correct → rejet.


## 6. Export / Import

### Export
- Produit côté client, en clair, lisible.  
- Format commun :

```json
{
 "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
 "modules": {
   "<module>": [ ...payloads clairs... ]
 }
}
```
* Exporte uniquement les payloads clairs.
* N’exporte jamais : `id`, `cipher_iv`, `guard`.

### Import

* Lit le JSON clair.
* Pour chaque entrée :

  * Chiffre localement avec mainKey → payload + cipher\_iv.
  * Crée avec `guard:"init"`.
  * Promote en 2 temps pour recalculer le guard.


## 7. Invariants transverses

* **Confidentialité** : tout est chiffré côté client, serveur ignorant.
* **Intégrité** : toute modification/suppression nécessite un guard correct, donc la mainKey.
* **Portabilité** : export clair lisible et réimportable.
* **Homogénéité** : tous les modules (Mood, Goals, Habits, Library, Review) utilisent la même logique.


## 8. Points d’attention pour les devs

* Toujours générer un **IV unique** pour chaque chiffrement.
* Ne jamais logguer ou stocker en clair les payloads.
* `guard` doit rester caché : il ne sort jamais du serveur.
* Les erreurs d’update/delete viennent souvent d’un `guard` incorrect (mauvaise clé, mauvais sid, ou id non trouvé).
* À l’import, vérifier la version (`meta.version`) pour compatibilité.

## 8. Métadonnées non sensibles (onboarding)

En plus des blobs chiffrés, le serveur peut stocker des **métadonnées techniques non sensibles** pour l’expérience utilisateur, notamment les champs d’onboarding dans `users` :

- `onboarding_status`
- `onboarding_version`

Ces champs :
- n’exposent aucun contenu utilisateur, aucune clé et aucun guard.  
- ne sont pas concernés par le chiffrement E2E.  
- servent uniquement à piloter l’UX de connexion (affichage ou non de la modale d’onboarding).

⚠️ Le modèle E2E et les invariants de sécurité restent inchangés :  
le serveur n’a jamais accès aux données en clair, ni aux clés.
