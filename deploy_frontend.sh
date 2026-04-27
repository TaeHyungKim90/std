#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

FRONTEND_DIR="$(pwd)/frontend"
BUILD_DIR="${FRONTEND_DIR}/build"
STATIC_DIR="$(pwd)/static"
UPLOAD_DIR="${STATIC_DIR}/uploads"

if [[ ! -f "${FRONTEND_DIR}/package.json" ]]; then
  echo "[ERROR] frontend/package.json not found."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not available in PATH."
  exit 1
fi

echo "[INFO] Building React frontend..."
(
  cd "${FRONTEND_DIR}"
  npm run build
)

if [[ ! -f "${BUILD_DIR}/index.html" ]]; then
  echo "[ERROR] Build output missing: ${BUILD_DIR}/index.html"
  exit 1
fi

mkdir -p "${STATIC_DIR}"

# Keep uploads directory, remove other existing static contents.
shopt -s dotglob nullglob
for path in "${STATIC_DIR}"/*; do
  if [[ "$(basename "$path")" == "uploads" ]]; then
    continue
  fi
  rm -rf "$path"
done
shopt -u dotglob nullglob

echo "[INFO] Copying build output to static..."
cp -a "${BUILD_DIR}/." "${STATIC_DIR}/"

if [[ -d "${UPLOAD_DIR}" ]]; then
  echo "[INFO] uploads preserved: ${UPLOAD_DIR}"
fi

echo "[INFO] Frontend deployed to ${STATIC_DIR}"
