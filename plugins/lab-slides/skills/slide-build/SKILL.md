---
name: slide-build
description: 既存の deck.json からスライドを再生成・差分修正・ビルドする。「スライドの3枚目を直して」「deck からビルドし直して」「pptxにして」「PDFにして」で発動。
---

# slide-build — 再生成・修正・ビルド

既に作業ディレクトリ(`.lab-slides/work/...`)に deck.json がある前提の軽量パス。
/slide-new の Step 3〜5 だけを実行する。

## 修正の原則

- **すべての修正は deck.json に対して行う**。slides.md / .html / .pptx は deck.json から
  自動生成される派生物なので直接編集しない(次のビルドで上書きされる)
- **構成の変更**(枚数・順序)→ deck.json の slides 配列を編集
- **見た目・文言の変更** → 該当スライドオブジェクトのフィールドを編集
- レイアウトを変えるときは `catalog/layouts.yaml` の deck 例に合わせてフィールドを差し替え
- 修正のたびに `build.sh deck.json html` でプレビューを更新して見せる

## ビルド

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh deck.json html   # 確認用プレビュー
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh deck.json pptx   # ★本番: 編集可能pptx(図形保持)
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh deck.json pdf    # 提出用 PDF
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh deck.json all    # html + pptx を一括
```

大きな修正(3枚以上に影響)を反映したときは slide-validator を再実行する。
