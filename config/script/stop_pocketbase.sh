#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/services/pocketbase/run/pocketbase.pid"
if [ -f "$ROOT/config/.env" ]; then set -a; source "$ROOT/config/.env"; set +a; fi

if [ ! -f "$PID_FILE" ]; then
  echo "ℹ️  Aucun PID file trouvé ($PID_FILE). PB est peut-être déjà arrêté."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ps -p "$PID" >/dev/null 2>&1; then
  echo "⏹️  Arrêt PocketBase (pid $PID)..."
  kill "$PID" || true
  sleep 1
  if ps -p "$PID" >/dev/null 2>&1; then
    echo "⚠️  Toujours vivant, kill -9"
    kill -9 "$PID" || true
  fi
else
  echo "ℹ️  Process $PID introuvable."
fi

rm -f "$PID_FILE"
echo "✅ PocketBase arrêté."
