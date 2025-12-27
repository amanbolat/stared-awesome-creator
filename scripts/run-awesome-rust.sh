#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${ROOT_DIR}/configs/awesome-rust.yml"
CACHE_PATH="${STAR_CACHE_PATH:-${ROOT_DIR}/.cache/stars.db}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required to push updates." >&2
  exit 1
fi

mkdir -p "$(dirname "$CACHE_PATH")"

npm --prefix "$ROOT_DIR" run build
node "${ROOT_DIR}/dist/index.js" --config "$CONFIG_PATH" --cachePath "$CACHE_PATH"
