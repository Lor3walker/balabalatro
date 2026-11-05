#!/bin/bash
# 无头 Edge 视觉快照。先运行 npm run serve，再执行 bash test/shots.sh。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDGE="${EDGE:-/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge}"
URL="${URL:-http://localhost:8767}"
if [[ ! -x "$EDGE" ]]; then
  printf '找不到 Edge，请通过 EDGE 环境变量指定 Chromium 可执行文件。\n' >&2
  exit 1
fi
for scene in menu blinds round shop pack cash collection; do
  "$EDGE" --headless=new --no-first-run --no-default-browser-check --hide-scrollbars \
    --user-data-dir="$ROOT/.cache/visual" --force-device-scale-factor=1 --window-size=1600,900 \
    --screenshot="$ROOT/screenshots/$scene.png" --virtual-time-budget=1800 \
    "$URL/index.html?scene=$scene" >/dev/null 2>&1
  printf '截图完成：%s\n' "$scene"
done
