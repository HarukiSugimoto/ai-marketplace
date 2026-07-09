---
name: loop-run
description: 設計済みのループ(.loop/<slug>/)を実行する。セッション内ループの開始・停止、シェルループ/ファンアウトの起動コマンド提示。「ループ回して」「ループ開始」「ループ止めて」で発動。
---

# loop-run — ループの実行

前提: `.loop/<slug>/PROMPT.md` と `loop.yaml` があること。無ければ /loop-design から。
`loop.yaml` の `mode` を読んで分岐する。

## mode: session — セッション内ループ(Stop hook)

状態ファイルを書くとこのセッションがループになる。ターン終了のたびに Stop hook が
終了をブロックし、同じプロンプトを再投入する。

1. `loop.yaml` から `max_iterations` と `completion_promise` を読む
2. `.claude/loop-kit.local.md` に次の形式で書く:

```markdown
---
iteration: 0
max_iterations: <N>
completion_promise: "<フレーズ>"
---
<PROMPT.md の全文をここに貼る>
```

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

- パスは `${CLAUDE_PLUGIN_ROOT}/scripts/run-loop.sh` を実パスに展開して提示する
- 隔離環境(worktree / コンテナ)なら `-d`(権限全スキップ)も選択肢と伝える
- 既存コードベースなら実行前に `git worktree add` を提案する
- このセッションで実行したい場合は `!` プレフィックスで打てるが、
  長時間ループはターミナル直接実行を推奨

## mode: fanout — タスクリスト量産

1. タスクリスト `.loop/<slug>/items.txt`(1行1項目)を作る(なければユーザーと作る)
2. **まず2〜3項目のミニリストで試走**するコマンドを提示し、結果を見てプロンプトを
   改善してから全体実行へ:

```bash
"<プラグインroot>/scripts/fanout.sh" \
  -l .loop/<slug>/items.txt \
  -P "<prompt_template({} が各項目に置換される)>" \
  -o .loop/<slug>/fanout
```

3. 完了後は `results.csv` の FAIL 項目を確認 → /loop-review へ

## 停止(全モード共通)

- session: `.claude/loop-kit.local.md` を削除する(「ループ止めて」と言われたらこれ)
- shell / fanout: 実行中ターミナルで Ctrl-C
- 終わったら /loop-review で振り返りを提案する
