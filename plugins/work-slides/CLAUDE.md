# work-slides 開発メモ(Claude 向け)

利用者向けの使い方は各 `skills/*/SKILL.md` が持つ。ここは**エンジンを改造するとき**の触り方だけ。repo 全体の規約は [../../CLAUDE.md](../../CLAUDE.md)。lab-slides と同型エンジンだが、**会社パックによる体裁カスケード**が加わる点が違う。

## エンジンの原則

- **`deck.json` が唯一の真実。** 2つのレンダラーが同じ deck.json を消費する:
  - `scripts/render-marp.js` → Marp Markdown → HTML/PDF(高速プレビュー)
  - `scripts/render-pptx.js` → 編集可能 pptx(PptxGenJS の図形+テキスト)
- **色・フォントは tokens のカスケードで解決。** `scripts/resolve-tokens.js` が「共通既定 `theme/tokens.json` → 会社パック `companies/<id>/tokens.json`」の優先で解決する。どの会社かは deck の場所から上へ辿った `.work-slides/workspace.yaml` の `company:` で宣言(職場ディレクトリに1回だけ。案件側は無編集)。`scripts/gen-tokens-css.js <deck.json>` が解決結果から `theme/_tokens.css` を生成。
- CSS は `theme/work.css`(lab-slides の `lab.css` に相当)。

## レイアウト追加 = 4点同期

lab-slides と同じ。新レイアウトは以下4つをそろえる:

1. `catalog/layouts.yaml` に deck スキーマ例
2. `theme/work.css` に `section.<layout>` クラス
3. `scripts/render-pptx.js` の `RECIPES` に図形レシピ
4. `scripts/render-marp.js` の `switch` に `case`

会社ごとに見た目を変えたい要素は**トークン(tokens.json)で吸収**し、レイアウトのコードは会社非依存に保つ(会社差はパックだけに閉じ込める)。

## 検証

```
bash scripts/build.sh catalog/demo_deck.json all
```

で html + pptx を両生成し、エラーなし・スライド枚数一致・先頭空スライド無し・新レイアウトが両出力に出ることを確認。会社パック依存の見た目を変えたときは、`_example` 会社(または該当会社)を宣言した workspace.yaml 下でもビルドして色解決が効くか見る。

## private の注意

`companies/` には**実在の会社の配色・ロゴ・体裁規定**が入りうる(転職時に `/company-add` で追加)。この repo は private 前提。`companies/_example/` はサンプルなので公開可能な内容だけに保つ。会社パックを足したら [../../CLAUDE.md](../../CLAUDE.md) のリリース手順に従い version を両マニフェスト同期で更新。

## コミット対象

ソースのみ。生成物 `catalog/demo_deck.{md,html,pptx}` / `theme/_tokens.css` / `*-merged.css` / `node_modules/` は gitignore 済み。
