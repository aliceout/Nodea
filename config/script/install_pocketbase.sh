#!/usr/bin/env bash
# install_pocketbase.sh — Télécharge et installe le binaire PocketBase
# Rôle unique : gérer le binaire (pas d’admin, pas de schéma, pas de start).
# Lit ses variables dans config/.env (PB_DATA_DIR, PB_PORT, PB_HOST)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$here")")"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
ask() { echo "❔ $*"; }

ENV_FILE="$REPO_ROOT/config/.env"

# --- Charger config/.env ---
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  die "$ENV_FILE introuvable. Lance d’abord ./setup_env.sh."
fi

PB_VERSION="0.29.3"

PB_BIN_DIR="$REPO_ROOT/services/pocketbase"
PB_BIN="$PB_BIN_DIR/pocketbase"

mkdir -p "$PB_BIN_DIR"

# Vérifier si le binaire existe déjà
if [[ -f "$PB_BIN" || -f "$PB_BIN.exe" ]]; then
  info "PocketBase est déjà présent dans services/pocketbase"
  ask "Retélécharger le binaire PocketBase ? (y/N)"
  read -r ans
  ans="${ans:-N}"
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    ok "Binaire PocketBase déjà présent, téléchargement ignoré."
    exit 0
  fi
fi

# --- Déterminer OS/arch ---
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64 | arm64) ARCH="arm64" ;;
  *) die "Architecture non supportée : $ARCH" ;;
esac

# Mapping OS
case "$OS" in
  linux)  OS="linux" ;;
  darwin) OS="darwin" ;; # macOS
  msys*|cygwin*|mingw*) OS="windows" ;;
  *) die "OS non supporté : $OS" ;;
esac

FILENAME="pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${FILENAME}"

# Création des dossiers nécessaires
mkdir -p "$REPO_ROOT/services" 
mkdir -p "$REPO_ROOT/services/pocketbase"

# --- Télécharger ---
info "Téléchargement de PocketBase v${PB_VERSION} pour ${OS}/${ARCH}…"
curl -sSL -o "$PB_BIN_DIR/$FILENAME" "$URL" || die "Échec du téléchargement"

# --- Décompresser ---
info "Décompression…"
unzip -o "$PB_BIN_DIR/$FILENAME" -d "$PB_BIN_DIR" >/dev/null

# --- Nettoyage ---
rm -f "$PB_BIN_DIR/$FILENAME"

# --- Droits d’exécution ---
chmod +x "$PB_BIN"

ok "PocketBase installé dans $PB_BIN"


