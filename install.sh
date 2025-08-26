#!/usr/bin/env bash
set -e

# dossier cible
TARGET_DIR="services/pocketbase"
BIN="$TARGET_DIR/pocketbase"

# version pocketbase souhaitée
VERSION="0.22.8" # adapte si besoin

# url github releases
BASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v$VERSION"

# détection plateforme
UNAME=$(uname -s)
ARCH=$(uname -m)

if [ "$UNAME" = "Linux" ]; then
  OS="linux"
elif [ "$UNAME" = "Darwin" ]; then
  OS="darwin"
else
  echo "❌ OS non supporté : $UNAME"
  exit 1
fi

if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
else
  echo "❌ Arch non supportée : $ARCH"
  exit 1
fi

FILE="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
URL="$BASE_URL/$FILE"

# check existance
if [ -f "$BIN" ]; then
  echo "✅ PocketBase déjà présent ($BIN)"
  $BIN --version
  exit 0
fi

echo "📦 Téléchargement PocketBase v$VERSION pour $OS/$ARCH"
mkdir -p "$TARGET_DIR"
curl -L "$URL" -o "$TARGET_DIR/$FILE"

echo "📂 Décompression..."
unzip -o "$TARGET_DIR/$FILE" -d "$TARGET_DIR"
rm "$TARGET_DIR/$FILE"

chmod +x "$BIN"

echo "✅ Installation terminée : $BIN"
$BIN --version
