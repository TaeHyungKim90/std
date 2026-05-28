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

echo "[INFO] Starting local server: uv run --project backend python ./backend/app/main.py"
uv run --project backend python "./backend/app/main.py"
