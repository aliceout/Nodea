#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PB_BIN="services/pocketbase/pocketbase"
START="config/script/start_pocketbase.sh"

echo "🍃 Nodea — install"

# 0) Configuration .env (interactif, AVANT tout lancement)
bash "$ROOT/config/script/setup_env.sh"

# 1) Charger .env

ENV_PATH="config/.env"
if [ -f "$ENV_PATH" ]; then
  set -a; source "$ENV_PATH"; set +a
fi





# 2) Vérifier et installer PocketBase si nécessaire
PB_HOST_RESOLVED="${PB_HOST:-127.0.0.1}"
PB_PORT_RESOLVED="${POCKETBASE_PORT:-8090}"
PB_URL="http://${PB_HOST_RESOLVED}:${PB_PORT_RESOLVED}"
PB_BIN_PATH="services/pocketbase/pocketbase"
if [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" =~ msys|mingw|cygwin|windowsnt ]]; then
  PB_BIN_PATH="services/pocketbase/pocketbase.exe"
fi
if [ ! -f "$PB_BIN_PATH" ]; then
  echo "❌ Binaire PocketBase introuvable : $PB_BIN_PATH"
  echo "▶️  Installation automatique du binaire PocketBase..."
  bash "config/script/install_pocketbase.sh"
fi


# 3) Vérifier si la base existe
DB_PATH="data/data.db"
DB_EXISTS=false
if [ -f "$DB_PATH" ]; then
  DB_EXISTS=true
fi

# 4) Démarrer PocketBase
bash "config/script/start_pocketbase.sh" "$PB_HOST_RESOLVED" "$PB_PORT_RESOLVED"

# 5) Création superadmin

if [ "$DB_EXISTS" = true ]; then
  read -rp "La base existe déjà. Voulez-vous créer un superadmin ? (o/N) : " CREATE_SUPERADMIN
  CREATE_SUPERADMIN=${CREATE_SUPERADMIN:-N}
  if [[ "$CREATE_SUPERADMIN" =~ ^[oOyY]$ ]]; then
    read -rp "Email superadmin : " SUPERADMIN_EMAIL
    read -srp "Mot de passe superadmin (saisi caché) : " SUPERADMIN_PASS
    echo
    "$PB_BIN_PATH" --dir data superuser create "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASS"
    echo "✅ Superuser créé pour $SUPERADMIN_EMAIL"
  else
    # Génère un superadmin bidon
    BIDON_EMAIL="superadmin-$(date +%s)@example.com"
    BIDON_PASS="$(head -c 12 /dev/urandom | base64)"
    "$PB_BIN_PATH" --dir data superuser create "$BIDON_EMAIL" "$BIDON_PASS"
    echo "✅ Superuser bidon créé : $BIDON_EMAIL"
    echo "SUPERADMIN_EMAIL=$BIDON_EMAIL" >> "$ENV_PATH"
    echo "SUPERADMIN_PASS=$BIDON_PASS" >> "$ENV_PATH"
  fi
else
  read -rp "Voulez-vous créer un superadmin ? (o/N) : " CREATE_SUPERADMIN
  CREATE_SUPERADMIN=${CREATE_SUPERADMIN:-N}
  if [[ "$CREATE_SUPERADMIN" =~ ^[oOyY]$ ]]; then
    read -rp "Email superadmin : " SUPERADMIN_EMAIL
    read -srp "Mot de passe superadmin (saisi caché) : " SUPERADMIN_PASS
    echo
    "$PB_BIN_PATH" --dir data superuser create "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASS"
    echo "✅ Superuser créé pour $SUPERADMIN_EMAIL"
  else
    # Génère un superadmin bidon
    BIDON_EMAIL="superadmin-$(date +%s)@example.com"
    BIDON_PASS="$(head -c 12 /dev/urandom | base64)"
    "$PB_BIN_PATH" --dir data superuser create "$BIDON_EMAIL" "$BIDON_PASS"
    echo "✅ Superuser bidon créé : $BIDON_EMAIL"
    echo "SUPERADMIN_EMAIL=$BIDON_EMAIL" >> "$ENV_PATH"
    echo "SUPERADMIN_PASS=$BIDON_PASS" >> "$ENV_PATH"
  fi
fi

# 6) Création obligatoire d'un admin API
echo "Création d'un admin API (pour l'interface web et l'automatisation) :"
read -rp "Email admin API : " ADMIN_API_EMAIL
read -srp "Mot de passe admin API (saisi caché) : " ADMIN_API_PASS
echo
node "config/script/apply_schema.mjs" "$PB_URL" "$ADMIN_API_EMAIL" "$ADMIN_API_PASS"

# 6) Import schéma et règles
node "config/script/apply_schema.mjs" "$PB_URL"

echo "✅ Installation terminée."
