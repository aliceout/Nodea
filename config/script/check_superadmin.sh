#!/usr/bin/env bash
set -euo pipefail


# Vérification superadmin à froid (ne stoppe pas le script si erreur)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -f "config/.env" ]; then set -a; source "config/.env"; set +a; fi
PB_BIN="services/pocketbase/pocketbase"

# Vérification superadmin à froid (ne stoppe pas le script si erreur)
EXISTING_ADMIN=""
if [ -x "$PB_BIN" ]; then
  EXISTING_ADMIN=$("$PB_BIN" --dir "$POCKETBASE_DATA_DIR" superuser list 2>/dev/null | grep -E 'email: .+') || true
fi
if [ -n "$EXISTING_ADMIN" ]; then
  echo "✅ Un superadmin existe déjà :"
  echo "$EXISTING_ADMIN"
  echo "SUPERADMIN_EXISTS=1" > "$ROOT/config/.superadmin_cache"
else
  echo "SUPERADMIN_EXISTS=0" > "$ROOT/config/.superadmin_cache"
fi
