#!/usr/bin/env bash
# lab-slides ビルドラッパー
# 使い方: build.sh <slides.md> [html|pdf|pptx]
# テーマ: プラグインの lab.css + (あれば) プロジェクト層の theme.css を合成して適用
set -euo pipefail

SRC="${1:?usage: build.sh <slides.md> [html|pdf|pptx]}"
FMT="${2:-html}"
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$(cd "$(dirname "$SRC")" && pwd)"
BASE="$(basename "${SRC%.md}")"

# プロジェクト層の theme.css を探す(SRC の場所から上へ .lab-slides/ を探索)
PROJECT_THEME=""
dir="$SRC_DIR"
while [ "$dir" != "/" ]; do
  if [ -f "$dir/.lab-slides/theme.css" ]; then
    PROJECT_THEME="$dir/.lab-slides/theme.css"
    break
  fi
  dir="$(dirname "$dir")"
done

# テーマ合成: lab.css + プロジェクト上書き(@theme 名は lab のまま)
THEME="$PLUGIN_ROOT/theme/lab.css"
if [ -n "$PROJECT_THEME" ]; then
  MERGED="$SRC_DIR/.lab-theme-merged.css"
  cat "$PLUGIN_ROOT/theme/lab.css" "$PROJECT_THEME" > "$MERGED"
  THEME="$MERGED"
  echo "project theme: $PROJECT_THEME"
fi

OUT="$SRC_DIR/$BASE.$FMT"
npx --yes @marp-team/marp-cli \
  --theme-set "$THEME" \
  --html \
  --allow-local-files \
  --"$FMT" "$SRC" -o "$OUT"

echo "built: $OUT"
