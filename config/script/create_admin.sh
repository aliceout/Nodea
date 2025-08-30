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

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Commande requise manquante : $1"; }

# --- Création via CLI uniquement (PocketBase >= 0.29) ---
PB_BIN="$BIN_DIR/pocketbase"
# Ajustement Windows (Git Bash)
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]]; then
  if [[ -f "${PB_BIN}.exe" ]]; then
    PB_BIN="${PB_BIN}.exe"
  fi
fi
[[ -x "$PB_BIN" ]] || die "Binaire PocketBase manquant ou non exécutable: $PB_BIN (exécute ./install_pocketbase.sh)"

info "Création du superadmin via CLI…"
set +e
"$PB_BIN" --dir "$PB_DATA_DIR" admin create "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
code=$?
set -e

if [[ $code -eq 0 ]]; then
  ok "Superadmin créé via CLI."
  exit 0
fi

die "Échec de la création via CLI (code $code). Si le serveur tourne, arrête-le (./stop_pocketbase.sh) puis relance create_admin.sh."