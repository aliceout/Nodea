# 🍃 Nodea — Journal positif chiffré

**Nodea** est une application web pour écrire chaque jour trois points positifs, noter son humeur et répondre à une question originale.  
Toutes les données sont **chiffrées côté client** avant d’être envoyées au serveur : toi seul·e peux les lire, même l’admin n’y a jamais accès.

---

## Principes

- **Confidentialité réelle** : chiffrement de bout en bout, personne d’autre que toi ne peut lire tes écrits.
- **Journal quotidien** : trois points positifs obligatoires, humeur (score + emoji), question du jour aléatoire, commentaire libre.
- **Aucune analyse automatique, aucun tracking, aucun partage des données** : tu restes propriétaire de tout ce que tu écris.
- **Interface minimaliste, rapide et accessible.**

---

## Stack technique

- **Frontend** : React, TailwindCSS
- **Backend** : PocketBase auto-hébergé
- **Chiffrement** :  
  - AES-GCM (WebCrypto), avec dérivation de clé via Argon2.
  - Tous les contenus sensibles sont chiffrés côté client : positifs, humeur, emoji, question/réponse, commentaire.
  - La clé principale est dérivée du mot de passe et stockée chiffrée avec un salt unique. Aucune donnée sensible ne circule ou n’est stockée en clair.
- **Pas de tracking, pas d’export CSV ni d’API publique.**

---

## Fonctionnement du chiffrement

- Toutes les données sont chiffrées localement dans le navigateur, avant envoi.
- Le chiffrement utilise l’API WebCrypto en mode AES-GCM.
- La clé est dérivée via Argon2 à partir du mot de passe utilisateur·ice et d’un salt unique.
- La clé principale sert à chiffrer/déchiffrer les données du journal. Elle est elle-même stockée chiffrée côté serveur.
- Même l’admin n’a jamais accès à tes données, même avec un dump complet de la base.
- L’export se fait localement en données déchiffrées, à la demande.

---

## Fonctionnalités

- **Entrée quotidienne** (3 positifs, humeur, question, commentaire)
- **Historique** : filtrage, suppression d’entrées
- **Graphique** : humeur sur 6 mois glissants
- **Export** : téléchargement de toutes tes données en JSON
- **Gestion du compte** : email, mot de passe, suppression, export
- **Admin** : gestion utilisateurs et invitations

---

## Installation

### Prérequis

- Node.js >= 18
- PocketBase (serveur à installer localement ou sur un serveur dédié)

### Déploiement local

1. **Cloner le repo**  
   ```bash
   git clone https://github.com/aliceout/daily.git
   cd daily
   ```
2. **Installer les dépendances**
    Installer les dépendances
   ```bash
   npm install
   ```
3. **Installer et lancer PocketBase**
- Télécharger PocketBase depuis pocketbase.io
- Lancer PocketBase sur le port 8090
   ```bash
   ./pocketbase serve
   ```


4. **Configurer l’environnement**
- Créer un fichier .env à la racine avec :
   ```ini
   VITE_PB_URL=<Adress of pocketbase>
   ```
5. **Lancer l’application**
   ```bash
   npm run dev
   ```
6. **Ouvrir dans ton navigateur**

   http://localhost:5173

   ---

## Sécurité et limites

- **La sécurité dépend de la force de ton mot de passe**.
- **Perte du mot de passe = perte irrémédiable des données** (aucune récupération possible).
- **Aucune sauvegarde serveur** : exporte régulièrement tes données si besoin.
- **Pas d’application mobile native** pour l’instant, mais utilisable sur mobile via navigateur.

---

## Roadmap

- Module **Goals** de suivi des objectifs annuels
- Module **Review** qui s'inspire du projet [YearCompass](https://yearcompass.com)

---

## Crédits

Développé par aliceout
Projet open source, sous licence Mozilla Public License 2.0
