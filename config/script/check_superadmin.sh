#!/usr/bin/env bash
set -euo pipefail

# Chemin vers le binaire PocketBase
PB_BIN="services/pocketbase/pocketbase"
if [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" =~ msys|mingw|cygwin|windowsnt ]]; then
	PB_BIN="services/pocketbase/pocketbase.exe"
fi


# Lecture de la variable POCKETBASE_DATA_DIR depuis .env si présente
ENV_PATH="config/.env"
if [ -f "$ENV_PATH" ]; then
	set -a; source "$ENV_PATH"; set +a
fi
DATA_DIR="${POCKETBASE_DATA_DIR:-data}"
DB_PATH="$DATA_DIR/data.db"


# Email et mot de passe superuser
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-$1}"
SUPERUSER_PASS="${SUPERUSER_PASS:-$2}"

# Vérification stricte du mot de passe (PocketBase >= v0.29 : min 8 caractères)
if [[ -z "$SUPERUSER_EMAIL" || -z "$SUPERUSER_PASS" ]]; then
	echo "Usage: $0 <email> <password> (ou variables d'environnement SUPERUSER_EMAIL/SUPERUSER_PASS)"
	exit 1
fi
if [[ ${#SUPERUSER_PASS} -lt 8 ]]; then
	echo "❌ Mot de passe trop court (min 8 caractères pour PocketBase)."
	exit 1
fi


# Verbose : affichage des paramètres
echo "[VERBOSE] DB_PATH='$DB_PATH' PB_BIN='$PB_BIN' SUPERUSER_EMAIL='$SUPERUSER_EMAIL'"
# Vérifie si la table _superusers existe et si l'email existe déjà
HAS_SUPERUSER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM _superusers;" 2>/dev/null || echo "0")
echo "[VERBOSE] Nombre de superusers en base : $HAS_SUPERUSER"
EMAIL_EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM _superusers WHERE email='$SUPERUSER_EMAIL';" 2>/dev/null || echo "0")
echo "[VERBOSE] Email '$SUPERUSER_EMAIL' existe déjà : $EMAIL_EXISTS"

if [[ "$EMAIL_EXISTS" -gt 0 ]]; then
	echo "⚠️  Un superuser avec cet email existe déjà."
	exit 0
fi

if [[ "$HAS_SUPERUSER" -gt 0 ]]; then
	echo "✅ Un superuser existe déjà (mais pas cet email)."
	exit 0
fi

echo "➕ Aucun superuser trouvé, création via CLI..."
CREATE_OUTPUT=""
CREATE_EXIT=1
if CREATE_OUTPUT=$("$PB_BIN" --dir "$DATA_DIR" superuser create "$SUPERUSER_EMAIL" "$SUPERUSER_PASS" 2>&1); then
	CREATE_EXIT=0
else
	CREATE_EXIT=$?
fi
echo "[VERBOSE] Résultat création superuser : code=$CREATE_EXIT"
if [[ $CREATE_EXIT -eq 0 ]]; then
	echo "$CREATE_OUTPUT"
	echo "✅ Superuser créé."
else
	# Extraction du message d'erreur PocketBase
	echo "$CREATE_OUTPUT" | grep -E "(error|Error|must be unique|password|invalid|failed|too short|already exists)" || echo "$CREATE_OUTPUT"
	echo "❌ Échec création superuser. Vérifiez que l'email est unique et le mot de passe valide."
	exit 1
fi
