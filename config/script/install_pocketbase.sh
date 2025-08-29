#!/usr/bin/env bash
set -euo pipefail


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PB_BIN="$ROOT/services/pocketbase/pocketbase"
mkdir -p "$ROOT/services/pocketbase"

# Lecture de la variable POCKETBASE_DATA_DIR depuis .env si présente
ENV_PATH="$ROOT/config/.env"
if [ -f "$ENV_PATH" ]; then
  set -a; source "$ENV_PATH"; set +a
fi
DATA_DIR="${POCKETBASE_DATA_DIR:-data}"
mkdir -p "$ROOT/$DATA_DIR"

# Détection OS
UNAME_S="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Architecture non supportée: $ARCH"; exit 1 ;;
esac
case "$UNAME_S" in
  linux) OS="linux" ; EXT="" ;;
  darwin) OS="macos" ; EXT="" ;;
  msys*|mingw*|cygwin*|windowsnt) OS="windows" ; EXT=".exe" ;;
  *) echo "OS non supporté: $UNAME_S"; exit 1 ;;
esac

PB_LATEST=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep 'tag_name' | cut -d '"' -f4)
if [ -z "$PB_LATEST" ]; then PB_LATEST="v0.22.3"; fi # fallback version
if [ "$OS" = "windows" ]; then
  PB_URL_DL="https://github.com/pocketbase/pocketbase/releases/download/$PB_LATEST/pocketbase_${PB_LATEST#v}_windows_${ARCH}.zip"
elif [ "$OS" = "linux" ] && [ "$ARCH" = "amd64" ]; then
  PB_URL_DL="https://github.com/pocketbase/pocketbase/releases/download/$PB_LATEST/pocketbase_${PB_LATEST#v}_linux_amd64.zip"
elif [ "$OS" = "linux" ] && [ "$ARCH" = "arm64" ]; then
  PB_URL_DL="https://github.com/pocketbase/pocketbase/releases/download/$PB_LATEST/pocketbase_${PB_LATEST#v}_linux_arm64.zip"
elif [ "$OS" = "macos" ]; then
  PB_URL_DL="https://github.com/pocketbase/pocketbase/releases/download/$PB_LATEST/pocketbase_${PB_LATEST#v}_macos_amd64.zip"
else
  echo "OS/architecture non supporté pour le téléchargement PocketBase."
  exit 1
fi
TMP_ZIP="$ROOT/services/pocketbase/pb_dl.zip"
echo "Téléchargement: $PB_URL_DL"
curl -L "$PB_URL_DL" -o "$TMP_ZIP"
unzip -o "$TMP_ZIP" -d "$ROOT/services/pocketbase/"
rm "$TMP_ZIP"
if [ "$OS" = "windows" ]; then
  if [ ! -f "$ROOT/services/pocketbase/pocketbase.exe" ]; then
    echo "❌ Erreur: pocketbase.exe non trouvé après extraction."
    exit 1
  fi
else
  chmod +x "$PB_BIN"
  echo "✅ PocketBase téléchargé et installé à $PB_BIN"
fi
  PB_SIZE=$(stat -c %s "$ROOT/services/pocketbase/pocketbase.exe" 2>/dev/null || wc -c < "$ROOT/services/pocketbase/pocketbase.exe")
  if [ "$PB_SIZE" -lt 100000 ]; then
    echo "❌ Erreur: le fichier pocketbase.exe est trop petit ($PB_SIZE octets)."
    echo "--- Début du fichier téléchargé ---"
    head -20 "$ROOT/services/pocketbase/pocketbase.exe"
    echo "-----------------------------------"
    echo "Vérifie l'URL ou ta connexion réseau."
    exit 1
  fi
  chmod +x "$ROOT/services/pocketbase/pocketbase.exe"
  echo "✅ PocketBase téléchargé et installé à $ROOT/services/pocketbase/pocketbase.exe"
else
  PB_URL_DL="https://github.com/pocketbase/pocketbase/releases/download/$PB_LATEST/pocketbase_${OS}_${ARCH}${EXT}.zip"
  TMP_ZIP="$ROOT/services/pocketbase/pb_dl.zip"
  echo "Téléchargement: $PB_URL_DL"
  curl -L "$PB_URL_DL" -o "$TMP_ZIP"
  unzip -o "$TMP_ZIP" -d "$ROOT/services/pocketbase/"
  rm "$TMP_ZIP"
  chmod +x "$PB_BIN"
  echo "✅ PocketBase téléchargé et installé à $PB_BIN"
fi
