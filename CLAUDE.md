# ai-marketplace — 開発ガイド(Claude 向け)

この repo は Claude Code / Codex 用の自作プラグイン marketplace。**背景・思想・利用者向けの運用サイクルは [README.md](README.md) が真実**。この CLAUDE.md は「Claude がこの repo を編集するときに踏み外しやすい不変条件と手順」だけを置く(README と重複させない)。

## リポジトリ構成(1行マップ)

- `plugins/<名前>/` — 各プラグイン本体(skill / agent / hook / scripts / theme …)
- `plugins/<名前>/.claude-plugin/plugin.json` — Claude 用マニフェスト(`version` あり)
- `plugins/<名前>/.codex-plugin/plugin.json` — Codex 用マニフェスト(`version` あり)
- `.claude-plugin/marketplace.json` — **Claude 用**マーケットプレイス登録
- `.agents/plugins/marketplace.json` — **Codex 用**マーケットプレイス登録
- 各スライドプラグインには開発メモ `plugins/<名前>/CLAUDE.md` がある(触る前に読む)

## 破ってはいけない不変条件

1. **version は両マニフェストを同期して上げる。** `.claude-plugin/plugin.json` と `.codex-plugin/plugin.json` の `version` は必ず一致させる。片方だけ上げない。
2. **新プラグインは両マーケットプレイスに登録。** `.claude-plugin/marketplace.json` と `.agents/plugins/marketplace.json` の両方に1エントリ追加する。**例外: loop-kit は Claude 専用**(session モードの Stop hook が Claude Code 限定のため Codex marketplace には載せない)。
3. **機能に触れたら必ず version を上げる。** patch=バグ修正 / minor=機能追加(レイアウト追加等)/ major=破壊的変更。上げないと各マシンの `plugin update` で更新が反映されない。
4. **生成物はコミットしない。** `.gitignore` で除外済み: `*.html` / `*.pptx` / `*-merged.css`(`.lab-theme-merged.css` 等)/ 各 plugin の `theme/_tokens.css` / `catalog/demo_deck.md` / `node_modules/` / `~$*` / `.DS_Store`。ビルド後に `git status` でソースだけが変更されていることを確認する。

## リリース手順(チェックリスト)

1. プラグインを編集
2. スライド系(lab-slides / work-slides)なら **ビルド検証**: `bash plugins/<名前>/scripts/build.sh plugins/<名前>/catalog/demo_deck.json all` → html/pptx がエラーなく生成され、スライド枚数が deck.json と一致し、変更が両出力に出ること
3. **version を両マニフェスト同期**で更新(不変条件 1・3)
4. `git add` → commit(下記 trailer 付き)→ `git push origin main`
5. 各マシンで反映: `claude plugin marketplace update ai-marketplace` → `claude plugin update <名前>@ai-marketplace`(新しいセッションで hook 等が有効化)

## commit 規約

コミットメッセージの末尾に必ず:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## 収録プラグイン(型の1行サマリ)

| プラグイン | 型 | 詳細 |
|---|---|---|
| lab-slides | 研究発表スライド。deck.json → HTML + 編集可能pptx の二枚看板 | `plugins/lab-slides/CLAUDE.md` |
| work-slides | ビジネススライド。同型エンジン + 会社パック(private・転職対応) | `plugins/work-slides/CLAUDE.md` |
| paper-lab | 論文調査・原稿作成。蓄積→蒸留型 | README |
| pm-kit | 議事録・意思決定ログ。蓄積→蒸留型 | README |
| loop-kit | ループエンジニアリング。Stop hook / シェルループ / ファンアウト(**Claude 専用**) | README |

スライド2つは同型エンジンだが**共有ライブラリ化せず各自に持つ**(プラグインはキャッシュに単体コピーされ自己完結が原則)。テーマ・レイアウト・話法は別物として育てる。
