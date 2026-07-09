#!/bin/bash

# loop-kit 外側シェルループランナー(Ralph 古典形 + 安全機構)
#
# Geoffrey Huntley の原型 `while :; do cat PROMPT.md | claude ; done` に
# 上限・検証コマンド・二重終了ゲート・ログを足したもの。
# 別ターミナルで実行する(Claude Code セッションの中からは実行しない)。
#
# 使い方:
#   run-loop.sh -p .loop/<slug>/PROMPT.md [オプション]
#
# オプション:
#   -p FILE   プロンプトファイル(必須)
#   -n N      最大イテレーション数(デフォルト: 25)
#   -c CMD    検証コマンド(例: "npm test")。指定時は「検証パス AND 完了宣言」の
#             二重ゲートで終了判定する
#   -t TOOLS  --allowedTools に渡す値(デフォルト: "Edit,Write,Read,Glob,Grep,Bash")
#   -m MODE   --permission-mode(デフォルト: acceptEdits)
#   -w SECS   イテレーション間の待機秒数(デフォルト: 2)
#   -d        --dangerously-skip-permissions で実行(隔離環境でのみ推奨)
#
# 終了条件(いずれか):
#   1. 完了: 出力に <promise>COMPLETE</promise> があり、かつ -c 指定時は検証コマンドもパス
#   2. 上限: max iterations 到達
#   3. 手動: Ctrl-C

set -uo pipefail

PROMPT_FILE=""
MAX_ITER=25
VERIFY_CMD=""
ALLOWED_TOOLS="Edit,Write,Read,Glob,Grep,Bash"
PERMISSION_MODE="acceptEdits"
WAIT_SECS=2
DANGEROUS=0
PROMISE="COMPLETE"

while getopts "p:n:c:t:m:w:d" opt; do
  case $opt in
    p) PROMPT_FILE="$OPTARG" ;;
    n) MAX_ITER="$OPTARG" ;;
    c) VERIFY_CMD="$OPTARG" ;;
    t) ALLOWED_TOOLS="$OPTARG" ;;
    m) PERMISSION_MODE="$OPTARG" ;;
    w) WAIT_SECS="$OPTARG" ;;
    d) DANGEROUS=1 ;;
    *) echo "不明なオプション" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROMPT_FILE" ]] || [[ ! -f "$PROMPT_FILE" ]]; then
  echo "エラー: プロンプトファイルを -p で指定してください(例: -p .loop/api/PROMPT.md)" >&2
  exit 1
fi

LOOP_DIR=$(dirname "$PROMPT_FILE")
LOG_DIR="$LOOP_DIR/logs"
mkdir -p "$LOG_DIR"
RUN_ID=$(date +%Y%m%d-%H%M%S)

trap 'echo ""; echo "🛑 手動停止(iteration $i)。ログ: $LOG_DIR/$RUN_ID-*.log"; exit 130' INT

echo "▶ loop-kit shell loop 開始: $PROMPT_FILE (max $MAX_ITER, verify: ${VERIFY_CMD:-なし})"

for ((i=1; i<=MAX_ITER; i++)); do
  LOG_FILE="$LOG_DIR/$RUN_ID-$(printf '%03d' "$i").log"
  echo ""
  echo "━━━ iteration $i/$MAX_ITER ($(date +%H:%M:%S)) → $LOG_FILE"

  CLAUDE_ARGS=(-p --output-format text)
  if [[ $DANGEROUS -eq 1 ]]; then
    CLAUDE_ARGS+=(--dangerously-skip-permissions)
  else
    CLAUDE_ARGS+=(--allowedTools "$ALLOWED_TOOLS" --permission-mode "$PERMISSION_MODE")
  fi

  OUTPUT=$(claude "${CLAUDE_ARGS[@]}" < "$PROMPT_FILE" 2>&1) || {
    echo "⚠️  claude の実行に失敗(exit $?)。ログを確認して継続します。" | tee -a "$LOG_FILE"
  }
  printf '%s\n' "$OUTPUT" > "$LOG_FILE"
  printf '%s\n' "$OUTPUT" | tail -20

  # 終了ゲート1: 完了宣言
  PROMISE_OK=0
  if printf '%s' "$OUTPUT" | grep -q "<promise>$PROMISE</promise>"; then
    PROMISE_OK=1
  fi

  # 終了ゲート2: 検証コマンド(指定時のみ)
  VERIFY_OK=1
  if [[ -n "$VERIFY_CMD" ]]; then
    if bash -c "$VERIFY_CMD" >> "$LOG_FILE" 2>&1; then
      VERIFY_OK=1
      echo "  ✓ verify パス: $VERIFY_CMD"
    else
      VERIFY_OK=0
      echo "  ✗ verify 失敗: $VERIFY_CMD"
    fi
  fi

  # 二重ゲート: 宣言と検証が両方揃って初めて終了(片方だけでは回り続ける)
  if [[ $PROMISE_OK -eq 1 ]] && [[ $VERIFY_OK -eq 1 ]]; then
    echo ""
    echo "✅ 完了(iteration $i): 完了宣言 + 検証パス。ログ: $LOG_DIR/$RUN_ID-*.log"
    exit 0
  fi
  if [[ $PROMISE_OK -eq 1 ]] && [[ $VERIFY_OK -eq 0 ]]; then
    echo "  ⚠️ 完了宣言が出たが検証が失敗。ループを継続します(宣言は無効)。"
  fi

  sleep "$WAIT_SECS"
done

echo ""
echo "🛑 上限 $MAX_ITER イテレーションに到達。未完了のまま終了します。"
echo "   /loop-review でログと git 履歴を振り返り、PROMPT.md を改善してください。"
exit 2
