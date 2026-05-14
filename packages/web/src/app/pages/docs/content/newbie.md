Nodea est un journal et un outil de suivi personnel. Voici comment ce que tu y écris reste à toi — et les questions pratiques que les gens se posent en utilisant l'app au quotidien.

## C'est quoi « chiffré » exactement ?

Imagine un coffre dont toi seul·e as la clé. Tu mets ce que tu veux dedans, tu fermes, tu envoies le coffre fermé à Nodea pour qu'on le garde. On le stocke, on s'en occupe — mais on ne peut pas l'ouvrir. Personne d'autre ne peut, à part toi.

Concrètement, ton ordinateur (ton navigateur, en fait) chiffre tout ce que tu écris **avant** que ça ne quitte ta machine. Le serveur de Nodea ne reçoit que des données incompréhensibles. C'est ça, l'« E2E » ou le « bout-en-bout » : du début (ton navigateur) jusqu'au stockage, ce n'est jamais en clair côté serveur.

## Qui peut lire ce que j'écris dans Nodea ?

**Toi, et personne d'autre.** Pas l'équipe qui développe Nodea, pas l'hébergeur qui fait tourner le serveur, pas un·e stagiaire qui ferait du SQL un dimanche soir. Le serveur ne stocke que des fichiers chiffrés et il n'a pas la clé pour les ouvrir.

Cette propriété n'est pas une promesse marketing — elle est une conséquence de la façon dont l'app est construite. La clé qui déchiffre tes données est dérivée de ton mot de passe à toi, et on ne reçoit jamais ce mot de passe en clair non plus (on en envoie une preuve cryptographique au login, jamais le mot lui-même). Et le code source est public — n'importe quel·le dev compétent·e peut vérifier que ce qu'on dit ici correspond bien au code qui tourne.

## Et si je perds mon mot de passe ?

C'est la contrepartie : si **personne** ne peut lire tes données sans ton mot de passe, alors si tu le perds et que tu n'as aucune sauvegarde, on ne peut pas t'aider à le récupérer. Tes données existent toujours sur le serveur, mais elles sont inaccessibles — y compris pour nous.

Pour éviter ça, juste après ton inscription, Nodea te propose un **code de récupération** de 12 mots — et te le recommande très fortement. Tu le notes une fois, tu le gardes hors-ligne (sur papier, dans un gestionnaire de mots de passe…). Si un jour tu perds ton mot de passe, ces 12 mots servent à choisir un nouveau mot de passe sans rien casser de tes données.

Tu peux régénérer ce code à tout moment depuis *Compte → Sécurité* ; l'ancien devient invalide.

**Et si tu perds aussi le code de récupération ?** Là, on est bloqué·es ensemble : on peut effacer ton compte si tu nous le demandes, mais on ne peut pas récupérer les données — c'est techniquement impossible, pas un manque de bonne volonté. Note tes 12 mots quelque part de fiable.

## Et si quelqu'un veut accéder à mes données ?

Trois cas possibles. Voilà ce que chacun peut voir, en clair.

**L'équipe Nodea** (nous, qui développons et faisons tourner le serveur). On voit ton email, ton nom d'affichage, tes heures de connexion, et le fait que tu utilises tel ou tel module. **On ne voit pas** le contenu de ce que tu écris — c'est chiffré avec une clé qu'on n'a pas.

**L'hébergeur** (le fournisseur cloud qui loue le serveur). Pareil que l'équipe Nodea, plus quelques détails techniques bas niveau (ordre dans lequel les écritures arrivent dans la base). Toujours pas de contenu en clair.

**La police / la justice** (avec une réquisition légale). Nous pouvons être contraints de remettre tout ce qu'on voit nous-mêmes : ton email, tes heures de connexion, tes fichiers chiffrés. **Mais ces fichiers chiffrés sont inutiles sans ta clé**, qui n'est ni chez nous ni chez l'hébergeur. En pratique : « voilà l'email du compte, voilà ses heures de connexion, voilà ses fichiers chiffrés. Bon courage pour les ouvrir. »

**Solution la plus stricte** : auto-héberge — c'est-à-dire faire tourner Nodea sur ton propre serveur (réservé si tu es à l'aise avec la technique). L'équipe, l'hébergeur et l'interlocuteur d'une réquisition deviennent toi.

## Sur quoi on est explicites

