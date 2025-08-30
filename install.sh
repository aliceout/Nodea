#!/usr/bin/env bash
# install.sh — Orchestrateur minimal
# Enchaîne : install binaire → start → check/create admin → apply schema → health check
# Ne mélange pas les responsabilités des sous-scripts.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$here"

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
ask() { echo "❔ $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise manquante : $1"
}

require_cmd bash
require_cmd curl

# --- 1) Charger config/.env ou déclencher setup si insuffisant ---
ENV_FILE="$REPO_ROOT/config/.env"

if [[ -f "$ENV_FILE" ]]; then
  ask ".env déjà présent. Voulez-vous le réécrire ? (y/N)"
  read -r ans
  ans="${ans:-N}"
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    bash ./config/script/setup_env.sh
  fi
fi

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
  fi
}

has_core_env() {
  [[ "${PB_HOST:-}" != "" && "${PB_PORT:-}" != "" && "${PB_DATA_DIR:-}" != "" ]]
}

load_env

if ! has_core_env; then
  info "Variables requises absentes"
  ask "Lancer ./setup_env.sh maintenant ? (Y/n)"
  read -r ans
  ans="${ans:-Y}"
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    bash ./config/script/setup_env.sh
    load_env
    has_core_env || die "Variables toujours manquantes après setup. Vérifie setup_env.sh."
  else
    die "Annulé. Exécute d’abord ./setup_env.sh pour renseigner l’environnement."
  fi
fi

# Par choix explicite : PB_HOST=127.0.0.1 dans tous les cas
if [[ "${PB_HOST}" != "127.0.0.1" ]]; then
  info "Forçage PB_HOST=127.0.0.1 (conformément à la décision)."
  PB_HOST="127.0.0.1"
fi

# ENV peut être posé par setup (dev/prod). Si absent, on suppose dev.
ENV_MODE="${ENV:-dev}"

ok "Environnement chargé."
echo "  PB_DATA_DIR=$PB_DATA_DIR"
echo "  PB_HOST=$PB_HOST"
echo "  PB_PORT=$PB_PORT"
echo "  ENV=$ENV_MODE"

# --- 2) Installer le binaire PocketBase ---
info "Installation/MAJ du binaire PocketBase…"
bash ./config/script/install_pocketbase.sh
ok "Binaire OK."

# --- 3) Démarrer PocketBase ---
info "Démarrage de PocketBase…"
bash ./config/script/start_pocketbase.sh
ok "Start script exécuté."

# Attente courte que l’API locale réponde
LOCAL_BASE="http://127.0.0.1:${PB_PORT}"
info "Attente que ${LOCAL_BASE}/api/health réponde…"
for i in {1..40}; do
  if curl -sSf "${LOCAL_BASE}/api/health" >/dev/null 2>&1; then
    ok "PocketBase répond localement."
    break
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    die "PocketBase ne répond pas sur ${LOCAL_BASE}/api/health. Regarde les logs et réessaie."
  fi
done

# --- 4) Vérifier/Créer le superadmin ---
info "Vérification de l’existence du superadmin…"
if bash ./config/script/check_superadmin.sh; then
  ok "Superadmin déjà présent."
else
  info "Superadmin absent → création…"
  bash ./config/script/create_admin.sh
  ok "Superadmin créé."
fi

# --- 5) Appliquer le schéma (idempotent) ---
info "Application du schéma…"
ask "Importer le schéma des tables maintenant ? (y/N)"
read -r ans
ans="${ans:-N}"
if [[ "$ans" =~ ^[Yy]$ ]]; then
  info "Application du schéma…"
  require_cmd node
  node ./config/script/apply_schema.mjs
  ok "Schéma appliqué."
else
  info "Import du schéma ignoré."
fi

# --- 6) Test de santé final selon le mode ---
API_BASE="$LOCAL_BASE"
if [[ "$ENV_MODE" == "prod" ]]; then
  FRONT_ENV="frontend/.env"
  if [[ -f "$FRONT_ENV" ]]; then
    PUB_URL="$(grep -E '^VITE_API_URL=' "$FRONT_ENV" | sed 's/^VITE_API_URL=//')"
    if [[ -n "${PUB_URL:-}" ]]; then
      API_BASE="$PUB_URL"
    else
      info "VITE_API_URL absent de $FRONT_ENV : testera l’URL locale."
    fi
  else
    info "$FRONT_ENV introuvable : testera l’URL locale."
  fi
fi

info "Test final : ${API_BASE}/api/health"
if curl -sSf "${API_BASE}/api/health" >/dev/null; then
  ok "Health OK sur ${API_BASE}."
else
  die "Échec du health check sur ${API_BASE}. Vérifie ton réseau/URL publique/SSL."
fi

echo
ok "Installation terminée."
info "Résumé :"
echo "  ENV=$ENV_MODE"
echo "  PB_DATA_DIR=$PB_DATA_DIR"
echo "  Local API : ${LOCAL_BASE}"
if [[ "$ENV_MODE" == "prod" ]]; then
  echo "  Public API : ${API_BASE}"
fi

info "Arrêt de Pocketbase"
bash ./config/script/stop_pocketbase.sh