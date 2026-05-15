#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Nodea — VPS deploy hook.
#
# Called by the VPS install system (aliceout/vps-install) on every successful
# Docker build via GitHub webhook. The VPS handles everything above this
# script: user creation, nginx + TLS, DNS, repo pull onto /var/www/nodea/ at
# the right commit. This script is responsible for everything below: pulling
# app secrets from Infisical Cloud, rendering them as a root `.env`,
# building / starting the compose stack, and seeding the initial admin.
#
# Preconditions (guaranteed by the VPS):
#   - cwd = repo root, checked out at the target commit on `main`.
#   - $HOME/.config/infisical/nodea.env exists, chmod 600, containing:
#       INFISICAL_API_URL       e.g. https://infisical.com
#       INFISICAL_PROJECT_ID    uuid of the Nodea project on Infisical Cloud
#       INFISICAL_CLIENT_ID     universal-auth machine identity id
#       INFISICAL_CLIENT_SECRET universal-auth machine identity secret
#       INFISICAL_ENV           e.g. prod
#   - Running user is a member of the `docker` group (not root).
#   - `docker`, `infisical`, `curl`, `bash` are on PATH.
#
# Idempotent: the webhook can re-fire for the same commit on GitHub retry —
# every step is safe to re-execute.
# -----------------------------------------------------------------------------
set -euo pipefail

# Resolve the repo root from the script's own location, never from $PWD or a
# hardcoded /home/* / /var/www/* — the VPS picks the app user dynamically.
# The script lives at `<repo>/scripts/deploy.sh`, so one `..` is enough ;
# two would land on the parent of the repo and silently break the
# `git rev-parse` below (no git → empty SHA → bad image tag).
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CREDS_FILE="${CREDS_FILE:-$HOME/.config/infisical/nodea.env}"
ENV_FILE="$DEPLOY_DIR/.env"

log() { printf '[nodea-deploy] %s\n' "$*"; }
die() { printf '[nodea-deploy] ERR %s\n' "$*" >&2; exit 1; }

[[ -s "$CREDS_FILE" ]] || die "infisical creds missing: $CREDS_FILE"

# 1. Load Infisical Cloud credentials into the shell environment.
set -a
# shellcheck disable=SC1090
source "$CREDS_FILE"
set +a

: "${INFISICAL_API_URL:?required}"
: "${INFISICAL_PROJECT_ID:?required}"
: "${INFISICAL_CLIENT_ID:?required}"
: "${INFISICAL_CLIENT_SECRET:?required}"
: "${INFISICAL_ENV:?required}"

# 2. Universal-auth login → short-lived token on stdout.
log "authenticating against $INFISICAL_API_URL"
TOKEN="$(
  infisical login \
    --method=universal-auth \
    --domain="$INFISICAL_API_URL" \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --plain --silent
)"
[[ -n "$TOKEN" ]] || die "infisical login returned an empty token"

# 3. Pull the Nodea secrets into a dotenv bundle at the repo root.
#    On Infisical Cloud, every app under this account lives under
#    `/services/<service-name>/…`. Nodea splits its secrets into a
#    parent folder for cross-service framework keys (`DOMAIN`,
#    `ADDRESS`…) and per-service sub-folders (`api/`, `postgres/`,
#    `web/`) for keys scoped to a single container.
#
#    Fetch order matters. The bash `source` / docker-compose `.env`
#    parser is last-write-wins on duplicate keys, so we pull the
#    parent FIRST (cross-cutting defaults) and overlay each
#    sub-folder ON TOP (service-specific overrides win). Anything a
#    sub-folder leaves untouched stays at the parent value. Anything
#    a sub-folder redefines silently shadows the parent.
: > "$ENV_FILE"
chmod 600 "$ENV_FILE"
for subpath in "" api postgres web; do
  full="/services/nodea${subpath:+/$subpath}"
  log "fetching $full secrets (env=$INFISICAL_ENV)"
  infisical export \
    --domain="$INFISICAL_API_URL" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env="$INFISICAL_ENV" \
    --path="$full" \
    --format=dotenv \
    --token="$TOKEN" \
    >> "$ENV_FILE"
done

# Sanity check: COOKIE_SECRET is required, and we'd rather fail here with a
# clear message than let docker-compose surface a cryptic variable error.
grep -q '^COOKIE_SECRET=' "$ENV_FILE" \
  || die "Infisical export produced an .env without COOKIE_SECRET — aborting"

