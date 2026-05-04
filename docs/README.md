# Documentation Nodea (côté repo)

Cette doc est **réservée aux contributeur·rice·s** qui modifient
le code. Le détail à destination des utilisateur·ice·s, des
self-hosters et des forkers vit en ligne dans l'app :

- [`nodea.app/docs/security`](https://nodea.app/docs/security/newbie) — comment fonctionne le chiffrement bout-en-bout, 3 tiers de lecture (les bases / la mécanique / sous le capot).
- [`nodea.app/docs/fork`](https://nodea.app/docs/fork) — reprendre Nodea pour soi (setup local, structure, tests, invariants à respecter, rebrand).
- [`nodea.app/docs/self-host`](https://nodea.app/docs/self-host) — installer ta propre instance.

Si tu cherches le **workflow de contribution upstream** (ouvrir une
issue, faire une PR, conventions de commit), c'est dans
[`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md).

---

## Référence technique repo-side

Documents prescriptifs lus avant un chantier sur la zone concernée.
Source de vérité unique : code et doc doivent être alignés, une
divergence est un bug-doc à corriger dans le PR qui l'introduit.

| Lis | Avant de toucher |
|---|---|
| [Architecture.md](./Architecture.md) | Code structure, runtime flow, middleware stack, schéma commun des modules (§7) |
| [Auth-Spec.md](./Auth-Spec.md) | OPAQUE, MFA, recovery, bypass, stepped MFA, session re-auth — référence exhaustive, pas une lecture rapide |
| [Database.md](./Database.md) | Schéma Postgres, contraintes d'intégrité, FK cascades, AAD pour chaque blob chiffré |
| [Modules/`<Module>`.md](./Modules/) | Payload clair + règles métier propres au module (Goals, Habits, Journal, Library, Mood, Review) |
| [Internationalisation.md](./Internationalisation.md) | Système i18n, ajouter une clé, ajouter une langue, parité FR/EN |
| [Release-Checklist.md](./Release-Checklist.md) | Étapes à valider avant de tagger une release |
| [adr/](./adr/) | Décisions architecturales avec leurs alternatives — l'ADR concerné se lit avant de remettre en cause un pattern |

**Avant de toucher la crypto** : la doc « sous le capot » sur
[`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
est prescriptive (HKDF, AAD, branded types, rate-limit catalogue,
RGPD, anti-patterns). Source dans
[`packages/web/src/app/pages/docs/content/tech.md`](../packages/web/src/app/pages/docs/content/tech.md).

---

## Conventions

- **Source de vérité unique.** Code et doc alignés ; une divergence
  est un bug-doc à corriger comme un bug-code, dans le même PR que
  la divergence est introduite.
- **Le code prime sur la spec** en cas d'écart constaté pour ce qui
  est livré (`Auth-Spec.md` rappelle ce point dans son préambule).
- **Français inclusif** pour les humain·e·s ; pas pour les objets
  (« un critère actif », pas « actif·ve »).
- **Commentaires de code en anglais**, textes utilisateur en français.

---

## Fichiers connexes

- [`/CLAUDE.md`](../CLAUDE.md) — instructions internes pour
  l'assistant IA qui contribue au code. Pas un document utilisateur,
  mais expose les règles dures (crypto, monorepo, conventions).
- [`/README.md`](../README.md) — README repo, point d'entrée
  développeur (install, dev, tests).
- [`/.env.example`](../.env.example) — variables d'environnement
  documentées.
- [`/.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md) — workflow
  de contribution upstream (issues, PR, conventions de commit).
- [`/.github/CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) — Code
  of Conduct (Citizen Code of Conduct, CC BY-SA).
- [`/.github/SECURITY.md`](../.github/SECURITY.md) — politique de
  divulgation de vulnérabilités.
