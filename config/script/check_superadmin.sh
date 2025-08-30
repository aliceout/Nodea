#!/usr/bin/env bash
# check_superadmin.sh — vérifie l'existence d'un superadmin
# - Lecture seule
# - Lit la config dans config/.env
# - Utilise l'API locale PocketBase (http://127.0.0.1:PB_PORT)
# - Exit codes: 0 = existe, 1 = absent, 2+ = erreur/indéterminé

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$here")")"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
err()  { echo "❌ $*" >&2; }
ask() { echo "❔ $*"; }

ENV_FILE="$REPO_ROOT/config/.env"
BIN_DIR="$REPO_ROOT/services/pocketbase"

# --- 1) Charger env ---
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE introuvable. Lance d’abord ./setup_env.sh."

source "$ENV_FILE"

PB_HOST="${PB_HOST:-127.0.0.1}"
PB_PORT="${PB_PORT:-8090}"
BASE_URL="http://127.0.0.1:${PB_PORT}"  # toujours forcer 127.0.0.1

# --- 2) Sanity check: service up? ---

# Nouvelle logique : si data.db existe, demander à l'utilisateur s'il veut créer un superadmin
PB_DATA_DIR="${PB_DATA_DIR:-}"
DATA_DB="$PB_DATA_DIR/data.db"

if [[ -f "$DATA_DB" ]]; then
  info "La base de données existe déjà."
  ask "Créer un superadmin ? (y/N)"
  read -r ans
  ans="${ans:-N}"
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    PB_BIN="$BIN_DIR/pocketbase"
    if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]]; then
      if [[ -f "${PB_BIN}.exe" ]]; then
        PB_BIN="${PB_BIN}.exe"
      fi
    fi
    [[ -x "$PB_BIN" ]] || die "Binaire PocketBase manquant ou non exécutable: $PB_BIN (exécute ./install_pocketbase.sh)"
    echo "Lancement de la création du superadmin..."
    bash "$REPO_ROOT/config/script/create_admin.sh"
    exit $?
  else
    info "Création du superadmin ignorée."
    exit 0
  fi
else
  info "data.db non présente, étape suivante."
  exit 0
fi