- **Pas de tracking, pas de cookie pub, pas d'analytics tiers.** Aucun script Google, Meta ou autre. Le serveur enregistre seulement ce qu'il faut pour faire son boulot (qui s'est connecté, quand, et depuis quelle adresse IP) — et même ça, on cherche à le minimiser.

- **Pas d'entraînement d'IA sur tes données.** Pas une promesse cochée dans une CGU — par construction : on n'a même pas accès au contenu de tes entrées. Pour entraîner quoi que ce soit, il faudrait casser le chiffrement, ce qui ne marche que si on a ta clé. On ne l'a pas.

- **Pas de revente, pas de partage** sauf injonction légale ; et ce qu'on pourrait remettre dans ce cas-là, c'est du chiffré inutilisable (voir ci-dessus).

- **Code source [public sur GitHub](https://github.com/aliceout/Nodea).** Si tu doutes, n'importe quel·le dev compétent·e peut vérifier que ce qu'on dit ici correspond bien au code qui tourne.

## Questions pratiques

Questions sur l'usage et le cycle de vie de tes données — séparées de la partie sécu ci-dessus. Si une question manque ici et que tu penses qu'elle devrait y être, [ouvre un ticket sur GitHub](https://github.com/aliceout/Nodea/issues).

### Puis-je exporter mes données ?

Oui. Va dans *Compte → Données → Exporter mes données* — Nodea génère un fichier JSON contenant toutes tes entrées (déchiffrées côté client au moment de l'export, puisque toi seul·e peut le faire). Tu télécharges, tu fais ce que tu veux du fichier.

### Si Nodea ferme demain, qu'est-ce qui arrive à mes données ?

Si tu utilises l'instance hébergée par l'équipe Nodea : un préavis raisonnable (plusieurs semaines) sera donné avant toute fermeture, pour te laisser le temps d'exporter ou de migrer. Le projet est open-source — même si l'équipe disparaît, le code reste accessible sur GitHub : n'importe qui peut faire tourner sa propre instance.

Si tu auto-héberges, ça ne dépend que de toi.

### Mes données sont stockées où, juridiquement ?

L'instance officielle tourne sur des serveurs en France. Une **ébauche de CGU** ([`packages/web/src/app/pages/Terms/content.md`](https://github.com/aliceout/Nodea/blob/main/packages/web/src/app/pages/Terms/content.md)) existe — pas encore de version définitive signée par un·e juriste ; si tu utilises l'instance officielle aujourd'hui, c'est dans un cadre informel.

Si tu auto-héberges, c'est toi qui choisis la juridiction.

Note : même chez l'instance officielle, le contenu de tes entrées étant chiffré avant l'envoi, la juridiction ne change pas grand-chose pratiquement (cf. plus haut sur ce que voit la justice).

### Ça marche offline ?

Non. Toute opération (login, lecture, écriture) nécessite que le serveur soit joignable. Aucun mode offline n'est implémenté pour l'instant.

### Est-ce qu'il y aura une app mobile ?

Nodea fonctionne dans le navigateur mobile (le design est responsive) — Safari iOS / Chrome Android ouvrent et utilisent l'app normalement. Une PWA installable ou une app native ne sont pas planifiées à ce stade ; la question reste ouverte selon les besoins qui émergeront.

### Comment supprimer mon compte ?

Va dans *Compte → Suppression du compte*. Tu retapes ton email et ton mot de passe pour confirmer, puis l'opération est immédiate et **irréversible** : ta ligne user disparaît, toutes tes clés sont détruites, les sessions sont révoquées. Les blobs résiduels deviennent illisibles puisque les clés pour les ouvrir n'existent plus nulle part — voir le détail dans l'onglet *La mécanique*, section « Quand je supprime, qu'est-ce qui disparaît ? ».

Aucune confirmation par email, aucun délai de grâce — on considère que si tu cliques après avoir retapé tes identifiants, tu sais ce que tu fais.

### Combien ça coûte ?

Le projet est open-source et gratuit à auto-héberger. Pour l'instance officielle hébergée par l'équipe Nodea, il n'y a pas de modèle commercial figé pour l'instant. Si une participation aux frais d'hébergement devient nécessaire à terme, ça sera annoncé clairement.

### Puis-je l'utiliser en équipe ou partager une entrée ?

Non, et ce n'est pas prévu. Nodea est volontairement un outil **individuel** — un journal et un suivi personnel. Le partage entre comptes casserait le modèle E2EE (il faudrait soit un re-chiffrement complexe avec clés partagées, soit accepter qu'un tiers déchiffre côté serveur). Si tu cherches de la collaboration vraiment chiffrée, regarde plutôt du côté d'outils spécialisés pour ça.

### Vous voyez quand je me connecte ?

Oui — l'instance que tu utilises log les heures de connexion (timestamp + adresse IP), comme tout serveur web. Ces données servent à investiguer un éventuel incident de sécurité. Plus de détails sur ce que voit l'équipe / l'hébergeur dans la section « Et si quelqu'un veut accéder à mes données ? » plus haut.

### Comment vous contacter en cas de souci ?

- **Bug ou question technique** : [GitHub Issues](https://github.com/aliceout/Nodea/issues)
- **Problème de sécurité sensible** : ouvre une issue minimaliste *sans détails exploitables*, l'équipe te recontactera pour échanger en privé. Un canal dédié de divulgation responsable sera mis en place plus tard.

L'équipe est petite et bénévole — les délais de réponse peuvent varier. Pour les bugs critiques, signale-les avec un peu de contexte (étapes pour reproduire, version) et on regarde au plus vite.

<aside class="docs-hint">

Tu veux comprendre comment tout ça marche concrètement ? L'onglet **« La mécanique »** explique le chiffrement avec des mots simples.

</aside>
