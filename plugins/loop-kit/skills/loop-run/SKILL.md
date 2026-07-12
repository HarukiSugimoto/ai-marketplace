---
name: loop-run
description: 設計済みのループ(.loop/<slug>/)を実行する。セッション内ループの開始・停止、シェルループ/ファンアウトの起動コマンド提示。「ループ回して」「ループ開始」「ループ止めて」で発動。
---

# loop-run — ループの実行

前提: `.loop/<slug>/PROMPT.md` と `loop.yaml` があること。無ければ /loop-design から。
`loop.yaml` の `mode` を読んで分岐する。

## 実行環境の判定(最初に見る)

- **Claude Code** で動いている: session / shell / fanout の全モードが使える。
  shell / fanout は `run-loop.sh` / `fanout.sh`(claude 版)を使う
- **Codex** で動いている: **session モードは使えない**(Codex は hook を headless 実行で
  発火しないため。テスト確認済み)。shell / fanout のみ。スクリプトは
  `run-loop.codex.sh` / `fanout.codex.sh`(codex exec 版)を使う。
  `loop.yaml` が `mode: session` なら「Codex では shell モードで同じことができます」と
  案内し、shell に読み替える

## mode: session — セッション内ループ(Stop hook)【Claude Code 限定】

状態ファイルを書くとこのセッションがループになる。ターン終了のたびに Stop hook が
終了をブロックし、同じプロンプトを再投入する。

1. `loop.yaml` から `max_iterations` と `completion_promise` を読む
2. `.claude/loop-kit.local.md` に次の形式で書く:

```markdown
---
session_id: ""
iteration: 0
max_iterations: <N>
completion_promise: "<フレーズ>"
---
<PROMPT.md の全文をここに貼る>
```

`session_id: ""`(空=未所有)は必ず残す。最初のターン終了時に Stop hook が本人
セッションのIDを書き込んで所有権を確定し、以後は**同じディレクトリで動く別セッションの
終了に巻き込まれない**(誤って別セッションにループプロンプトが再投入されるのを防ぐ)。

3. ユーザーに「ループを開始します。停止は『ループ止めて』か
   `rm .claude/loop-kit.local.md`」と伝え、**そのまま PROMPT.md の作業を開始する**
   (このターンの終了がループの起点になる)

厳守事項(ループ中の自分へ):
- 完了宣言 `<promise>...</promise>` は、完了条件がすべて真のときだけ出力する。
  **行き詰まっても嘘の宣言でループを抜けない。** 上限で止まるのは正常な結果
- 毎イテレーション冒頭で git log と進捗ファイルを確認してから動く

## mode: shell — 外側シェルループ(放置型)

セッション内からは実行しない。ユーザーに別ターミナルでの実行コマンドを提示する:

```bash
"<プラグインroot>/scripts/run-loop.sh" \
  -p .loop/<slug>/PROMPT.md \
  -n <max_iterations> \
  -c "<verify_command>" \
  -t "<allowed_tools>"
```

- パスはプラグインの scripts ディレクトリ(Claude: `${CLAUDE_PLUGIN_ROOT}/scripts/`)を
  実パスに展開して提示する
- **sub-agent を隔離実行させたい場合は `-t` に `Task` を足す**と案内する
  (例: `-t "Edit,Write,Read,Glob,Grep,Bash,Task"`)。shell モードの既定ツールに
  `Task` は無いため、そのままだと PJ の `.claude/agents/`(code-review 等)を
  呼べず、レビュー等は同一コンテキストでインライン実行になる(隔離なし)。
  `loop.yaml` の `allowed_tools` に `Task` があればそれをそのまま `-t` に渡す。
  session モードは通常セッション = `Task` が元から効くので指定不要
- 隔離環境(worktree / コンテナ)なら `-d`(権限全スキップ)も選択肢と伝える
- 既存コードベースなら実行前に `git worktree add` を提案する
- このセッションで実行したい場合は `!` プレフィックスで打てるが、
  長時間ループはターミナル直接実行を推奨

**Codex の場合**は `run-loop.codex.sh` を使う(`-t allowed_tools` の代わりに
`-s sandbox`〔read-only / workspace-write / danger-full-access〕):

```bash
"<プラグインroot>/scripts/run-loop.codex.sh" \
  -p .loop/<slug>/PROMPT.md \
  -n <max_iterations> \
  -c "<verify_command>" \
  -s workspace-write
```

## mode: fanout — タスクリスト量産

1. タスクリスト `.loop/<slug>/items.txt`(1行1項目)を作る(なければユーザーと作る)
2. **まず2〜3項目のミニリストで試走**するコマンドを提示し、結果を見てプロンプトを
   改善してから全体実行へ:

```bash
# Claude:
"<プラグインroot>/scripts/fanout.sh" \
  -l .loop/<slug>/items.txt \
  -P "<prompt_template({} が各項目に置換される)>" \
  -o .loop/<slug>/fanout

# Codex(-t の代わりに -s sandbox):
"<プラグインroot>/scripts/fanout.codex.sh" \
  -l .loop/<slug>/items.txt \
  -P "<prompt_template>" \
  -s workspace-write \
  -o .loop/<slug>/fanout
```

3. 完了後は `results.csv` の FAIL 項目を確認 → /loop-review へ

## 停止(全モード共通)

- session(Claude のみ): `.claude/loop-kit.local.md` を削除する(「ループ止めて」でこれ)
- shell / fanout: 実行中ターミナルで Ctrl-C
- 終わったら /loop-review で振り返りを提案する
