#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f "venv/bin/python" ]]; then
  echo "[ERROR] venv not found: $(pwd)/venv"
  echo "Create it first: python3 -m venv venv"
  exit 1
fi

source "venv/bin/activate"

export ENVIRONMENT=development

# Usage:
#   ./start_local.sh		  -> backend + react
#   ./start_local.sh backend  -> backend only
if [[ "${1:-}" == "backend" ]]; then
  export DEV_AUTO_START_REACT=false
  echo "[INFO] Mode: backend only"
else
  export DEV_AUTO_START_REACT=true
  echo "[INFO] Mode: backend + react"
fi

echo "[INFO] Starting local server: python ./backend/app/main.py"
python "./backend/app/main.py"
