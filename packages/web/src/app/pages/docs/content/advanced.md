## Le principe en une phrase

Ton mot de passe ne sort jamais de ton navigateur ; il sert à dériver localement la clé qui chiffre / déchiffre tes données. Le serveur stocke des fichiers chiffrés et la preuve cryptographique que c'est bien toi — jamais ta clé, jamais ton mot de passe.

## Au login : OPAQUE, ou comment prouver son mot de passe sans l'envoyer

La méthode classique pour se connecter, c'est d'envoyer le mot de passe au serveur qui le compare à un hash. Ça veut dire que pendant quelques millisecondes, le serveur a le mot de passe en clair en mémoire. Ça veut dire aussi qu'un serveur malicieux pourrait le collecter.

Nodea utilise **OPAQUE**, un protocole d'échange qui permet de prouver qu'on connaît un mot de passe **sans jamais l'envoyer**. Ton navigateur et le serveur échangent quelques messages cryptographiques ; à la fin, le serveur sait que tu connais le bon mot de passe, mais lui ne le connaît toujours pas. C'est le cœur de la sécurité du login chez Nodea.

En sortie d'OPAQUE, ton navigateur récupère une clé temporaire qui n'existe qu'à ce moment-là. Cette clé sert à déverrouiller ta clé maîtresse — celle qui chiffre / déchiffre tes entrées. Une fois déverrouillée, la clé maîtresse vit en mémoire le temps de la session ; elle n'est jamais écrite sur le disque, jamais envoyée au serveur.

## Ce que voit ton navigateur, ce que voit le serveur

**Côté navigateur** : la clé maîtresse en mémoire (jamais écrite sur le disque), le contenu de tes entrées en clair pour que tu puisses les lire / éditer, et tout ce qu'il faut pour chiffrer une nouvelle entrée avant de l'envoyer.

**Côté serveur** : pour chaque entrée, un identifiant opaque (sid), un blob chiffré (AES-GCM), un IV aléatoire, et une empreinte HMAC qu'on appelle « guard » — calculée à partir de ta clé maîtresse, qui empêche quiconque sans la clé de modifier une entrée. **Pas de référence directe à ton compte.** Le mapping « ce sid appartient à cet user » vit lui-même chiffré ailleurs ; le serveur ne sait jamais à qui appartient une entrée. Et **pas de timestamps colonnes** non plus : si une entrée a une date, elle est dedans le blob chiffré, jamais en clair côté DB.

<aside class="docs-diagram-browser-vs-server"></aside>

## Ce qui transite sur le réseau

Entre ton navigateur et le serveur Nodea, deux types de paquets seulement :

- **Pendant le login** — les messages du protocole OPAQUE (des points sur une courbe elliptique, des challenges aléatoires). Pas le mot de passe, pas la clé maîtresse, pas la clé temporaire dérivée d'OPAQUE.
- **Pendant l'usage** — des blobs déjà chiffrés (cipher + IV + guard), associés à un sid opaque. Le serveur les stocke ou les renvoie tels quels ; il ne les déchiffre jamais.

Le tout passe par HTTPS — donc une seconde couche de chiffrement protège même les métadonnées de la requête. Un attaquant qui sniffe le réseau voit du bruit chiffré deux fois, pas du contenu.

## Code de récupération : la deuxième porte

Le mot de passe peut s'oublier. Juste après ton inscription, Nodea te propose — et te le recommande très fortement — de configurer un code de 12 mots (BIP39 — la même liste de mots que les portefeuilles crypto, choisie pour être mémorisable et résistante aux fautes de frappe).

