#!/bin/bash

# loop-kit 外側シェルループランナー(Codex 版)
#
# run-loop.sh の Codex CLI 版。駆動を `claude -p` ではなく `codex exec` で行う。
# それ以外の設計(二重終了ゲート・上限・ログ)は Claude 版と同じ。
# 別ターミナルで実行する。
#
# 使い方:
#   run-loop.codex.sh -p .loop/<slug>/PROMPT.md [オプション]
#
# オプション:
#   -p FILE   プロンプトファイル(必須)
#   -n N      最大イテレーション数(デフォルト: 25)
#   -c CMD    検証コマンド(例: "npm test")。指定時は「検証パス AND 完了宣言」の二重ゲート
#   -s MODE   codex の sandbox(read-only | workspace-write | danger-full-access。
#             デフォルト: workspace-write)
#   -m MODEL  codex のモデル(任意。未指定なら codex の既定)
#   -w SECS   イテレーション間の待機秒数(デフォルト: 2)
#   -d        --dangerously-bypass-approvals-and-sandbox で実行(隔離環境でのみ推奨)
#
# 終了条件:
#   1. 完了: 出力に <promise>COMPLETE</promise> があり、かつ -c 指定時は検証もパス
#   2. 上限: max iterations 到達
#   3. 手動: Ctrl-C
#
# 注意(テストで確認済み, codex-cli 0.142.5):
#   - codex exec は stdin を待つため、必ず </dev/null で閉じる(このスクリプトは対応済み)
#   - codex の hook は exec では発火しない。だから session モード相当は Codex には無く、
#     この外側ループ方式が Codex での標準になる

set -uo pipefail

PROMPT_FILE=""
MAX_ITER=25
VERIFY_CMD=""
SANDBOX="workspace-write"
MODEL=""
WAIT_SECS=2
DANGEROUS=0
PROMISE="COMPLETE"

while getopts "p:n:c:s:m:w:d" opt; do
  case $opt in
    p) PROMPT_FILE="$OPTARG" ;;
    n) MAX_ITER="$OPTARG" ;;
    c) VERIFY_CMD="$OPTARG" ;;
    s) SANDBOX="$OPTARG" ;;
    m) MODEL="$OPTARG" ;;
    w) WAIT_SECS="$OPTARG" ;;
    d) DANGEROUS=1 ;;
    *) echo "不明なオプション" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROMPT_FILE" ]] || [[ ! -f "$PROMPT_FILE" ]]; then
  echo "エラー: プロンプトファイルを -p で指定してください(例: -p .loop/api/PROMPT.md)" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "エラー: codex CLI が見つかりません。Codex 版ランナーには codex が必要です。" >&2
  exit 1
fi

LOOP_DIR=$(dirname "$PROMPT_FILE")
LOG_DIR="$LOOP_DIR/logs"
mkdir -p "$LOG_DIR"
RUN_ID=$(date +%Y%m%d-%H%M%S)

trap 'echo ""; echo "🛑 手動停止(iteration $i)。ログ: $LOG_DIR/$RUN_ID-*.log"; exit 130' INT

echo "▶ loop-kit shell loop (Codex) 開始: $PROMPT_FILE (max $MAX_ITER, verify: ${VERIFY_CMD:-なし})"

for ((i=1; i<=MAX_ITER; i++)); do
  LOG_FILE="$LOG_DIR/$RUN_ID-$(printf '%03d' "$i").log"
  echo ""
  echo "━━━ iteration $i/$MAX_ITER ($(date +%H:%M:%S)) → $LOG_FILE"

  CODEX_ARGS=(exec)
  if [[ $DANGEROUS -eq 1 ]]; then
    CODEX_ARGS+=(--dangerously-bypass-approvals-and-sandbox)
  else
    CODEX_ARGS+=(-s "$SANDBOX")
  fi
  [[ -n "$MODEL" ]] && CODEX_ARGS+=(-m "$MODEL")
  # プロンプトは引数で渡し、stdin は明示的に閉じる(exec の stdin 待ちハング回避)。
  # 作業ディレクトリは実行時の cwd(プロジェクトルートで起動する前提。Claude 版と同じ)
  CODEX_ARGS+=("$(cat "$PROMPT_FILE")")

  OUTPUT=$(codex "${CODEX_ARGS[@]}" < /dev/null 2>&1) || {
    echo "⚠️  codex の実行に失敗(exit $?)。ログを確認して継続します。" | tee -a "$LOG_FILE"
  }
  printf '%s\n' "$OUTPUT" > "$LOG_FILE"
  printf '%s\n' "$OUTPUT" | tail -20

  PROMISE_OK=0
  if printf '%s' "$OUTPUT" | grep -q "<promise>$PROMISE</promise>"; then
    PROMISE_OK=1
  fi

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
