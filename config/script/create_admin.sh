#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -f "$ROOT/config/.env" ]; then set -a; source "$ROOT/config/.env"; set +a; fi
PB_BIN="$ROOT/services/pocketbase/pocketbase"



# Vérifier si PocketBase est en ligne
PB_URL="http://${PB_HOST:-127.0.0.1}:${POCKETBASE_PORT:-8090}"
if curl -s --max-time 2 "$PB_URL/api/health" >/dev/null; then
  # Si PB est en ligne, demander l'email et tenter un login admin
  echo "👤 Vérification de l'existence du superadmin PocketBase (en ligne)"
  read -rp "Email admin à vérifier : " ADMIN_EMAIL
  read -srp "Mot de passe admin à vérifier (saisi caché) : " ADMIN_PASS
  echo
  LOGIN=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\"}")
  if echo "$LOGIN" | grep -q 'token'; then
    echo "✅ Un superadmin existe déjà (login réussi)."
    exit 0
  fi
else
  # Vérifier à froid si un superadmin existe déjà
  EXISTING_ADMIN=$("$PB_BIN" --dir "$POCKETBASE_DATA_DIR" superuser list 2>/dev/null | grep -E 'email: .+')
  if [ -n "$EXISTING_ADMIN" ]; then
    echo "✅ Un superadmin existe déjà :"
    echo "$EXISTING_ADMIN"
    exit 0
  fi
  # La commande nécessite que PB soit arrêté (elle agit sur pb_data/)
  if pgrep -f "pocketbase serve" >/dev/null 2>&1; then
    echo "⚠️  PocketBase semble tourner. La création de superuser agit sur pb_data/ à froid."
    read -rp "Arrête PocketBase puis appuie sur Entrée pour continuer (ou ^C pour annuler) : " _
  fi
fi

echo "👤 Création d'un superuser PocketBase (admin)"
read -rp "Email admin : " ADMIN_EMAIL
read -srp "Mot de passe admin (saisi caché) : " ADMIN_PASS
echo
"$PB_BIN" --dir "$POCKETBASE_DATA_DIR" superuser create "$ADMIN_EMAIL" "$ADMIN_PASS"
echo "✅ Superuser créé pour $ADMIN_EMAIL"
