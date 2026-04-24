#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Nodea — VPS deploy hook.
#
# Called by the VPS install system (aliceout/vps-install) on every successful
# Docker build via GitHub webhook. The VPS handles everything above this
# script: user creation, nginx + TLS, DNS, repo pull onto /var/www/nodea/ at
# the right commit. This script is responsible for everything below: pulling
# app secrets from the self-hosted Infisical, rendering them as a root `.env`,
# building / starting the compose stack, and seeding the initial admin.
#
# Preconditions (guaranteed by the VPS):
#   - cwd = repo root, checked out at the target commit on `main`.
#   - $HOME/.config/infisical/nodea.env exists, chmod 600, containing:
#       INFISICAL_API_URL       e.g. https://env.backlice.dev
#       INFISICAL_PROJECT_ID    uuid of the Nodea project on the self-hosted
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
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREDS_FILE="${CREDS_FILE:-$HOME/.config/infisical/nodea.env}"
ENV_FILE="$DEPLOY_DIR/.env"

log() { printf '[nodea-deploy] %s\n' "$*"; }
die() { printf '[nodea-deploy] ERR %s\n' "$*" >&2; exit 1; }

[[ -s "$CREDS_FILE" ]] || die "infisical creds missing: $CREDS_FILE"

# 1. Load Infisical self-hosted credentials into the shell environment.
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

# 3. Pull every secret under /nodea as a dotenv bundle at the repo root.
#    docker-compose reads it automatically via its ${VAR} substitutions.
log "fetching /nodea secrets (env=$INFISICAL_ENV) → $ENV_FILE"
infisical export \
  --domain="$INFISICAL_API_URL" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --path=/nodea \
  --format=dotenv \
  --token="$TOKEN" \
  > "$ENV_FILE"
chmod 600 "$ENV_FILE"

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

# 4. Build + start the stack. Mailpit stays down (it sits under
#    `profiles: ['dev']` and we deliberately don't pass --profile dev).
cd "$DEPLOY_DIR"
log "docker compose pull / up -d --build"
docker compose pull
docker compose up -d --build

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
if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  log "running seed:admin"
  docker compose exec -T api pnpm --filter @nodea/api seed:admin || \
    log "seed:admin returned non-zero (likely already-seeded — safe to ignore)"
fi

log "deploy OK ($(date -Iseconds))"
