#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "[INFO] uv not found. Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
  if ! command -v uv >/dev/null 2>&1; then
    echo "[ERROR] uv was installed but is not available in this shell."
    echo "Restart your shell or source your profile, then run this script again."
    exit 1
  fi
fi

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
uv run --project backend python -m uvicorn main:app --app-dir "./backend/app" --host 0.0.0.0 --port "${APP_PORT}"
