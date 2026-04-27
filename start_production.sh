#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f "venv/bin/python" ]]; then
  echo "[ERROR] venv not found: $(pwd)/venv"
  echo "Create it first: python3 -m venv venv"
  exit 1
fi

source "venv/bin/activate"

if [[ ! -f "./deploy_frontend.sh" ]]; then
  echo "[ERROR] deploy_frontend.sh not found in project root."
  exit 1
fi

if [[ ! -x "./deploy_frontend.sh" ]]; then
  echo "[INFO] Making deploy_frontend.sh executable..."
  chmod +x "./deploy_frontend.sh"
fi

echo "[INFO] Deploying frontend build to ./static ..."
bash "./deploy_frontend.sh"

export ENVIRONMENT=production
export DEV_AUTO_START_REACT=false
export BOOTSTRAP_DEFAULT_ADMIN=false
export ALLOW_LEGACY_PUBLIC_APPLY=false
export ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS=false

APP_PORT="${APP_PORT:-8000}"

echo "[INFO] Starting production server on port ${APP_PORT}"
python -m uvicorn main:app --app-dir "./backend/app" --host 0.0.0.0 --port "${APP_PORT}"
