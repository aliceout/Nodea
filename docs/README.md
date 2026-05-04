# Documentation Nodea

**Nodea** est une application web auto-hébergée de journaling et de
suivi de vie, **chiffrée de bout en bout**. Toutes tes données sont
chiffrées dans le navigateur avec une clé dérivée de ton mot de passe
— le serveur ne stocke que du chiffré, il ne voit jamais ton contenu.

Cette documentation est organisée en trois pôles selon ton intérêt :
**les curieux**, **les hébergeurs**, **les contributeurs**. Choisis
ton entrée selon ce que tu cherches.

---

## Pour les curieux — comprendre Nodea

Tu te demandes ce qu'est Nodea, ce qu'on peut y faire, et pourquoi
tu pourrais lui confier des données personnelles ?

| Lis | Pourquoi |
|---|---|
| [Modules.md](./Modules.md) | Vue d'ensemble des modules : Mood (humeur quotidienne), Goals (objectifs), Habits (habitudes), Library (bibliothèque), Review (bilan annuel YearCompass), Journal (entrées libres) |
| [Security.md](./Security.md) | Comment fonctionne le chiffrement bout-en-bout, ce que le serveur peut / ne peut pas voir, les limites du modèle web |
| [Modules/*.md](./Modules/) | Détail fonctionnel de chaque module (champs, règles, formats d'export) |

---

## Pour les hébergeurs — déployer Nodea

Tu veux installer ton propre Nodea, sur ton serveur ou ton NAS,
pour toi seul·e ou pour un cercle restreint ?

| Lis | Pourquoi |
|---|---|
| [Architecture.md §5](./Architecture.md#5-docker-deployment) | Le bundle docker-compose (postgres + api + web), variables d'environnement, ports |
| [Security.md §6](./Security.md#6-the-web-app-supply-chain-limit-must-read) | La limite **fondamentale** du modèle web (un serveur compromis peut servir du JS modifié) et les mitigations en place : SRI, manifest `INTEGRITY.txt`, recommandation auto-hébergement |
| [Release-Checklist.md](./Release-Checklist.md) | Étapes à valider avant de tagger une release auto-hébergeable |
| [Internationalisation.md](./Internationalisation.md) | Comment ajouter une langue ou modifier les traductions |

**Recommandation forte** pour un usage sensible : auto-héberge.
Le code est conçu pour qu'une instance personnelle réduise au minimum
la surface d'attaque ; voir Security §7.3.

---

## Pour les contributeurs — modifier Nodea

Tu veux porter une feature, corriger un bug, comprendre comment c'est
agencé sous le capot ?

| Lis | Pourquoi |
|---|---|
| [Architecture.md](./Architecture.md) | Layout du monorepo (api / web / shared), runtime backend, stack frontend, conventions |
| [Database.md](./Database.md) | Schéma Postgres complet, contraintes d'intégrité, FK cascades, AAD pour chaque blob chiffré |
| [Auth-Spec.md](./Auth-Spec.md) | **Spécification technique exhaustive** de l'auth (OPAQUE + Passkey + TOTP + recovery + bypass MFA + stepped MFA + session re-auth). Référence complète, pas une lecture rapide |
| [Security.md](./Security.md) | Invariants crypto, politique de rate-limit (§4.1), gestes interdits |

**Avant de toucher un module** : la fiche `Modules/<Module>.md`
décrit le payload clair et les règles. Avant de toucher l'auth :
`Auth-Spec.md`. Avant de toucher la crypto : `Security.md` est
prescriptif (HKDF, AAD, branded types, anti-patterns).

---

## Conventions de cette documentation

- **Source de vérité unique.** Code et doc doivent être alignés ;
  une divergence est un bug-doc à corriger comme un bug-code, dans le
  même PR que la divergence est introduite.
- **Le code prime sur la spec** en cas d'écart constaté pour ce qui
  est livré (`Auth-Spec.md` rappelle ce point dans son préambule).
- **Français inclusif** pour les humain·e·s ; pas pour les objets
  (« un critère actif », pas « actif·ve »).
- **Commentaires de code en anglais**, textes utilisateur en français.

---

## Fichiers connexes (pas dans cette doc)

- [`/CLAUDE.md`](../CLAUDE.md) — instructions internes pour
  l'assistant IA qui contribue au code. Pas un document utilisateur,
  mais expose les règles dures (crypto, monorepo, conventions).
- [`/README.md`](../README.md) — le README repo, point d'entrée
  développeur (install, dev, tests).
- [`/.env.example`](../.env.example) — variables d'environnement
  documentées.
