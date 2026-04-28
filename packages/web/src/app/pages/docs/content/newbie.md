## C'est quoi « chiffré » exactement ?

Imagine un coffre dont seul·e toi as la clé. Tu mets ce que tu veux dedans, tu fermes, tu envoies le coffre fermé à Nodea pour qu'on le garde. On le stocke, on s'en occupe — mais on ne peut pas l'ouvrir. Personne d'autre ne peut, à part toi.

Concrètement, ton ordinateur (ton navigateur, en fait) chiffre tout ce que tu écris **avant** que ça ne quitte ta machine. Le serveur de Nodea ne reçoit que des données incompréhensibles. C'est ça, l'« E2E » ou le « bout-en-bout » : du début (ton navigateur) jusqu'au stockage, ce n'est jamais en clair côté serveur.

## Qui peut lire ce que j'écris dans Nodea ?

**Toi, et personne d'autre.** Pas l'équipe qui développe Nodea, pas l'hébergeur qui fait tourner le serveur, pas un·e stagiaire qui ferait du SQL un dimanche soir. Le serveur ne stocke que des fichiers chiffrés et il n'a pas la clé pour les ouvrir.

Cette propriété n'est pas une promesse marketing — elle est une conséquence de la façon dont l'app est construite. La clé qui déchiffre tes données est dérivée de ton mot de passe à toi, et on ne reçoit jamais ce mot de passe en clair non plus (on en envoie une preuve cryptographique au login, jamais le mot lui-même).

## Et si je perds mon mot de passe ?

C'est la contrepartie : si **personne** ne peut lire tes données sans ton mot de passe, alors si tu le perds et que tu n'as aucune sauvegarde, on ne peut pas t'aider à le récupérer. Tes données existent toujours sur le serveur, mais elles sont inaccessibles — y compris pour nous.

Pour éviter ça, Nodea te génère à l'inscription un **code de récupération** de 12 mots. Tu le notes une fois, tu le gardes hors-ligne (sur papier, dans un gestionnaire de mots de passe…). Si un jour tu perds ton mot de passe, ces 12 mots servent à choisir un nouveau mot de passe sans rien casser de tes données.

Tu peux régénérer ce code à tout moment depuis *Compte → Sécurité* ; l'ancien devient invalide.

## Et si quelqu'un veut accéder à mes données ?

Trois cas possibles. Voilà ce que chacun peut voir, en clair.

**L'équipe Nodea** (nous, qui développons et faisons tourner le serveur). On voit ton email, ton nom d'affichage, tes heures de connexion, et le fait que tu utilises tel ou tel module. **On ne voit pas** le contenu de ce que tu écris — c'est chiffré avec une clé qu'on n'a pas.

**L'hébergeur** (le fournisseur cloud qui loue le serveur). Pareil que l'équipe Nodea, plus quelques détails techniques bas niveau (ordre dans lequel les écritures arrivent dans la base). Toujours pas de contenu en clair.

**La police / la justice** (avec une réquisition légale). Nous pouvons être contraints de remettre tout ce qu'on voit nous-mêmes : ton email, tes heures de connexion, tes fichiers chiffrés. **Mais ces fichiers chiffrés sont inutiles sans ta clé**, qui n'est ni chez nous ni chez l'hébergeur. En pratique : « voilà l'email du compte, voilà ses heures de connexion, voilà ses fichiers chiffrés. Bon courage pour les ouvrir. »

**Solution la plus stricte** : auto-héberge ton instance. L'équipe, l'hébergeur et l'interlocuteur d'une réquisition deviennent toi.

## Sur quoi on est explicites

- Pas de tracking, pas de cookie pub, pas d'analytics tiers.
- Pas de revente, pas d'entraînement d'IA sur tes données — on n'a même pas accès au contenu.
- Pas de partage de tes données avec un tiers, sauf injonction légale (et ce qu'on pourrait remettre, c'est du chiffré inutilisable, voir ci-dessus).
- Code source [consultable publiquement](https://github.com/aliceout/Nodea). Si tu doutes, tu peux vérifier.

<aside class="docs-hint">

Tu veux comprendre comment tout ça marche concrètement ? L'onglet **« La mécanique »** explique le chiffrement avec des mots simples.

</aside>
