---
name: catalog-add
description: 気に入ったスライドのレイアウトや共通画像をカタログに登録して再利用可能にする。「このレイアウトをカタログに追加して」「この型を保存して」「この画像を共通素材に」で発動。
---

# catalog-add — レイアウト・画像の資産化

作成中に生まれた良いレイアウトや共通画像を、次回以降も使える資産として登録する。
これがこのシステムの育て方の中核。

## 最重要: どこに書くか

実行時のプラグイン(`${CLAUDE_PLUGIN_ROOT}`)は**キャッシュのコピー**で、
`/plugin update` で上書きされる。**ここを編集してはいけない**(消える・git に乗らない)。

登録先は2つ:

- **プラグイン層(全プロジェクト共通)** = 開発リポジトリの原本。
  場所は `~/.config/lab-slides/config.json` の `repoPath` に記録されている。
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path` で解決できる。ここを編集し、
  commit → push → 各マシンで `/plugin update lab-slides` で反映。
  **現在ディレクトリがどこであっても行き先はここ**。
- **プロジェクト層(この研究PJ限定)** = カレントから上へ探した `.lab-slides/`。
  そのPJ限定の型・画像はこちら。git はそのPJのリポジトリに乗る。

## 手順(レイアウトの場合)

lab-slides は二枚看板(deck.json → Marp/HTML + PptxGenJS/pptx)。**新レイアウトは
4点をそろえて初めて両出力で使える**。レンダラー(render-*.js)はプラグイン層にしか無いので、
**pptx でも使いたい新レイアウトはプラグイン層に登録する必要がある**(プロジェクト層は
CSS だけで作れる既存レイアウトの見た目調整・HTMLプレビュー用途向き)。

1. 対象スライドを特定し、固有の内容を除いて**汎用の雛形に抽象化**する
2. **登録先をユーザーに確認**:
   - 完全な新レイアウトで pptx でも使う → プラグイン層(4点セットが必要)
   - 既存レイアウトの色・余白の調整、HTMLプレビュー限定 → プロジェクト層(CSS のみ)
3. 登録先のパスを解決:
   - プラグイン層: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path` の出力を使う。
     設定が無い/パスが古い場合、promote.sh は `init` を促して停止する。その時は
     「repo を clone 済みなら `bash <clone先>/plugins/lab-slides/scripts/promote.sh init`
     を一度実行」と案内する(新PCやマシン乗り換え時の再設定はこれだけ)。
     このマシンに repo が無いなら消費専用なので、repo のあるマシンで行うよう伝える
   - プロジェクト層: `.lab-slides/theme.css`(無ければ作る)
4. **新レイアウトの4点セット**(プラグイン層。id を全ファイルで一致させる):
   1. `catalog/layouts.yaml` に id / category / when / **deck**(JSON例)を追加
   2. `theme/lab.css` に `section.<id>` の CSS クラスを追加(色は `var(--c-*)` のみ使用)
   3. `scripts/render-pptx.js` の `RECIPES` に `<id>(slide, s){...}` の図形レシピを追加
      (角丸長方形・テキスト等を座標配置。既存レシピを手本に)
   4. `scripts/render-marp.js` の `switch` に `case "<id>":` を追加(deck → Markdown)
5. deck.json にそのレイアウトのテストスライドを1枚書き、
   `build.sh <deck.json> all` で HTML と pptx の両方が崩れないことを確認
6. プラグイン層に追加した場合、commit と反映を案内(下記)

## 手順(共通画像の場合)

- 全プロジェクトで再利用する画像(ロゴ・定番の概念図)→ プラグイン層 `assets/`:
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh asset <画像パス> [新名]`
  使うときは各PJの `.lab-slides/figures/` にコピーして相対パスで参照(ポータビリティ確保)
- そのPJだけの実験グラフ等 → プロジェクト層 `.lab-slides/figures/` に置き
  `figures.yaml` に索引(id / path / caption / source)を追加

## 規約

- **色は `theme/tokens.json` が唯一の真実**。新色が要るなら tokens.json に足す
  (build.sh が _tokens.css を再生成し、CSS も render-pptx.js も同じ値を使う)。
  CSS では `var(--c-*)`、pptx レシピでは `C.<name>` で参照
- CSS クラス名 = layouts.yaml の id = render-pptx.js の RECIPES キー = render-marp.js の
  case ラベル、を**すべて一致**させる
- `when:` は「いつ使うか」を具体的に(生成時のレイアウト選定はこれだけが頼り)

## プラグイン層に登録した後の反映

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh commit "catalog: <追加内容>"
```

これで開発リポジトリに commit される(autoPush 設定時は push も)。その後ユーザーへ:
「`git push` 済みなら、各マシンで `/plugin update lab-slides` すれば反映されます
(このマシンで今すぐ使うにも update が必要)」と伝える。
