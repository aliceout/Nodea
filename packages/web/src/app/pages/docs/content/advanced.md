## Le principe en une phrase

Ton mot de passe ne sort jamais de ton navigateur ; il sert à dériver localement la clé qui chiffre / déchiffre tes données. Le serveur stocke des fichiers chiffrés et la preuve cryptographique que c'est bien toi — jamais ta clé, jamais ton mot de passe.

## Au login : OPAQUE, ou comment prouver son mot de passe sans l'envoyer

La méthode classique pour se connecter, c'est d'envoyer le mot de passe au serveur qui le compare à un hash. Ça veut dire que pendant quelques millisecondes, le serveur a le mot de passe en clair en mémoire. Ça veut dire aussi qu'un serveur malicieux pourrait le collecter.

Nodea utilise **OPAQUE**, un protocole d'échange conçu pour qu'on prouve qu'on connaît un mot de passe **sans jamais l'envoyer**. Ton navigateur et le serveur échangent quelques messages cryptographiques ; à la fin, le serveur sait que tu connais le bon mot de passe, mais lui ne le connaît toujours pas. C'est le cœur de la sécurité du login chez Nodea.

En sortie d'OPAQUE, ton navigateur récupère une clé — la *clé d'export* — qui n'existe que là, à ce moment-là. Cette clé sert à déchiffrer une seconde clé (la « KEK » : key encryption key) qui elle-même chiffre la clé maîtresse de tes données. Trois étages de clés au total ; le détail vit dans l'onglet Tech sécu.

## Ce que voit ton navigateur, ce que voit le serveur

**Côté navigateur** : la clé maîtresse en mémoire (jamais écrite sur le disque), le contenu de tes entrées en clair pour que tu puisses les lire / éditer, et tout ce qu'il faut pour chiffrer une nouvelle entrée avant de l'envoyer.

**Côté serveur** : pour chaque entrée, un identifiant opaque (sid), un blob chiffré (AES-GCM), un IV aléatoire, et une empreinte HMAC qu'on appelle « guard » — calculée à partir de ta clé maîtresse, qui empêche quiconque sans la clé de modifier une entrée. **Pas de référence directe à ton compte.** Le mapping « ce sid appartient à cet user » vit lui-même chiffré ailleurs ; le serveur ne sait jamais à qui appartient une entrée. Et **pas de timestamps colonnes** non plus : si une entrée a une date, elle est dedans le blob chiffré, jamais en clair côté DB.

## Code de récupération : la deuxième porte

Le mot de passe peut s'oublier. Pour ne pas perdre tes données, Nodea génère à l'inscription un code de 12 mots (BIP39 — la même liste de mots que les portefeuilles crypto, choisie pour être mémorisable et résistante aux fautes de frappe).

Ces 12 mots dérivent une **seconde** clé qui déchiffre une copie séparée de ta KEK. Le serveur ne stocke jamais les 12 mots — il stocke un hash anti-DoS pour valider la requête, mais les mots eux-mêmes ne sont jamais envoyés en clair (même principe qu'OPAQUE).

Quand tu utilises ce code pour te récupérer, tu choisis un nouveau mot de passe, et ta clé maîtresse reste la même — donc **tes anciennes données restent lisibles**. C'est différent du « reset password » classique qui efface tout : ici, on rotate uniquement les enveloppes autour de la clé.

## Passkeys : pour les utilisations courantes, les passkeys peuvent même être plus sûres qu'un mot de passe

Tu peux ajouter une passkey (Touch ID, Face ID, Windows Hello, Yubikey…) comme méthode de connexion à la place ou en complément du mot de passe.

**Si ta passkey supporte PRF** (la plupart des passkeys modernes), elle peut déchiffrer tes données toute seule, comme le ferait ton mot de passe. **Sinon**, elle te connecte mais le déchiffrement nécessite encore ton mot de passe (Nodea le détecte et te le demande à ce moment-là).

## Qui peut voir quoi côté serveur

Trois acteurs avec des privilèges différents. Pour chacun, ce qu'il voit en clair, ce qu'il ne voit pas.

**L'équipe Nodea** (l'opérateur de l'instance) — accès SQL direct au serveur. Voit ton email (c'est l'identifiant OPAQUE, en clair), ton nom d'affichage, ton rôle (`user` / `admin`), ton mode de sécurité, tes heures de connexion, les passkeys enrôlées (avec leur label), les annonces, les invitations, la configuration globale. Voit que tu utilises tel module en agrégat (pas par user — les entrées modules ne portent pas de référence à ton compte). **Ne voit pas** ton mot de passe (OPAQUE), tes payloads chiffrés (modules_config, user_preferences, contenu des modules), ni quelle entrée appartient à quel user.

**L'hébergeur** (cloud provider, sysadmin avec root sur le serveur). Voit tout ce que voit l'équipe Nodea, plus le filesystem, la mémoire RAM du process, les logs Postgres bas niveau (WAL, ctid). Avec le WAL, peut faire du forensic statistique « ces écritures sont arrivées proches en temps sur plusieurs tables → probablement même user » — pas du plain SQL, mais reconstructible. **Ne voit pas** la clé maîtresse (elle vit dans ton navigateur, jamais sur le serveur). En revanche, peut tampered le bundle JS livré (cf. section serveur compromis ci-dessous).

**Une réquisition judiciaire** (police, justice avec une procédure formelle). L'équipe Nodea peut être contrainte de remettre tout ce qu'elle voit en SQL : email, heures de connexion, IP, blobs chiffrés, hashes anti-DoS. **Ne peut pas remettre** le contenu en clair (techniquement impossible — pas la clé). **Ne peut pas remettre** le mot de passe (techniquement impossible — OPAQUE). En pratique : « voilà l'email du compte, voilà ses heures de connexion, voilà ses fichiers chiffrés. Bon courage pour les ouvrir. »

**Auto-héberge** si ces vecteurs te préoccupent. L'équipe, l'hébergeur et l'interlocuteur d'une réquisition deviennent toi — la surface de risque se réduit drastiquement (à condition que ton serveur soit sécurisé).

## Le scénario qu'on ne peut pas neutraliser : le serveur compromis

Soyons honnêtes sur les limites. Le code qui chiffre tes données est servi par le serveur. Si quelqu'un prend le contrôle du serveur (intrusion, compromission de la chaîne de build, employé malveillant chez l'hébergeur…), il pourrait remplacer le JavaScript par une version qui exfiltre ton mot de passe au moment où tu te connectes.

Cette limite est **inhérente à toute application web** chiffrée bout-en-bout — pas spécifique à Nodea. Bitwarden, Standard Notes, Cryptee partagent la même limite.

Ce qu'on fait pour la mitiger :

- **Subresource Integrity** — le HTML qui charge le JavaScript principal contient une empreinte cryptographique du fichier ; si le JS est modifié, le navigateur refuse de l'exécuter.
- **Manifest `INTEGRITY.txt`** — chaque release publie les empreintes de tous les fichiers du bundle. Tu peux les comparer avec ce que ton instance sert pour détecter une divergence.
- **Recommandation auto-hébergement** — si tu manipules des données très sensibles, fais tourner ta propre instance. Tu réduis drastiquement la surface (ton serveur, tes employé·es… toi-même).

On n'a pas la prétention de neutraliser ce scénario. On le documente, on borne ses dégâts, et on te donne les outils pour le détecter.

<aside class="docs-hint">

Tu veux le threat model formel, les algos figés, et les détails crypto auditables ? L'onglet **« Sous le capot »** a tout — avec liens vers la spec exhaustive et le code.

</aside>
