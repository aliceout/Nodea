# Release Checklist

Run this for every `v*` tag that lands on main. Short by design — if it
grows enough that we miss steps, we factor it into a script.

## Prerequisites

- [ ] `main` branch contains the commit to publish
- [ ] CI green on that commit
- [ ] DB migration documented if the schema changed (cf. `Database.md`)
- [ ] Release notes drafted (format to be decided when we tag V1)

## Tag + GitHub Release

```bash
git tag vX.Y.Z
git push --tags
gh release create vX.Y.Z --notes-file release-notes.md
```

## Attach the integrity manifest (SHA-384 of the web bundle)

This is what lets self-hosters verify their deployment hasn't been
tampered with (cf. `nodea.app/docs/security/tech`, "Intégrité du bundle"
section). **Without this step, the mitigation is cosmetic.**

Pull it from CI (preferred — that's the exact bundle CI built, signed
by the GitHub runner):

```bash
# Find the run-id of the tagged commit
gh run list --commit vX.Y.Z --limit 1

# Download the matching artifact (name = web-integrity-<sha>)
gh run download <run-id> -n web-integrity-<commit-sha>

# Attach to the release
gh release upload vX.Y.Z INTEGRITY.txt
```

Or regenerate locally (useful when the release is cut outside CI):

```bash
pnpm install --frozen-lockfile
pnpm --filter @nodea/web build
gh release upload vX.Y.Z packages/web/dist/INTEGRITY.txt
```

## Docker image

If the release ships a Docker image, the `docker-build.yml` workflow
pushes to the registry on every tag. Verify the image tag matches
`vX.Y.Z`.

## Announcement

- [ ] Update the README if needed (badges, install)
- [ ] Communicate the release to existing users (changelog, notable
      breaking changes)
