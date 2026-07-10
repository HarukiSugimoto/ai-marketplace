#!/bin/bash

# loop-kit ファンアウトランナー(Codex 版)
#
# fanout.sh の Codex CLI 版。各項目の処理を `claude -p` ではなく `codex exec` で行う。
# 別ターミナルで実行する。
#
# 使い方:
#   fanout.codex.sh -l items.txt -P 'Migrate {} from X to Y. 最後に OK か FAIL だけを出力。' [オプション]
#
# オプション:
#   -l FILE   タスクリストファイル(必須、1行1項目)
#   -P TEXT   プロンプトテンプレート(必須、{} が各行で置換される)
#   -s MODE   codex の sandbox(read-only | workspace-write | danger-full-access。
#             デフォルト: workspace-write)
#   -m MODEL  codex のモデル(任意)
#   -o DIR    出力ディレクトリ(デフォルト: .loop/fanout)
#   -d        --dangerously-bypass-approvals-and-sandbox で実行(隔離環境でのみ推奨)
#
# 結果: <出力DIR>/results.csv に run_id,item,status を追記。ログは1項目1ファイル。
# ヒント: まず2〜3項目で試してプロンプトを改善してから全体に適用する。

set -uo pipefail

LIST_FILE=""
PROMPT_TMPL=""
SANDBOX="workspace-write"
MODEL=""
OUT_DIR=".loop/fanout"
DANGEROUS=0

while getopts "l:P:s:m:o:d" opt; do
  case $opt in
    l) LIST_FILE="$OPTARG" ;;
    P) PROMPT_TMPL="$OPTARG" ;;
    s) SANDBOX="$OPTARG" ;;
    m) MODEL="$OPTARG" ;;
    o) OUT_DIR="$OPTARG" ;;
    d) DANGEROUS=1 ;;
    *) echo "不明なオプション" >&2; exit 1 ;;
  esac
done

if [[ -z "$LIST_FILE" ]] || [[ ! -f "$LIST_FILE" ]]; then
  echo "エラー: タスクリストを -l で指定してください" >&2
  exit 1
fi
if [[ -z "$PROMPT_TMPL" ]] || [[ "$PROMPT_TMPL" != *"{}"* ]]; then
  echo "エラー: -P に {} を含むプロンプトテンプレートを指定してください" >&2
  exit 1
fi
if ! command -v codex >/dev/null 2>&1; then
  echo "エラー: codex CLI が見つかりません。" >&2
  exit 1
fi

RUN_ID=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$OUT_DIR/$RUN_ID"
mkdir -p "$LOG_DIR"
RESULTS="$OUT_DIR/results.csv"
[[ -f "$RESULTS" ]] || echo "run_id,item,status" > "$RESULTS"

TOTAL=$(grep -c . "$LIST_FILE")
N=0; OK=0; FAIL=0

trap 'echo ""; echo "🛑 手動停止($N/$TOTAL 処理済、OK:$OK FAIL:$FAIL)。結果: $RESULTS"; exit 130' INT

echo "▶ loop-kit fanout (Codex) 開始: $TOTAL 項目(ログ: $LOG_DIR)"

while IFS= read -r ITEM; do
  [[ -z "$ITEM" ]] && continue
  N=$((N + 1))
  SAFE_NAME=$(printf '%s' "$ITEM" | tr '/ :' '___' | cut -c1-80)
  LOG_FILE="$LOG_DIR/$(printf '%03d' "$N")-$SAFE_NAME.log"
  PROMPT="${PROMPT_TMPL//\{\}/$ITEM}"

  echo ""
  echo "━━━ [$N/$TOTAL] $ITEM"

  CODEX_ARGS=(exec)
  if [[ $DANGEROUS -eq 1 ]]; then
    CODEX_ARGS+=(--dangerously-bypass-approvals-and-sandbox)
  else
    CODEX_ARGS+=(-s "$SANDBOX")
  fi
  [[ -n "$MODEL" ]] && CODEX_ARGS+=(-m "$MODEL")
  CODEX_ARGS+=("$PROMPT")

  # stdin は明示的に閉じる(exec の stdin 待ちハング回避)
  OUTPUT=$(codex "${CODEX_ARGS[@]}" < /dev/null 2>&1)
  printf '%s\n' "$OUTPUT" > "$LOG_FILE"

  if printf '%s' "$OUTPUT" | tail -5 | grep -qw "OK"; then
    STATUS="OK"; OK=$((OK + 1))
  else
    STATUS="FAIL"; FAIL=$((FAIL + 1))
  fi
  echo "  → $STATUS"
  echo "$RUN_ID,$ITEM,$STATUS" >> "$RESULTS"
done < "$LIST_FILE"

echo ""
echo "✅ fanout 完了: $N 項目(OK: $OK / FAIL: $FAIL)"
echo "   結果: $RESULTS"
[[ $FAIL -gt 0 ]] && echo "   FAIL の項目はログを確認し、プロンプト改善のうえ再実行を(/loop-review)"
exit 0
