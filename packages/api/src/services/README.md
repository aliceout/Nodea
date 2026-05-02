# `services/`

Modules de logique métier consommés par les routes HTTP (cf. ADR-9 sur la
distinction routes-fines vs services). Une route appelle un service quand sa
logique dépasse la chaîne `valider → DB → retourner`.

## Convention de profondeur (REFACTO-17 acté)

- **Service mono-fichier** → fichier plat à la racine de `services/`.
  Exemple : `settings.ts` (59 LOC, lit / écrit la table `app_settings`).
- **Service multi-fichiers** → sous-dossier dédié avec un `index.ts`
  qui ré-exporte la surface publique, plus les fichiers d'implémentation.
  Exemples :
    - `email/` — 8 fichiers (transports SMTP / console / recording, i18n,
      parité, types) + `locales/` + `templates/`. Trop de surface pour
      un fichier plat.
    - `library-lookup/` — 14 fichiers (un par fournisseur externe + utilitaires
      partagés). Le dispatcher orchestre l'ensemble.

La règle évite l'écueil opposé : promouvoir un service mono-fichier de 60
LOC en sous-dossier `settings/index.ts` ajoute une couche vide pour de la
symétrie cosmétique. La symétrie n'est pas un objectif en soi — l'objectif
est que la profondeur reflète la complexité réelle du service.

## Quand passer un fichier plat en sous-dossier

Quand le fichier dépasse ~150 LOC OU quand un deuxième fichier devient
nécessaire pour aérer (helpers, types, sous-modules). À ce moment-là,
créer `<service>/index.ts` (= ancien fichier plat) + les fichiers
sibling. Les imports externes ne changent pas si l'index ré-exporte
exactement la même surface.
