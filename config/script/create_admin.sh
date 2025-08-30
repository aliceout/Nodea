#!/usr/bin/env bash
# create_admin.sh — crée le superadmin PocketBase s'il n'existe pas
# - Lit la config dans config/.env
# - Priorité: création via API (POST /api/admins/create) si le serveur tourne
# - Fallback: CLI `pocketbase admin create EMAIL PASSWORD` (peut échouer si DB verrouillée)
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

# --- 2) Si serveur répond, tenter l’API (idempotent) ---
if curl -sSf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  info "Serveur accessible, tentative de création via API…"

  # V0.29.x: endpoint public si aucun admin: POST /api/admins/
  # Réponses attendues:
  # - 200/204 => créé
  # - 401     => déjà un admin (ou besoin token) => on considère "existe"
  # - 404     => endpoint inconnu => on essaie /api/admins (autres versions)
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
    404|405)
      info "Endpoint /api/admins/create indisponible, tentative /api/admins…"
      ;;
    000)
      warn "Échec réseau pendant l’appel API, on bascule sur la CLI."
      ;;
    *)
      warn "API /api/admins/create a répondu HTTP $http_code. On tente une alternative."
      ;;
  esac

  # Alternative: POST /api/admins (selon versions)
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
    409)
      ok "Conflit/duplication: le superadmin existe déjà (409)."
      exit 0
      ;;
    000)
      warn "Échec réseau pendant l’appel API, on bascule sur la CLI."
      ;;
    *)
      warn "API /api/admins a répondu HTTP $http_code. On tente la CLI."
      ;;
  esac
else
  info "Serveur non joignable sur ${BASE_URL}/api/health — on tente la CLI directe."
fi

# --- 3) Fallback CLI: pocketbase admin create EMAIL PASSWORD ---
PB_BIN="$BIN_DIR/pocketbase"
# Ajustement Windows (Git Bash)
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]]; then
  if [[ -f "${PB_BIN}.exe" ]]; then
    PB_BIN="${PB_BIN}.exe"
  fi
fi
[[ -x "$PB_BIN" ]] || die "Binaire PocketBase manquant ou non exécutable: $PB_BIN (exécute ./install_pocketbase.sh)"

info "Tentative de création via CLI (peut échouer si la DB est verrouillée par un server en cours)…"
set +e
"$PB_BIN" --dir "$PB_DATA_DIR" admin create "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
code=$?
set -e

if [[ $code -eq 0 ]]; then
  ok "Superadmin créé via CLI."
  exit 0
fi

die "Échec de la création via CLI (code $code). Si le serveur tourne, arrête-le (./stop_pocketbase.sh) puis relance create_admin.sh."
