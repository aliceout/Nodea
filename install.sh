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



# Verbosité sur la vérification du superadmin
echo "[VERBOSE] Vérification du superadmin PocketBase à froid..."
echo "[VERBOSE] Chemin data utilisé : $POCKETBASE_DATA_DIR"
echo "[VERBOSE] Contenu du dossier data :"
ls -l "$POCKETBASE_DATA_DIR" || echo "(dossier inexistant)"
bash "$ROOT/config/script/check_superadmin.sh"
SUPERADMIN_EXISTS=0
if [ -f "config/.superadmin_cache" ]; then
  source "config/.superadmin_cache"
  echo "[VERBOSE] Résultat vérification superadmin : SUPERADMIN_EXISTS=$SUPERADMIN_EXISTS"
  cat "$ROOT/config/.superadmin_cache"
else
  echo "[VERBOSE] Fichier de cache superadmin absent."
fi

# 2) Binaire PocketBase présent ?
if [ ! -x "$PB_BIN" ]; then
  echo "❌ PocketBase introuvable à $PB_BIN"
  bash "$ROOT/config/script/install_pocketbase.sh"
fi

# 3) Résoudre host/port depuis env (ou demander si absent)
PB_HOST_RESOLVED="${PB_HOST:-127.0.0.1}"
PB_PORT_RESOLVED="${POCKETBASE_PORT:-8090}"
PB_URL="http://${PB_HOST_RESOLVED}:${PB_PORT_RESOLVED}"

# ...existing code...


# 4) S'assurer que PB tourne (via le script dédié)
bash "$START" "$PB_HOST_RESOLVED" "$PB_PORT_RESOLVED"

# 5) Création admin (interactif, agit à froid) uniquement si absent

if [ "$SUPERADMIN_EXISTS" = "1" ]; then
  echo "✅ Superadmin déjà présent, création sautée."
else
  echo "👤 Création d'un superuser PocketBase (admin)"
  read -rp "Email admin : " ADMIN_EMAIL
  read -srp "Mot de passe admin (saisi caché) : " ADMIN_PASS
  echo
  "$PB_BIN" --dir "$POCKETBASE_DATA_DIR" superuser create "$ADMIN_EMAIL" "$ADMIN_PASS"
  echo "✅ Superuser créé pour $ADMIN_EMAIL"
fi

# 6) Appliquer schéma + rules (interactif : demande email/pass admin) — toujours exécuté
node "$ROOT/config/script/apply_schema.mjs" "$PB_URL"

echo "✅ Installation terminée."