# Load the freshly-rendered .env into the shell so the post-compose steps
# can read values like WEB_PORT / ADMIN_EMAIL without re-parsing the file.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 4. Pull the images built by the `Docker build` workflow (pushed to
#    ghcr.io/aliceout/nodea-{api,web}) and start the stack.
#    Mailpit stays down — it sits under `profiles: ['dev']` and we
#    deliberately don't pass `--profile dev`.
#
#    By default we pin to the immutable `sha-<short>` tag of the
#    current checkout — guarantees the deploy renders exactly the
#    commit CI validated. Override with `NODEA_IMAGE_TAG=main` (or
#    any other tag) before invoking this script to use a moving tag.
#    Short form must match the docker-build workflow's metadata
#    action (`type=sha,format=short,prefix=sha-` → 7 chars).
cd "$DEPLOY_DIR"

# Persistent Postgres data lives under the deploy user's home, NOT
# under `/var/lib/docker/volumes/`. Reasons :
#   1. `docker compose down -v` / `docker volume prune` cannot touch
#      a bind mount — both have wiped prod data before.
#   2. Standard host backup tooling targets `/home/$USER/...` —
#      bind-mounted data gets backed up for free.
#   3. Inspectable directly on the filesystem when we need to debug.
# `docker-compose.yml` reads `${DATA_DIR}` for the postgres bind mount.
export DATA_DIR="$HOME/data/nodea"
mkdir -p "$DATA_DIR/postgres"
log "data dir = $DATA_DIR (postgres bind mount)"

# Pin to the immutable `sha-<short>` of the current checkout unless the
# caller (webhook payload, manual run) overrode `NODEA_IMAGE_TAG`.
# `git rev-parse` failing here means the path resolution above is broken
# (was the case briefly post-rename to `scripts/`) ; surface the cause
# loudly instead of letting `docker compose pull` chase an empty `sha-`
# tag that GHCR will return as 404.
if [[ -z "${NODEA_IMAGE_TAG:-}" ]]; then
  short_sha="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"
  [[ -n "$short_sha" ]] \
    || die "could not resolve HEAD short sha — is $DEPLOY_DIR a git checkout ?"
  export NODEA_IMAGE_TAG="sha-$short_sha"
fi
log "pulling images (tag=$NODEA_IMAGE_TAG)"
docker compose pull
# Plain `up -d` — never `down -v`. The Postgres data directory is a
# bind mount under `$DATA_DIR/postgres/`, persisted across deploys.
# Drizzle migrations run on api boot and handle schema evolution
# without touching user rows.
log "docker compose up -d (no local build — images come from GHCR)"
docker compose up -d

# 5. Wait until the API is healthy. Drizzle migrations run in-container on
#    boot, so the first healthy response means the schema is up to date.
log "waiting for /api/healthz on port ${WEB_PORT:-8080}"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT:-8080}/api/healthz" >/dev/null 2>&1; then
    log "API healthy"
    break
  fi
  sleep 2
done

# 6. Seed the initial admin if creds are present. Safe to re-run: `seed:admin`
#    is idempotent on email — subsequent invocations log "already exists" and
#    exit 0. Once you've confirmed the first admin is in, remove ADMIN_*
#    from Infisical to avoid surfacing those values on every deploy.
#
#    We capture stdout+stderr and report them verbatim on non-zero exit so
#    the real cause (missing env, DB error, bad password policy…) is visible
#    in the webhook logs instead of being shadowed by a generic
#    "already-seeded" hand-wave.
if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  log "running seed:admin"
  seed_rc=0
  seed_out=$(docker compose exec -T api pnpm --filter @nodea/api seed:admin 2>&1) \
    || seed_rc=$?
  if [[ $seed_rc -eq 0 ]]; then
    log "seed:admin OK"
    printf '%s\n' "$seed_out"
  else
    log "seed:admin FAILED (exit $seed_rc) — output below"
    printf '%s\n' "$seed_out" >&2
    # Continue the deploy anyway: the stack is up, missing admin is a
    # recoverable nice-to-have. Re-run manually once the cause is fixed.
  fi
fi

log "deploy OK ($(date -Iseconds))"
