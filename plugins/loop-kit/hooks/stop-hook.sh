#!/bin/bash

# loop-kit Stop hook — セッション内ループの心臓部。
# 状態ファイル(.claude/loop-kit.local.md)がある間だけセッション終了をブロックし、
# 同じプロンプトを再投入する。状態ファイルが無ければ即座に exit 0(無害)。
#
# 実装は Anthropic 公式 ralph-wiggum プラグインの stop-hook.sh の設計を踏襲:
# https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum

set -euo pipefail

HOOK_INPUT=$(cat)

STATE_FILE=".claude/loop-kit.local.md"

if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

# 依存チェック: jq が無い環境では安全側(ループ停止)に倒す
if ! command -v jq >/dev/null 2>&1; then
  echo "⚠️  loop-kit: jq が見つかりません。セッション内ループには jq が必要です(brew install jq)。ループを停止します。" >&2
  rm "$STATE_FILE"
  exit 0
fi

# frontmatter(--- で囲まれた YAML)から設定を読む
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$STATE_FILE")
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/')

# セッション所有権チェック: このループを起動した本人セッションだけを対象にする。
# Stop hook は同じ cwd で動く全セッションの終了で発火するため、所有者を照合しないと
# 無関係なセッションまで block してループプロンプトを再投入してしまう(誤爆)。
# 所有者未確定(空)のときは、起動直後に最初に停止する本人セッションが下の
# atomic 更新で claim する。
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
OWNER_SESSION=$(echo "$FRONTMATTER" | grep '^session_id:' | sed 's/session_id: *//' | sed 's/^"\(.*\)"$/\1/' || echo "")

if [[ -n "$OWNER_SESSION" ]] && [[ "$OWNER_SESSION" != "null" ]] && [[ "$OWNER_SESSION" != "$SESSION_ID" ]]; then
  # 別セッションのループ。状態ファイルには一切触れず素通りする。
  exit 0
fi

# 数値フィールドの検証(壊れた状態ファイルは削除して停止)
if [[ ! "$ITERATION" =~ ^[0-9]+$ ]] || [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "⚠️  loop-kit: 状態ファイルが壊れています($STATE_FILE)。ループを停止します。/loop-run で再開できます。" >&2
  rm "$STATE_FILE"
  exit 0
fi

# 上限チェック(max_iterations は必須の安全機構。0 = 無制限は loop-kit では非推奨)
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "🛑 loop-kit: 上限 $MAX_ITERATIONS イテレーションに到達。ループを終了します。/loop-review で振り返りを。"
  rm "$STATE_FILE"
  exit 0
fi

# transcript から最後のアシスタントメッセージを取り出す
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  echo "⚠️  loop-kit: transcript が見つかりません。ループを停止します。" >&2
  rm "$STATE_FILE"
  exit 0
fi

# transcript の JSONL は content ブロック(thinking / text / tool_use)ごとに
# 別々の assistant 行として記録される。ターン末尾が tool_use / thinking のことが
# あるため「最後の1行」だけ見るとテキストが空になり誤って自己停止する。
# → 全 assistant 行から「直近の非空テキスト」を走査して採用する。
#   改行を含むテキストを行単位で扱うため @base64 経由でエンコードし、最後に復号する。
LAST_OUTPUT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" \
  | jq -r 'select(.message.content | type == "array")
           | .message.content
           | map(select(.type == "text") | .text)
           | join("\n")
           | select(length > 0)
           | @base64' 2>/dev/null \
  | tail -1 \
  | { base64 --decode 2>/dev/null || base64 -d 2>/dev/null || true; })

if [[ -z "$LAST_OUTPUT" ]]; then
  echo "⚠️  loop-kit: アシスタントの非空テキストが見つかりませんでした。ループを停止します。" >&2
  rm "$STATE_FILE"
  exit 0
fi

# 完了宣言チェック: <promise>...</promise> の中身が完全一致したら正常終了
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")
  if [[ -n "$PROMISE_TEXT" ]] && [[ "$PROMISE_TEXT" = "$COMPLETION_PROMISE" ]]; then
    echo "✅ loop-kit: 完了宣言 <promise>$COMPLETION_PROMISE</promise> を検出。$ITERATION イテレーションで完了。"
    rm "$STATE_FILE"
    exit 0
  fi
fi

# 継続: 同じプロンプトを再投入する
NEXT_ITERATION=$((ITERATION + 1))

# プロンプト本文 = 2つ目の --- 以降すべて
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$STATE_FILE")

if [[ -z "$PROMPT_TEXT" ]]; then
  echo "⚠️  loop-kit: 状態ファイルにプロンプトがありません。ループを停止します。" >&2
  rm "$STATE_FILE"
  exit 0
fi

# イテレーション数を更新(atomic に置換)。同時に session_id を本人のIDに確定(claim)し、
# 以後は別セッションの Stop がこのファイルを block しないようにする。
TEMP_FILE="${STATE_FILE}.tmp.$$"
sed -e "s/^iteration: .*/iteration: $NEXT_ITERATION/" \
    -e "s/^session_id: .*/session_id: \"$SESSION_ID\"/" \
    "$STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$STATE_FILE"

if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  SYSTEM_MSG="🔄 loop-kit iteration $NEXT_ITERATION/$MAX_ITERATIONS | 終了するには <promise>$COMPLETION_PROMISE</promise> を出力(宣言が真のときだけ。嘘の宣言でループを抜けない)"
else
  SYSTEM_MSG="🔄 loop-kit iteration $NEXT_ITERATION/$MAX_ITERATIONS | 完了宣言なし: 上限到達まで回ります"
fi

jq -n \
  --arg prompt "$PROMPT_TEXT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
