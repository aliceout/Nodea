# Conditions générales d'utilisation — Nodea

> **Statut** : brouillon. Ces CGU sont une **ébauche de travail**, pas
> un document juridique signé. Elles sont publiées ici pour que les
> utilisateur·ice·s sachent à quoi s'attendre en attendant la version
> finale revue par un·e juriste. Les engagements ci-dessous reflètent
> les choix techniques déjà en place dans le code (cf. la section
> « Conservation des données et RGPD » de
> [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
> pour la matrice technique), pas des promesses futures.
>
> **Tu auto-héberges Nodea ?** Ces CGU s'appliquent à l'instance
> officielle uniquement. Sur ton instance, tu es l'opérateur — c'est
> toi qui décides du cadre que tu proposes à tes utilisateur·ice·s
> (et qui réponds devant la loi du pays où ton serveur tourne).

---

## 1. Qui propose le service

L'instance officielle Nodea est gérée par l'équipe Nodea
(coordonnées de contact : à renseigner). Le code source complet est
publié sur [github.com/aliceout/Nodea](https://github.com/aliceout/Nodea)
sous licence open-source ([`LICENSE`](../LICENSE)).

## 2. Ce que tu nous confies

Quand tu crées un compte, tu nous confies :
- Une adresse email (pour t'envoyer les liens d'activation /
  récupération).
- Un identifiant choisi.
- Le contenu chiffré de tes entrées (journal, habitudes, livres…).
  **Le serveur ne voit jamais le contenu en clair.** Le chiffrement
  se fait dans ton navigateur, avec une clé dérivée de ton mot de
  passe — clé que nous n'avons pas, ne pouvons pas obtenir, et ne
  pouvons pas restaurer si tu la perds.

Pour les détails techniques, voir
[`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech).

## 3. Ce qu'on s'engage à faire

- **Pas de monétisation de tes données.** Pas de pub, pas de revente,
  pas de profilage marketing.
- **Pas d'entraînement IA sur tes données.** Pas une promesse posée
  dans un coin — par construction : on n'a pas accès à tes contenus.
- **Conservation minimale.** Voir la matrice de rétention dans
  [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
  (section « Matrice de rétention »). En résumé :
  tant que ton compte existe, on garde ce qui est nécessaire au
  service ; quand tu supprimes ton compte, **tout** part avec.
- **Suppression complète à la demande.** L'option « Supprimer mon
  compte » dans les paramètres déclenche une suppression atomique en
  base. Pas de soft-delete, pas de récupération possible. Voir
  [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
  (section « Droit à l'effacement »).
- **Portabilité.** Tu peux exporter tous tes contenus en clair (JSON
  déchiffré côté navigateur) depuis l'écran Compte → Export.
- **Préavis raisonnable** en cas d'arrêt du service hébergé. Le code
  étant open-source, tu peux toujours migrer vers ta propre instance.

## 4. Ce que tu acceptes

- Tu ne fais pas tourner sur l'instance officielle des contenus
  illégaux dans la juridiction où le serveur est hébergé (France
  pour l'instance officielle aujourd'hui). Comme on ne lit pas tes
  contenus, on ne peut pas les modérer en amont — c'est ta
  responsabilité.
- Tu acceptes que la perte de ton mot de passe **et** de ton code de
  récupération entraîne la perte définitive d'accès à tes données.
  C'est mathématique, pas une politique : sans la clé dérivée du mot
  de passe ou du code de récupération, les blobs chiffrés sont
  irrécupérables. Génère ton code de récupération dès l'inscription.
- Tu utilises le service sous ta propre responsabilité. Aucune SLA,
  aucune garantie de disponibilité 24/7 sur l'instance officielle
  hébergée gracieusement.

## 5. Logs et télémétrie

- **Logs serveur** : une ligne par requête HTTP (méthode, chemin,
  code de retour, durée). Aucun corps, aucun cookie, aucune session
  ID. Rotation à 7 jours. Voir
  [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
  (section « Logs serveur »).
- **Sentry** (optionnel, activé par l'opérateur) : reçoit la stack
  trace + la route + le code statut quand une erreur survient.
  `beforeSend` strippe cookies, query strings, body, headers et user
  avant envoi. Voir
  [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
  (section « Télémétrie Sentry »).
- **Aucun analytics tiers**, aucun pixel de tracking, aucun
  fingerprinting.

## 6. Adresses email transactionnelles

L'envoi d'emails (activation, reset, code de récupération) passe par
le serveur SMTP configuré par l'opérateur. Sur l'instance officielle,
c'est un fournisseur transactionnel européen. Le contenu de l'email
ne révèle rien de tes données chiffrées (juste un lien vers une
page de confirmation).

## 7. Modification de ces CGU

Toute modification matérielle sera annoncée :
- Par email aux comptes actifs.
- Par une bannière in-app pendant au moins 14 jours avant
  l'application.
- Dans l'historique git du dépôt — chaque commit qui touche
  ce fichier porte la modification.

Les modifications cosmétiques (typos, reformulations) peuvent passer
sans préavis.

## 8. Contact

- Bug, question technique : ouvrir une issue sur
  [le dépôt GitHub](https://github.com/aliceout/Nodea/issues).
- Question RGPD ou demande d'exercice de droits : à renseigner avec
  une adresse de contact dédiée quand les CGU passent en V1.

---

## Annexe — Glossaire

- **E2E (end-to-end encrypted)** — chiffré du début à la fin : le
  serveur stocke des blobs illisibles sans la clé qui ne quitte
  jamais ton navigateur.
- **KEK (Key Encryption Key)** — clé qui sert à chiffrer ta clé
  principale. Dérivée localement de ton mot de passe via OPAQUE.
- **Code de récupération** — 12 mots type BIP39 affichés une seule
  fois à l'inscription. Permet de retrouver ton compte si tu oublies
  ton mot de passe. **À noter dans un endroit sûr.**
- **OPAQUE** — protocole d'authentification asymétrique : prouve que
  tu connais le mot de passe sans jamais le transmettre au serveur.
- **Self-hosting** — héberger ta propre instance Nodea sur ton
  serveur. Le code, la doc et les Dockerfiles sont publics.
