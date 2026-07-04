---
name: slide-build
description: 既存の outline.yaml や slides.md からスライドを再生成・差分修正・ビルドする。「スライドの3枚目を直して」「outline からビルドし直して」「PDFにして」で発動。
---

# slide-build — 再生成・修正・ビルド

既に作業ディレクトリ(`.lab-slides/work/...`)がある前提の軽量パス。
/slide-new の Step 3〜5 だけを実行する。

## 修正の原則

- **構成の変更**(枚数・順序・主張)→ outline.yaml を直してから slides.md を再生成
- **見た目・文言の変更** → slides.md の該当スライドだけ差分修正(全再生成しない)
- 修正のたびに `build.sh slides.md html` でプレビューを更新して見せる

## ビルド

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh slides.md html   # 確認用
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh slides.md pdf    # 提出用
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh slides.md pptx   # 画像ベース(編集不可)
```

大きな修正(3枚以上に影響)を反映したときは slide-validator を再実行する。
