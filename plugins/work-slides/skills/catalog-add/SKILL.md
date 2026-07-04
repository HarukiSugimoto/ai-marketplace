---
name: catalog-add
description: work-slides のレイアウトや共通画像をカタログに登録して再利用可能にする。「このレイアウトをカタログに追加して」「この型を保存して」「この画像を共通素材に」で発動(ビジネススライド側)。
---

# catalog-add — レイアウト・画像の資産化(work-slides)

作成中に生まれた良いレイアウトや共通画像を、次回以降も使える資産として登録する。

## 最重要: どこに書くか

実行時のプラグイン(`${CLAUDE_PLUGIN_ROOT}`)は**キャッシュのコピー**で、
`/plugin update` で上書きされる。**ここを編集してはいけない**(消える・git に乗らない)。

登録先は3つ(層で選ぶ):

- **プラグイン層(全職場共通)** = 開発リポジトリの原本。
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path` で解決できる。ここを編集し、
  commit → push → 各マシンで `/plugin update work-slides` で反映。
  **新レイアウト(pptx 対応)は必ずここ**(レンダラーがここにしか無いため)。
- **会社層(その会社だけ)** = repo の `companies/<会社id>/`(theme.css / tokens.json / assets)。
  会社固有の色・装飾・ロゴはこちら。反映手順はプラグイン層と同じ。
- **職場・案件層** = 職場ディレクトリの `.work-slides/theme.css`。
  その職場ローカルの見た目調整(HTML プレビューのみ)。git はその職場の管理に従う。

## 手順(レイアウトの場合)

work-slides は二枚看板(deck.json → Marp/HTML + PptxGenJS/pptx)。**新レイアウトは
4点をそろえて初めて両出力で使える**:

1. 対象スライドを特定し、固有の内容を除いて**汎用の雛形に抽象化**する
2. **登録先をユーザーに確認**(全職場共通か、会社固有の見た目調整か)
3. プラグイン層のパスを解決: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path`。
   設定が無い/パスが古い場合、promote.sh は `init` を促して停止する。その時は
   「repo を clone 済みなら `bash <clone先>/plugins/work-slides/scripts/promote.sh init`
   を一度実行」と案内する。このマシンに repo が無いなら消費専用なので、
   repo のあるマシンで行うよう伝える
4. **新レイアウトの4点セット**(id を全ファイルで一致させる):
   1. `catalog/layouts.yaml` に id / category / when / **deck**(JSON例)を追加
   2. `theme/work.css` に `section.<id>` の CSS クラスを追加(色は `var(--c-*)` のみ使用)
   3. `scripts/render-pptx.js` の `RECIPES` に `<id>(slide, s){...}` の図形レシピを追加
      (角丸長方形・矢印・表等を座標配置。既存レシピを手本に)
   4. `scripts/render-marp.js` の `switch` に `case "<id>":` を追加(deck → Markdown)
5. deck.json にそのレイアウトのテストスライドを1枚書き、
   `build.sh <deck.json> all` で HTML と pptx の両方が崩れないことを確認
6. commit と反映を案内(下記)

## 手順(共通画像の場合)

- 全職場で再利用する画像(定番の概念図・アイコン)→ プラグイン層 `assets/`:
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh asset <画像パス> [新名]`
- その会社だけの画像(ロゴ・製品写真)→ 会社パック `companies/<id>/assets/`
- その案件だけの画像 → 案件ディレクトリの `input/` にそのまま置き相対パスで参照

## 規約

- **色はトークンが唯一の真実**。共通色は `theme/tokens.json`、会社色は
  `companies/<id>/tokens.json` に足す(CSS は自動生成、pptx レシピは `C.<name>` で参照)
- CSS クラス名 = layouts.yaml の id = render-pptx.js の RECIPES キー = render-marp.js の
  case ラベル、を**すべて一致**させる
- `when:` は「いつ使うか」を具体的に(生成時のレイアウト選定はこれだけが頼り)

## 登録した後の反映

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh commit "catalog: <追加内容>"
```

その後ユーザーへ:「`git push` 済みなら、各マシンで `/plugin update work-slides` すれば
反映されます(このマシンで今すぐ使うにも update が必要)」と伝える。
