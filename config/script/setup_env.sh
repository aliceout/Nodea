#!/usr/bin/env bash
# setup_env.sh — configure l’environnement (backend + frontend)
# - Pose les variables PB_DATA_DIR, PB_PORT, PB_HOST
# - Écrit/MAJ config/.env (backend) et frontend/.env (frontend)
# - Demande dev/prod et URL publique en prod
# - Ne lance pas PocketBase directement (c’est install.sh qui orchestre)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$here")")"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
ask() { echo "❔ $*"; }

# Déduire la racine du repo depuis config/script/

BACK_ENV="$REPO_ROOT/config/.env"
FRONT_ENV="$REPO_ROOT/frontend/.env"

# --- 1) Vérifier frontend/.env existant ---
rewrite_front_env="Y"
if [[ -f "$FRONT_ENV" ]]; then
ask "$FRONT_ENV existe déjà. Réécrire ? (y/N)"
read -r ans  ans="${ans:-N}"
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    rewrite_front_env="N"
    info "On garde le fichier frontend/.env existant."
  fi
fi

# --- 2) Demander le dossier data ---
ask "Chemin des données [data] : "
read -r data_dir
data_dir="${data_dir:-data}"
data_dir="$REPO_ROOT/$data_dir"
ok "Dossier données = $data_dir"

# --- 3) Demander le port ---
while true; do
ask "Port HTTP PocketBase [8090] : "
read -r port  port="${port:-8090}"

  if lsof -i :"$port" >/dev/null 2>&1; then
    echo "❌ Port $port déjà utilisé."
    continue
  fi
  break
done
ok "Port = $port"

# --- 4) Demander environnement dev/prod ---
ask "Environnement (dev/prod) [dev] : "
read -r env_mode
env_mode="${env_mode:-dev}"

PB_HOST="127.0.0.1"
VITE_API_URL="http://${PB_HOST}:${port}"

if [[ "$env_mode" == "prod" ]]; then
  while true; do
    ask "URL publique API (ex: https://api.exemple.org) : "
    read -r pub_url
    if [[ "$pub_url" =~ ^https://[a-zA-Z0-9._-]+(\.[a-zA-Z0-9._-]+)+$ ]]; then
      VITE_API_URL="$pub_url"
      break
    else
      echo "❌  URL invalide. Doit être https://domaine.tld"
    fi
  done
fi

# --- 5) Écrire config/.env backend ---
cat > "$BACK_ENV" <<EOF
PB_HOST=$PB_HOST
PB_PORT=$port
PB_DATA_DIR=$data_dir
ENV=$env_mode
EOF
ok "Fichier $BACK_ENV écrit."

# --- 6) Écrire frontend/.env ---
if [[ "$rewrite_front_env" == "Y" ]]; then
  cat > "$FRONT_ENV" <<EOF
VITE_API_URL=$VITE_API_URL
EOF
  ok "Fichier $FRONT_ENV écrit."
fi

# --- 7) Résumé ---
echo
ok "Configuration terminée."
echo "  PB_DATA_DIR=$data_dir"
echo "  PB_PORT=$port"
echo "  PB_HOST=$PB_HOST"
echo "  ENV=$env_mode"
echo "  VITE_API_URL=$VITE_API_URL"

# On ne lance pas PocketBase ici.
# C’est install.sh qui prendra le relais.
