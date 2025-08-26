
 # 🍃 Nodea — Suivi personnel chiffré
 
 **Nodea** est une application web pour suivre sa propre vie, ses envies, ses objectifs, son humeur, etc
 Toutes les données sont **chiffrées côté client** avant d’être envoyées au serveur : toi seul·e peux les lire, même l’admin n’y a jamais accès.
 
 ---
 
 ## Principes
 
 - **Confidentialité réelle** : chiffrement de bout en bout, personne d’autre que toi ne peut lire tes écrits.
 - **Journal quotidien** : trois points positifs obligatoires, humeur (score  emoji), question du jour aléatoire, commentaire libre.
 - **Aucune analyse automatique, aucun tracking, aucun partage des données** : tu restes propriétaire de tout ce que tu écris.
 - **Interface minimaliste, rapide et accessible.**
 
 ---
 
 ## Stack technique
 
 - **Frontend** : React, TailwindCSS
 - **Backend** : PocketBase auto-hébergé
- **Chiffrement** :  *(voir [Security.md](documentation/Security.md))*  
   - AES-GCM (WebCrypto), avec dérivation de clé via Argon2.
   - Tous les contenus sensibles sont chiffrés côté client : positifs, humeur, emoji, question/réponse, commentaire.
   - La clé principale est dérivée du mot de passe et stockée chiffrée avec un salt unique. Aucune donnée sensible ne circule ou n’est stockée en clair.
 - **Pas de tracking, pas d’export admin, ni d’API publique.**
 
---

## Modules (en plus du journal)

- **Mood** : suivi de positivités journalière
- **Goals** : objectifs annuels (liste simple, statut)  
- **Habits** : habitudes  occurrences datées (pour une heatmap locale)  
- **Library** : œuvres (livres/films/séries)  fiches de lecture datées  
- **Review** : bilan annuel type YearCompass (parcours guidé)

Ces modules suivent tous la même structure de base (`<module>_entries`) décrite dans [Modules.md](documentation/Modules.md) et [Database.md](documentation/Database.md). 

 ---
 
 ## Fonctionnement du chiffrement
 
 - Toutes les données sont chiffrées localement dans le navigateur, avant envoi.
 - Le chiffrement utilise l’API WebCrypto en mode AES-GCM.
 - La clé est dérivée via Argon2 à partir du mot de passe utilisateur·ice et d’un salt unique.
 - La clé principale sert à chiffrer/déchiffrer les données du journal. Elle est elle-même stockée chiffrée côté serveur.
 - Même l’admin n’a jamais accès à tes données, même avec un dump complet de la base.
 - L’export se fait localement en données déchiffrées, à la demande.
 
Pour les détails (E2E, HMAC *guard*, création en 2 temps, export/import), consulte [Security.md](documentation/Security.md). 

 
 ## Installation

### Prérequis

- Node.js >= 18
- PocketBase (serveur à installer localement ou sur un serveur dédié)

### Déploiement local

1. **Cloner le repo**  
   ```bash
   git clone https://github.com/aliceout/Nodea.git
   cd Nodea
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
   ``` url
   http://localhost:5173
   ```
   ---
 ## Sécurité et limites
 
 - **La sécurité dépend de la force du mot de passe**.
 - **Perte du mot de passe = perte irrémédiable des données** (aucune récupération possible).
 - **Aucune sauvegarde serveur** : exporter régulièrement tes données si besoin.
 - **Pas d’application mobile native** mais utilisable sur mobile via navigateur.
 
---

## Documentation

- **Vue d’ensemble des modules** : [Modules.md](documentation/Modules.md) :contentReference[oaicite:9]{index=9}  
- **Structure de la base (PocketBase)** : [Database.md](documentation/Database.md) :contentReference[oaicite:10]{index=10}  
- **Sécurité (E2E, guard HMAC, 2-temps, export/import)** : [Security.md](documentation/Security.md) :contentReference[oaicite:11]{index=11}  
- **Fiches détaillées** : `documentation/Modules/` →  
  - [Mood.md](documentation/Modules/Mood.md) · [Goals.md](documentation/Modules/Goals.md) · [Habits.md](documentation/Modules/Habits.md) · [Library.md](documentation/Modules/Library.md) · [Review.md](documentation/Modules/Review.md)

 ---
 
 ## Crédits
 
 Développé par aliceout
 Projet open source, sous licence Mozilla Public License 2.0
