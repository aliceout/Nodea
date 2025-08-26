#!/usr/bin/env bash
set -euo pipefail

HOOKS_DIR="config/pocketbase/pb_hooks"
ENV_PATH="config/.env"
PB_BIN="services/pocketbase/pocketbase"
if [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" =~ msys|mingw|cygwin|windowsnt ]]; then
  PB_BIN="services/pocketbase/pocketbase.exe"
fi
PID_FILE="services/pocketbase/pb.pid"
DATA_DIR="${POCKETBASE_DATA_DIR:-data}"
HOST="${1:-${PB_HOST:-127.0.0.1}}"
PORT="${2:-${POCKETBASE_PORT:-8090}}"
PB_URL="http://$HOST:$PORT"
## ...existing code...

if [ ! -x "$PB_BIN" ]; then
  echo "❌ Binaire PocketBase introuvable : $PB_BIN"
  echo "👉 Lance d'abord ton script d'installation du binaire."
  exit 1
fi


# Déjà up ?
if curl -fsS "$PB_URL/api/health" >/dev/null 2>&1; then
  echo "✅ PocketBase déjà en ligne sur $PB_URL"
  exit 0
fi

echo "▶️  Démarrage PocketBase sur $PB_URL ..."
echo "📦 Data PocketBase : $DATA_DIR"
echo "🔗 Hooks PocketBase : $HOOKS_DIR"
## ...existing code...
# démarrer en arrière-plan + sauvegarder le pid
nohup "$PB_BIN" serve --http "$HOST:$PORT" --dir "$DATA_DIR" --hooksDir "$HOOKS_DIR" \
  > services/pocketbase/pocketbase.log 2>&1 &

PB_PID=$!
echo "$PB_PID" > "$PID_FILE"

# Attente health
for i in {1..40}; do
  if curl -fsS "$PB_URL/api/health" >/dev/null 2>&1; then
    echo "✅ PocketBase prêt (pid $(cat "$PID_FILE"))"
    exit 0
  fi
  sleep 0.25
done

echo "❌ PocketBase ne répond pas sur $PB_URL après attente."
echo "--- Log PocketBase ---"
cat services/pocketbase/pocketbase.log || echo "(Aucun log trouvé)"
echo "----------------------"
exit 1
