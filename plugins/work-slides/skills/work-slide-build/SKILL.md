---
name: work-slide-build
description: 既存の deck.json からビジネススライドを再生成・差分修正・ビルドする。「3枚目を直して」「pptxにして」「PDFにして」「ビルドし直して」で発動。
---

# work-slide-build — 再生成・修正・ビルド

既に案件ディレクトリに deck.json がある前提の軽量パス。
/work-slide-new の Step 3〜5 だけを実行する。

## 修正の原則

- **すべての修正は deck.json に対して行う**。slides.md / .html / .pptx は deck.json から
  自動生成される派生物なので直接編集しない(次のビルドで上書きされる)
- **構成の変更**(枚数・順序)→ deck.json の slides 配列を編集
- **見た目・文言の変更** → 該当スライドオブジェクトのフィールドを編集
- レイアウトを変えるときは `catalog/layouts.yaml` の deck 例に合わせてフィールドを差し替え
- **体裁(色・書体)の変更** → deck.json ではなく会社パックの tokens.json
  (`companies/<id>/tokens.json`)。個人の好みでなく会社の規定に合わせる
- 修正のたびに `build.sh <deck.json> html` でプレビューを更新して見せる

## ビルド

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> html   # 確認用プレビュー
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> pptx   # ★本番: 編集可能pptx(図形・表を保持)
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> pdf    # 共有用 PDF
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> all    # html + pptx を一括
```

会社の体裁が効かないときは `node ${CLAUDE_PLUGIN_ROOT}/scripts/resolve-tokens.js <deck.json> --company`
で解決結果を確認する(空なら workspace.yaml が見つかっていない)。

大きな修正(3枚以上に影響)を反映したときは work-slide-validator を再実行する。
