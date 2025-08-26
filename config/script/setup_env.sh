#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/config/.env"
PB_URL_DEFAULT="${1:-http://127.0.0.1:8090}"

default_host="127.0.0.1"
default_port="8090"


echo "🔧 Configuration .env"


# Si .env existe, demander si on veut le garder ou le redéfinir
if [ -f "$ENV_FILE" ]; then
  echo "⚠️  $ENV_FILE existe déjà."
  read -rp "Garder la configuration existante ? (O/n) : " KEEP_ENV
  if [[ -z "$KEEP_ENV" || "$KEEP_ENV" =~ ^[oO]$ ]]; then
    echo "⏭️  On garde la configuration existante."
    exit 0
  fi
fi

# Si on arrive ici, on veut redéfinir la config
read -rp "Gérer les variables manuellement ? (o/N, défaut auto) : " MANUAL
if [[ "$MANUAL" =~ ^[oOyY]$ ]]; then
  read -rp "Host PocketBase [$default_host] : " PB_HOST
  PB_HOST="${PB_HOST:-$default_host}"
  echo "Par défaut, le port PocketBase est 8090."
  read -rp "Entrez un port personnalisé ou appuyez sur Entrée pour garder 8090 : " POCKETBASE_PORT
  POCKETBASE_PORT="${POCKETBASE_PORT:-$default_port}"
  read -rp "Où veux-tu stocker les données PocketBase ? Chemin du dossier data [data] : " POCKETBASE_DATA_DIR
  POCKETBASE_DATA_DIR="${POCKETBASE_DATA_DIR:-data}"
  read -rp "Mode (dev/prod) [prod] : " APP_MODE
  APP_MODE="${APP_MODE:-prod}"
else
  PB_HOST="$default_host"
  POCKETBASE_PORT="$default_port"
  POCKETBASE_DATA_DIR="data"
  APP_MODE="prod"
fi

PB_URL="http://${PB_HOST}:${POCKETBASE_PORT}"

cat > "$ENV_FILE" <<EOF
# Nodea .env
PB_HOST=$PB_HOST
POCKETBASE_PORT=$POCKETBASE_PORT
VITE_PB_URL=$PB_URL
VITE_APP_MODE=$APP_MODE
POCKETBASE_DATA_DIR=$POCKETBASE_DATA_DIR
EOF

echo "✅ .env écrit :"
cat "$ENV_FILE"