Ces 12 mots dérivent une **seconde** clé qui déchiffre une copie séparée de cette même clé maîtresse. Le serveur ne stocke jamais les 12 mots — il stocke un hash anti-DoS pour valider la requête, mais les mots eux-mêmes ne sont jamais envoyés en clair (même principe qu'OPAQUE).

Quand tu utilises ce code pour te récupérer, tu choisis un nouveau mot de passe, et ta clé maîtresse reste la même — donc **tes anciennes données restent lisibles**. C'est différent du « reset password » classique qui efface tout : ici, on rotate uniquement les enveloppes autour de la clé.

<aside class="docs-diagram-recovery-doors"></aside>

## Passkeys : login sans mot de passe

Une passkey, c'est une clé cryptographique stockée dans un appareil que tu possèdes physiquement — l'enclave sécurisée de ton iPhone (Touch ID / Face ID), ton Mac avec Touch ID, Windows Hello, ou une clé matérielle type Yubikey. Au login, ton appareil prouve qu'il a la clé sans jamais l'envoyer ; quelque chose qu'on ne peut pas phisher comme un mot de passe.

Tu peux enrôler une ou plusieurs passkeys depuis *Compte → Sécurité*, en remplacement ou en complément de ton mot de passe.

**Si ta passkey supporte PRF** (la plupart des modèles récents — iPhone iOS 17+, Yubikey 5, Mac récent…), elle fait le boulot complet : login *et* déchiffrement de la clé maîtresse. Tu n'as plus besoin de retaper ton mot de passe à chaque session.

**Si ta passkey ne supporte pas PRF** (modèle plus ancien, ou support partiel), elle te connecte au login, mais Nodea te demande ton mot de passe une fois pour déchiffrer la clé maîtresse. Le mot de passe reste indispensable au démarrage de la session ; la passkey ne fait que sécuriser la phase d'authentification.

## Et la double authentification ?

Si tu veux une couche de sécurité supplémentaire, tu peux exiger un deuxième facteur en plus de ton mot de passe (ou de ta passkey). Trois niveaux au choix dans *Compte → Sécurité* :

- **Mot de passe ou passkey** — défaut, un seul facteur suffit.
- **Avec TOTP** — il faut aussi un code à 6 chiffres généré par ton app TOTP (Aegis, Google Authenticator, 1Password…).
- **Maximum** — il faut TOTP *et* passkey, les deux. Réservé si tu manipules des données très sensibles.

Le déchiffrement local fonctionne en escalier (« stepped MFA ») : ta clé maîtresse n'est dérivée qu'une fois tous les facteurs requis prouvés. Si tu perds un facteur (téléphone TOTP cassé, par exemple), un mécanisme de bypass à 7 jours te permet de revenir en arrière sans perdre tes données — détails dans l'onglet *Sous le capot*.

## Quand je supprime, qu'est-ce qui disparaît ?

**Suppression d'une entrée** — le client efface la ligne en base via une requête authentifiée. Plus de blob, plus de guard. Aucune rétention « au cas où ».

**Suppression du compte** — la ligne `users` disparaît, les sessions sont invalidées, et toutes tes clés (wrappées par mot de passe / par passkey / par recovery) partent avec. Les blobs des modules restent **techniquement** quelques temps en base mais deviennent illisibles pour toujours puisque les clés pour les ouvrir ont été détruites — c'est par design : pas besoin de cascade brutale, le chiffrement les rend morts. Un nettoyage périodique côté serveur les supprime physiquement.

Concrètement : une fois ton compte fermé, même un dump SQL postérieur ne donnerait à personne le contenu de tes anciennes entrées — la clé n'existe plus nulle part.

## Qui peut voir quoi côté serveur — ce qui change à ce niveau de détail

L'onglet *L'essentiel* a couvert les trois acteurs et ce qu'ils voient en clair. Quelques précisions techniques pour qui veut creuser :

**L'équipe Nodea** voit ton email en clair (c'est l'identifiant OPAQUE — il faut bien le matcher au login), tes heures de connexion, ton rôle (`user` / `admin`), ton mode de sécurité, et le label de tes passkeys. En revanche elle ne sait **pas** quels modules *toi* tu utilises, ni quelle entrée t'appartient : les entries n'ont pas de `user_id`, le nom de collection voyage dans un en-tête `X-Collection` que les logs n'enregistrent pas, et la correspondance user→sid vit chiffrée dans `modules_config`. Tout au plus un comptage agrégé par module (« 1247 entrées Mood », tous comptes confondus).

**L'hébergeur** voit tout ça plus le filesystem, la RAM du process, et le journal d'écritures Postgres (WAL). Avec le WAL on peut faire du *forensic statistique* — « ces deux lignes ont été écrites à 50 ms d'écart sur deux tables → probablement même user ». Pas du plain SQL, mais reconstructible si on s'en donne la peine. C'est aussi l'hébergeur qui a la possibilité de servir un bundle JS modifié (voir section *Serveur compromis* ci-dessous).

**Une réquisition judiciaire** récolte exactement ce que l'équipe voit en SQL : email, heures de connexion, IP, blobs chiffrés, hashes. **Pas la clé maîtresse** — elle n'est nulle part côté serveur. Sortie pratique : « voilà l'email du compte et ses fichiers chiffrés ; bon courage pour les ouvrir ».

**Auto-héberge** si ces vecteurs te préoccupent — l'équipe et l'hébergeur deviennent toi (à condition que ton serveur soit lui-même bien tenu).

## Le scénario qu'on ne peut pas neutraliser : le serveur compromis

Soyons honnêtes sur les limites. Le code qui chiffre tes données est servi par le serveur. Si quelqu'un prend le contrôle du serveur (intrusion, compromission de la chaîne de build, employé malveillant chez l'hébergeur…), il pourrait remplacer le JavaScript par une version qui exfiltre ton mot de passe au moment où tu te connectes.

Cette limite est **inhérente à toute application web** chiffrée bout-en-bout — pas spécifique à Nodea. Bitwarden, Standard Notes, Cryptee partagent la même limite.

Ce qu'on fait pour la mitiger :

- **Subresource Integrity** — le HTML qui charge le JavaScript principal contient une empreinte cryptographique du fichier ; si le JS est modifié, le navigateur refuse de l'exécuter.
- **Manifest `INTEGRITY.txt`** — chaque release publie les empreintes de tous les fichiers du bundle. Concrètement : ouvre `https://ton-instance.tld/INTEGRITY.txt`, compare avec celui publié sur la release GitHub correspondante. Si les hashes divergent, le bundle a été modifié — préviens l'opérateur, ou cesse d'utiliser l'instance le temps que ce soit éclairci.
- **Recommandation auto-hébergement** — si tu manipules des données très sensibles, fais tourner ta propre instance. Tu réduis drastiquement la surface (ton serveur, tes employé·es… toi-même).

On n'a pas la prétention de neutraliser ce scénario. On le documente, on borne ses dégâts, et on te donne les outils pour le détecter.

<aside class="docs-hint">

Tu veux le threat model formel, les algos figés, et les détails crypto auditables ? L'onglet **« Sous le capot »** a tout — avec liens vers la spec exhaustive et le code.

</aside>
