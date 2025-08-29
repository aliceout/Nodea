#!/usr/bin/env bash
## Installation automatique de dotenv si absent
if ! npm ls dotenv >/dev/null 2>&1; then
  echo "📦 Installation de dotenv (npm)..."
  npm install dotenv
fi
set -euo pipefail


ROOT="$(pwd)"
PB_BIN="services/pocketbase/pocketbase"
START="config/script/start_pocketbase.sh"

echo "🍃 Nodea — install"

# 0) Choix du mode d'installation
read -rp "Mode d'installation ? (dev/prod) : " INSTALL_MODE
INSTALL_MODE=${INSTALL_MODE:-dev}

if [[ "$INSTALL_MODE" =~ ^[dD] ]]; then
  # Mode DEV
  read -rp "Laisser toutes les options par défaut ? (O/n) : " DEFAULT_OPTIONS
  DEFAULT_OPTIONS=${DEFAULT_OPTIONS:-O}
  if [[ "$DEFAULT_OPTIONS" =~ ^[oOyY]$ ]]; then
    PB_HOST="127.0.0.1"
    POCKETBASE_PORT="8090"
    POCKETBASE_DATA_DIR="data"
  else
    read -rp "Adresse PocketBase (127.0.0.1 par défaut) : " PB_HOST
    PB_HOST=${PB_HOST:-127.0.0.1}
    read -rp "Port PocketBase (8090 par défaut) : " POCKETBASE_PORT
    POCKETBASE_PORT=${POCKETBASE_PORT:-8090}
    read -rp "Dossier des données (data par défaut) : " POCKETBASE_DATA_DIR
    POCKETBASE_DATA_DIR=${POCKETBASE_DATA_DIR:-data}
  fi
else
  # Mode PROD
  read -rp "URL de PocketBase (ex: https://api.monsite.com) : " PB_URL
  # Extraction correcte du host et du port
  PB_HOST=$(echo "$PB_URL" | sed -E 's#^https?://([^:/]+).*#\1#')
  PB_PORT_EXTRACT=$(echo "$PB_URL" | sed -nE 's#^https?://[^:/]+:([0-9]+).*#\1#p')
  if [ -z "$PB_PORT_EXTRACT" ]; then
    POCKETBASE_PORT="8090"
  else
    POCKETBASE_PORT="$PB_PORT_EXTRACT"
  fi
  read -rp "Dossier des données (data par défaut) : " POCKETBASE_DATA_DIR
  POCKETBASE_DATA_DIR=${POCKETBASE_DATA_DIR:-data}

  # Vérification manuelle puis technique de l'accessibilité
  read -rp "PocketBase est-il déjà accessible à cette adresse ? (O/n) : " PB_ACCESSIBLE
  PB_ACCESSIBLE=${PB_ACCESSIBLE:-O}
  if [[ ! "$PB_ACCESSIBLE" =~ ^[oOyY]$ ]]; then
    echo "⛔ Veuillez d'abord rendre PocketBase accessible à l'URL indiquée, puis relancez ce script."
    exit 1
  fi
  echo "🔎 Vérification technique de l'accessibilité de PocketBase à l'URL : $PB_URL ..."
  if ! curl --max-time 5 -s -o /dev/null "$PB_URL"; then
    echo "❌ PocketBase n'est pas accessible à l'adresse $PB_URL."
    echo "Vérifiez la configuration de nginx ou équivalent, puis relancez ce script."
    exit 1
  fi
  echo "✅ PocketBase est accessible."
fi

# Export pour la suite
export PB_HOST POCKETBASE_PORT POCKETBASE_DATA_DIR


# 0bis) Configuration .env (interactif, AVANT tout lancement)
if [[ "$INSTALL_MODE" =~ ^[dD] ]]; then
  bash "$ROOT/config/script/setup_env.sh"
fi


# 1) Charger .env
ENV_PATH="config/.env"
if [ -f "$ENV_PATH" ]; then
  set -a; source "$ENV_PATH"; set +a
fi

