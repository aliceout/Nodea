#!/usr/bin/env bash
# start_pocketbase.sh — démarre PocketBase en arrière-plan
# - Lit la config dans config/.env (PB_HOST, PB_PORT, PB_DATA_DIR)
# - Démarre le binaire ./bin/pocketbase (ou .exe) avec --http et --dir
# - Écrit les logs dans ./logs/pocketbase.log
# - Stocke le PID dans ./run/pocketbase.pid
# - Ne crée pas d'admin, ne touche pas au schéma.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$here")")"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
ask() { echo "❔ $*"; }

ENV_FILE="$REPO_ROOT/config/.env"
BIN_DIR="$REPO_ROOT/services/pocketbase"
RUN_DIR="$BIN_DIR/run"
LOG_DIR="$BIN_DIR/logs"
PID_FILE="$RUN_DIR/pocketbase.pid"

# --- Charger l'env ---
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE introuvable. Lance d’abord ./setup_env.sh."
# shellcheck disable=SC1090
source "$ENV_FILE"

PB_HOST="${PB_HOST:-127.0.0.1}"
PB_PORT="${PB_PORT:-8090}"
PB_DATA_DIR="${PB_DATA_DIR:-./data}"


#mkdir -p "$PB_DATA_DIR" "$RUN_DIR" "$LOG_DIR"

# --- Localiser le binaire ---
PB_BIN="$BIN_DIR/pocketbase"
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]]; then
  # Git Bash/Windows : le binaire est .exe
  if [[ -f "${PB_BIN}.exe" ]]; then
    PB_BIN="${PB_BIN}.exe"
  fi
fi
[[ -x "$PB_BIN" ]] || die "Binaire PocketBase manquant ou non exécutable: $PB_BIN. Exécute ./install_pocketbase.sh"

# --- Si déjà en cours, ne pas doubler ---
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" || true)"
  if [[ -n "${old_pid:-}" ]] && ps -p "$old_pid" >/dev/null 2>&1; then
    ok "PocketBase déjà démarré (PID $old_pid)."
    exit 0
  fi
  # PID mort → nettoyage
  rm -f "$PID_FILE"
fi

# --- Démarrer en arrière-plan ---

# Création des dossiers nécessaires
mkdir -p "$RUN_DIR" "$LOG_DIR"

info "Démarrage de PocketBase sur ${PB_HOST}:${PB_PORT}"
# Rem: --http attend host:port ; --dir pointe sur le répertoire data
nohup "$PB_BIN" serve --http "${PB_HOST}:${PB_PORT}" --dir "$PB_DATA_DIR" \
  >"$LOG_DIR/pocketbase.log" 2>&1 &

pb_pid=$!
echo "$pb_pid" > "$PID_FILE"

# Petit check de présence process (pas de health ici : install.sh s’en charge)
sleep 0.3
if ps -p "$pb_pid" >/dev/null 2>&1; then
  ok "PocketBase lancé (PID $pb_pid). Logs: pocketbase.log"
else
  die "Échec du démarrage (voir $LOG_DIR/pocketbase.log)."
fi


