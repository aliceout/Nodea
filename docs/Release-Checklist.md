# Release Checklist

À suivre à chaque tag `v*` qui passe en main. Court par design — si
ça grossit au point qu'on rate des étapes, on factorise vers du
script.

## Pré-requis

- [ ] La branche `main` contient le commit à publier
- [ ] CI verte sur ce commit
- [ ] Migration DB documentée si schéma changé (cf. `Database.md`)
- [ ] CHANGELOG / release notes rédigées

## Tag + GitHub Release

```bash
git tag vX.Y.Z
git push --tags
gh release create vX.Y.Z --notes-file release-notes.md
```

## Attacher le manifest d'intégrité (SHA-384 du bundle web)

C'est ce qui permet aux self-hosters de vérifier que leur
déploiement n'a pas été altéré (cf. `nodea.app/docs/security/tech`,
section « Intégrité du bundle »). **Sans
cette étape, la mitigation est cosmétique.**

Récupérer depuis le CI (préféré — c'est le bundle exact que CI a
buildé, signé par le runner GitHub) :

```bash
# Trouver le run-id du commit tagué
gh run list --commit vX.Y.Z --limit 1

# Télécharger l'artifact correspondant (nom = web-integrity-<sha>)
gh run download <run-id> -n web-integrity-<commit-sha>

# Attacher à la release
gh release upload vX.Y.Z INTEGRITY.txt
```

Ou regénérer localement (utile si la release est cuttée hors CI) :

```bash
pnpm install --frozen-lockfile
pnpm --filter @nodea/web build
gh release upload vX.Y.Z packages/web/dist/INTEGRITY.txt
```

## Image Docker

Si la release ship une image Docker, le workflow `docker-build.yml`
pousse vers le registry à chaque tag. Vérifier que le tag d'image
correspond à `vX.Y.Z`.

## Annonce

- [ ] Mettre à jour le README si besoin (badges, install)
- [ ] Communiquer la release aux users existants (changelog,
      breaking changes notables)