# 2) Vérifier et installer PocketBase si nécessaire
PB_BIN_PATH="services/pocketbase/pocketbase"
if [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" =~ msys|mingw|cygwin|windowsnt ]]; then
  PB_BIN_PATH="services/pocketbase/pocketbase.exe"
fi
if [ ! -f "$PB_BIN_PATH" ]; then
  echo "❌ Binaire PocketBase introuvable : $PB_BIN_PATH"
  echo "▶️  Installation automatique du binaire PocketBase..."
  bash "config/script/install_pocketbase.sh"
fi

  if [[ "$INSTALL_MODE" =~ ^[dD] ]]; then
    # Mode DEV
  # Doublon supprimé, rien à faire ici

# Construction de PB_URL selon le mode
if [[ "$INSTALL_MODE" =~ ^[dD] ]]; then
  PB_HOST_RESOLVED="${PB_HOST:-127.0.0.1}"
  PB_PORT_RESOLVED="${POCKETBASE_PORT}"
  PB_URL="http://${PB_HOST_RESOLVED}:${PB_PORT_RESOLVED}"
fi



# 3) Vérifier si la base existe AVANT démarrage
DATA_DIR="${POCKETBASE_DATA_DIR:-data}"
DB_PATH="$DATA_DIR/data.db"
DB_EXISTS=false
if [ -f "$DB_PATH" ]; then
  DB_EXISTS=true
fi

# 4) Démarrer PocketBase
if [[ "$INSTALL_MODE" =~ ^[dD] ]]; then
  bash "config/script/start_pocketbase.sh" "$PB_HOST_RESOLVED" "$PB_PORT_RESOLVED"
else
  # En mode prod, on passe l'URL telle que saisie
  bash "config/script/start_pocketbase.sh" "$PB_URL"
fi

# 5) Gestion du superuser selon existence de la base
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-}"
SUPERUSER_PASS="${SUPERUSER_PASS:-}"

if [ "$DB_EXISTS" = true ]; then
  echo "La base existe déjà."
  read -rp "Voulez-vous créer un superuser ? (o/N) : " CREATE_SUPERUSER
  CREATE_SUPERUSER=${CREATE_SUPERUSER:-N}
  if [[ "$CREATE_SUPERUSER" =~ ^[oOyY]$ ]]; then
    read -rp "Email superadmin à créer : " SUPERUSER_EMAIL
    read -srp "Mot de passe superadmin à créer (saisi caché) : " SUPERUSER_PASS
    echo
    export SUPERUSER_EMAIL SUPERUSER_PASS
    echo "[VERBOSE] Création du superuser demandé par l'utilisateur."
    bash "config/script/check_superadmin.sh" "$SUPERUSER_EMAIL" "$SUPERUSER_PASS" >/tmp/check_superadmin.log
    CHECK_RESULT=$?
    echo "[VERBOSE] Résultat check_superadmin.sh (code: $CHECK_RESULT) :"
    cat /tmp/check_superadmin.log
    # On ne stoppe pas sur erreur, on continue
  else
    read -rp "Email du superuser existant : " SUPERUSER_EMAIL
    read -srp "Mot de passe du superuser existant (saisi caché) : " SUPERUSER_PASS
    echo
  fi
else
  echo "Première installation : création du superuser."
  read -rp "Email superadmin à créer : " SUPERUSER_EMAIL
  read -srp "Mot de passe superadmin à créer (saisi caché) : " SUPERUSER_PASS
  echo
  export SUPERUSER_EMAIL SUPERUSER_PASS
  echo "[VERBOSE] Création du superuser (nouvelle base)."
  bash "config/script/check_superadmin.sh" "$SUPERUSER_EMAIL" "$SUPERUSER_PASS" >/tmp/check_superadmin.log
  CHECK_RESULT=$?
  echo "[VERBOSE] Résultat check_superadmin.sh (code: $CHECK_RESULT) :"
  cat /tmp/check_superadmin.log
  # On ne stoppe pas sur erreur, on continue
fi
fi

# 6) Import des collections et des règles PocketBase
SCHEMA_DIR="config/schema"
COLLECTIONS_FILE="$SCHEMA_DIR/collections.json"
RULES_FILE="$SCHEMA_DIR/rules.json"
echo "⏳ Import des collections ($COLLECTIONS_FILE) et des règles ($RULES_FILE) PocketBase..."
set +e
node "config/script/apply_schema.mjs" "$PB_URL" "$SUPERUSER_EMAIL" "$SUPERUSER_PASS"
IMPORT_EXIT=$?
set -e
if [ $IMPORT_EXIT -eq 0 ]; then
  echo "✅ Import réussi : les collections ($COLLECTIONS_FILE) et règles ($RULES_FILE) PocketBase ont été appliquées."
  echo "🏁 Import terminée."
else
  echo "❌ Échec de l'authentification ou de l'import des collections/règles PocketBase."
  echo "Fichiers utilisés :"
  echo "  - Collections : $COLLECTIONS_FILE"
  echo "  - Règles      : $RULES_FILE"
  echo "Vérifiez l'email et le mot de passe du superuser, ou la validité des fichiers de schéma."
fi