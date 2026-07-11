#!/bin/bash

# loop-kit ファンアウトランナー
#
# タスクリスト(1行1項目)の各行に対して claude -p を1回ずつ実行する。
# 公式 best-practices の大規模マイグレーションパターン:
#   for file in $(cat files.txt); do claude -p "Migrate $file ..." ; done
# に OK/FAIL 集計とログを足したもの。別ターミナルで実行する。
#
# 使い方:
#   fanout.sh -l items.txt -P 'Migrate {} from X to Y. 最後に OK か FAIL だけを出力。' [オプション]
#
# オプション:
#   -l FILE   タスクリストファイル(必須、1行1項目)
#   -P TEXT   プロンプトテンプレート(必須、{} が各行で置換される)
#   -t TOOLS  --allowedTools に渡す値(デフォルト: "Edit,Write,Read,Glob,Grep,Bash")
#             ※ デフォルトに Task は無い。各項目内で sub-agent(レビュー/探索)を
#               隔離実行させたいなら Task を足す: -t "...,Task"。
#               付けないと同一コンテキストでインライン実行になる(隔離なし)。
#   -m MODE   --permission-mode(デフォルト: acceptEdits)
#   -o DIR    出力ディレクトリ(デフォルト: .loop/fanout)
#   -d        --dangerously-skip-permissions で実行(隔離環境でのみ推奨)
#
# 結果: <出力DIR>/results.csv に item,status を追記。ログは1項目1ファイル。
# ヒント: まず2〜3項目のリストで試してプロンプトを改善してから全体に適用する。

set -uo pipefail

LIST_FILE=""
PROMPT_TMPL=""
ALLOWED_TOOLS="Edit,Write,Read,Glob,Grep,Bash"
PERMISSION_MODE="acceptEdits"
OUT_DIR=".loop/fanout"
DANGEROUS=0

while getopts "l:P:t:m:o:d" opt; do
  case $opt in
    l) LIST_FILE="$OPTARG" ;;
    P) PROMPT_TMPL="$OPTARG" ;;
    t) ALLOWED_TOOLS="$OPTARG" ;;
    m) PERMISSION_MODE="$OPTARG" ;;
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

RUN_ID=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$OUT_DIR/$RUN_ID"
mkdir -p "$LOG_DIR"
RESULTS="$OUT_DIR/results.csv"
[[ -f "$RESULTS" ]] || echo "run_id,item,status" > "$RESULTS"

TOTAL=$(grep -c . "$LIST_FILE")
N=0; OK=0; FAIL=0

trap 'echo ""; echo "🛑 手動停止($N/$TOTAL 処理済、OK:$OK FAIL:$FAIL)。結果: $RESULTS"; exit 130' INT

echo "▶ loop-kit fanout 開始: $TOTAL 項目(ログ: $LOG_DIR)"

while IFS= read -r ITEM; do
  [[ -z "$ITEM" ]] && continue
  N=$((N + 1))
  SAFE_NAME=$(printf '%s' "$ITEM" | tr '/ :' '___' | cut -c1-80)
  LOG_FILE="$LOG_DIR/$(printf '%03d' "$N")-$SAFE_NAME.log"
  PROMPT="${PROMPT_TMPL//\{\}/$ITEM}"

  echo ""
  echo "━━━ [$N/$TOTAL] $ITEM"

  CLAUDE_ARGS=(-p --output-format text)
  if [[ $DANGEROUS -eq 1 ]]; then
    CLAUDE_ARGS+=(--dangerously-skip-permissions)
  else
    CLAUDE_ARGS+=(--allowedTools "$ALLOWED_TOOLS" --permission-mode "$PERMISSION_MODE")
  fi

  OUTPUT=$(claude "${CLAUDE_ARGS[@]}" "$PROMPT" 2>&1)
  printf '%s\n' "$OUTPUT" > "$LOG_FILE"

  # 最終行付近の OK/FAIL を拾う(プロンプト側で「最後に OK か FAIL だけを出力」と指示する)
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
