#!/usr/bin/env bash
# create_admin.sh — crée le superadmin PocketBase s'il n'existe pas
# - Lit la config dans config/.env
# - Priorité: création via API (POST /api/admins) si le serveur tourne
# - Si l’API échoue, affiche une erreur explicite (PocketBase >= 0.29 n’a plus de CLI admin)
# - N'orchestre pas start/stop. Rôle unique: création.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$here")")"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
ask() { echo "❔ $*"; }
warn(){ echo "⚠️  $*" >&2; }

ENV_FILE="$REPO_ROOT/config/.env"
BIN_DIR="$REPO_ROOT/services/pocketbase"

# --- 1) Charger config/.env ---
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE introuvable. Lance d’abord ./setup_env.sh."
# shellcheck disable=SC1090
source "$ENV_FILE"

PB_HOST="${PB_HOST:-127.0.0.1}"
PB_PORT="${PB_PORT:-8090}"
PB_DATA_DIR="${PB_DATA_DIR:-./data}"

ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

# Demander si manquant (sans écrire dans config/.env)
if [[ -z "$ADMIN_EMAIL" ]]; then
  ask "Email du superadmin à créer : "
  read -r ADMIN_EMAIL
fi
if [[ -z "$ADMIN_PASSWORD" ]]; then
  ask "Mot de passe du superadmin -saisie masquée): "
  read -rs ADMIN_PASSWORD
  echo
fi
[[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]] || die "ADMIN_EMAIL / ADMIN_PASSWORD requis."

BASE_URL="http://127.0.0.1:${PB_PORT}" # on force toujours 127.0.0.1

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Commande requise manquante : $1"; }
require_cmd curl


# --- 2) Création via API uniquement (PocketBase >= 0.29) ---
if curl -sSf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  info "Serveur accessible, tentative de création via API…"
  create_payload=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")

  http_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "$create_payload" \
    "${BASE_URL}/api/admins" || echo 000)"

  case "$http_code" in
    200|204)
      ok "Superadmin créé via /api/admins."
      exit 0
      ;;
    401)
      ok "Un superadmin existe déjà (401)."
      exit 0
      ;;
    404)
      die "L’API /api/admins est introuvable (404). Vérifie la version de PocketBase (>=0.29 requise)."
      ;;
    000)
      die "Échec réseau pendant l’appel API. Vérifie que PocketBase est bien démarré sur ${BASE_URL}."
      ;;
    *)
      die "API /api/admins a répondu HTTP $http_code. Création impossible."
      ;;
  esac
else
  die "Serveur PocketBase non joignable sur ${BASE_URL}/api/health. Démarre-le avant de créer le superadmin."
fi
