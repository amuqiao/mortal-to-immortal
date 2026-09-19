#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL_DIR="$ROOT_DIR/assets/video-cutout-cropper"

cd "$TOOL_DIR"

if [[ ! -d node_modules ]]; then
  echo "缺少 node_modules，请先安装依赖："
  echo "  cd $TOOL_DIR && npm ci"
  exit 2
fi

exec npm run dev -- --host 127.0.0.1 --port "${PORT:-5174}"
