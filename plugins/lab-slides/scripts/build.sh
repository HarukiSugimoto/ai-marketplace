#!/usr/bin/env bash
# lab-slides ビルドラッパー(二枚看板)
#
# 入力は deck.json(唯一の真実)。そこから2系統を生成する:
#   build.sh <deck.json> html         プレビュー(Marp/HTML、高速)
#   build.sh <deck.json> pdf          提出用 PDF(Marp)
#   build.sh <deck.json> pptx         編集可能 pptx(自作 PptxGenJS レンダラー・図形保持)★本番
#   build.sh <deck.json> all          html + pptx を両方
#
# 後方互換: 第1引数が .md の場合は従来どおり Marp で直接ビルドする。
set -euo pipefail

SRC="${1:?usage: build.sh <deck.json|slides.md> [html|pdf|pptx|all]}"
FMT="${2:-html}"
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$(cd "$(dirname "$SRC")" && pwd)"
BASE="$(basename "$SRC")"; BASE="${BASE%.*}"

# --- 自作 pptx レンダラー(deck.json 専用) ---
render_pptx() {
  if [ ! -d "$PLUGIN_ROOT/node_modules/pptxgenjs" ]; then
    echo "pptxgenjs 未導入。インストールします..." >&2
    ( cd "$PLUGIN_ROOT" && npm install >/dev/null 2>&1 )
  fi
  node "$PLUGIN_ROOT/scripts/render-pptx.js" "$SRC" "$SRC_DIR/$BASE.pptx"
}

# --- Marp 系(html/pdf)。deck.json なら一旦 slides.md に変換してから ---
render_marp() {
  local fmt="$1"
  local md="$SRC"
  case "$SRC" in
    *.json) md="$SRC_DIR/$BASE.md"; node "$PLUGIN_ROOT/scripts/render-marp.js" "$SRC" "$md" ;;
  esac

  # トークン CSS を tokens.json から再生成(色・フォントの単一の真実)
  node "$PLUGIN_ROOT/scripts/gen-tokens-css.js" >/dev/null

  # プロジェクト層 theme.css を探索(md の場所から上へ .lab-slides/)
  local proj_theme="" dir="$SRC_DIR"
  while [ "$dir" != "/" ]; do
    [ -f "$dir/.lab-slides/theme.css" ] && { proj_theme="$dir/.lab-slides/theme.css"; break; }
    dir="$(dirname "$dir")"
  done

  # テーマ合成: _tokens.css(生成) + lab.css + (あれば)プロジェクト theme.css
  local merged="$SRC_DIR/.lab-theme-merged.css"
  cat "$PLUGIN_ROOT/theme/_tokens.css" "$PLUGIN_ROOT/theme/lab.css" ${proj_theme:+"$proj_theme"} > "$merged"
  [ -n "$proj_theme" ] && echo "project theme: $proj_theme"

  local out="$SRC_DIR/$BASE.$fmt"
  npx --yes @marp-team/marp-cli --theme-set "$merged" --html --allow-local-files --"$fmt" "$md" -o "$out"
  echo "built: $out"
}

case "$FMT" in
  html|pdf) render_marp "$FMT" ;;
  pptx)
    case "$SRC" in
      *.json) render_pptx ;;
      *) echo "pptx(編集可能・図形保持)は deck.json 入力が必要です。html/pdf は .md でも可。" >&2; exit 1 ;;
    esac ;;
  all) render_marp html; render_pptx ;;
  *) echo "unknown format: $FMT (html|pdf|pptx|all)" >&2; exit 1 ;;
esac
