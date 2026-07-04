#!/usr/bin/env bash
# promote.sh — 開発リポジトリの場所を解決し、画像の昇格と git 操作を補助する。
# キャッシュ(実行時コピー)ではなく必ず開発リポジトリ(原本)を操作する。
#
# 使い方:
#   promote.sh init [repoパス]           # このマシン用に config を作成/更新(新PCで最初に一度)
#   promote.sh path                      # 開発リポジトリの lab-slides ディレクトリを表示
#   promote.sh asset <画像パス> [新名]    # 画像を repo の assets/ にコピー
#   promote.sh commit "<メッセージ>"      # repo で add + commit(autoPush 設定なら push も)
set -euo pipefail

CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/lab-slides/config.json"

# --- init: 開発リポジトリの clone 内から自分の位置を検出して config を書く ---
# 新しいマシンでは: リポジトリを clone → その中の promote.sh を `init` で叩く。
if [ "${1:-}" = "init" ]; then
  if [ -n "${2:-}" ]; then
    ROOT="$(cd "$2" && pwd)"                      # 明示パス指定
  else
    # 自分(このスクリプト)の位置から上へ marketplace.json を探す
    d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ROOT=""
    while [ "$d" != "/" ]; do
      if [ -f "$d/.claude-plugin/marketplace.json" ]; then ROOT="$d"; break; fi
      d="$(dirname "$d")"
    done
    if [ -z "$ROOT" ]; then
      echo "ERROR: 開発リポジトリを自動検出できませんでした。" >&2
      echo "clone した repo の中の promote.sh を実行するか、パスを渡してください:" >&2
      echo "  bash <repo>/plugins/lab-slides/scripts/promote.sh init <repoの絶対パス>" >&2
      exit 1
    fi
  fi
  # pluginDir = このスクリプトの2つ上(scripts/ の親)を ROOT からの相対で算出
  PLUGIN_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  PDIR="${PLUGIN_ABS#$ROOT/}"
  [ "$PDIR" = "$PLUGIN_ABS" ] && PDIR="plugins/lab-slides"   # 相対化に失敗したら既定
  # 既存 autoPush を保持
  AP="false"
  [ -f "$CONFIG" ] && AP=$(sed -n 's/.*"autoPush"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' "$CONFIG")
  [ -z "$AP" ] && AP="false"
  mkdir -p "$(dirname "$CONFIG")"
  cat > "$CONFIG" <<EOF
{
  "repoPath": "$ROOT",
  "pluginDir": "$PDIR",
  "autoPush": $AP
}
EOF
  echo "wrote: $CONFIG"
  echo "  repoPath = $ROOT"
  echo "  pluginDir = $PDIR"
  exit 0
fi

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: 設定がありません: $CONFIG" >&2
  echo 'このマシンは開発リポジトリの場所が未設定です。repo を clone してから:' >&2
  echo '  bash <repo>/plugins/lab-slides/scripts/promote.sh init' >&2
  echo '(clone していないマシンは /plugin update で受け取る消費専用です)' >&2
  exit 1
fi

# 依存を増やさないよう素朴に値を抽出
REPO=$(sed -n 's/.*"repoPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG")
PDIR=$(sed -n 's/.*"pluginDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG")
AUTOPUSH=$(sed -n 's/.*"autoPush"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' "$CONFIG")
PLUGIN="$REPO/$PDIR"

if [ ! -d "$PLUGIN" ]; then
  echo "ERROR: 開発リポジトリが見つかりません: $PLUGIN" >&2
  echo "パスが変わった可能性があります。再設定してください:" >&2
  echo "  bash <repo>/plugins/lab-slides/scripts/promote.sh init" >&2
  exit 1
fi

cmd="${1:-path}"
case "$cmd" in
  path)
    echo "$PLUGIN"
    ;;
  asset)
    SRC="${2:?usage: promote.sh asset <画像パス> [新名]}"
    NAME="${3:-$(basename "$SRC")}"
    cp "$SRC" "$PLUGIN/assets/$NAME"
    echo "copied: $PLUGIN/assets/$NAME"
    ;;
  commit)
    MSG="${2:?usage: promote.sh commit \"<メッセージ>\"}"
    git -C "$REPO" add -A "$PDIR"
    git -C "$REPO" commit -m "$MSG"
    echo "committed in $REPO"
    if [ "$AUTOPUSH" = "true" ]; then
      git -C "$REPO" push && echo "pushed"
    else
      echo "次: cd $REPO && git push   その後 各マシンで /plugin update lab-slides"
    fi
    ;;
  *)
    echo "unknown command: $cmd" >&2; exit 1
    ;;
esac
