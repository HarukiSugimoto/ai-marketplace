# lab-slides 開発メモ(Claude 向け)

利用者向けの使い方は各 `skills/*/SKILL.md` が持つ。ここは**エンジンを改造するとき**の触り方だけ。repo 全体の規約は [../../CLAUDE.md](../../CLAUDE.md)。

## エンジンの原則

- **`deck.json` が唯一の真実。** 2つのレンダラーが同じ deck.json を消費するので、プレビューと本番 pptx が必ず同じ内容になる:
  - `scripts/render-marp.js` → Marp Markdown → HTML/PDF(高速プレビュー)
  - `scripts/render-pptx.js` → 編集可能 pptx(PptxGenJS の図形+テキスト。装飾を図形として保持)
- **色・フォントは `theme/tokens.json` が単一の真実。** `scripts/gen-tokens-css.js` が `theme/_tokens.css`(Marp 用 CSS 変数)を自動生成し、pptx レンダラーは tokens.json を直接読む。色を変えるときは tokens.json だけ編集(CSS と pptx 両方に効く)。`_tokens.css` は手で編集しない/コミットしない。

## レイアウト追加 = 4点同期

新レイアウトを足すときは以下4つを必ずそろえる(1つでも欠けると片方の出力で崩れる):

1. `catalog/layouts.yaml` に deck スキーマ例(`id` / `category` / `when` / `deck`)
2. `theme/lab.css` に `section.<layout>` クラスの見た目(Marp/HTML 側)
3. `scripts/render-pptx.js` の `RECIPES` に図形レシピ(pptx 側)
4. `scripts/render-marp.js` の `switch` に `case`(Marp Markdown 生成)

## 検証

```
bash scripts/build.sh catalog/demo_deck.json all
```

で html + pptx を両生成し、以下を確認:

- エラーなく `built: …html` と `built: …pptx` が出る
- **先頭に空スライドが無い**(render-marp.js の front 連結は `front + "\n\n" + slides.join("---")`。`[front, ...slides].join("---")` にすると front と slide1 の間に区切りが入り空スラができる — 既知の踏み跡)
- md の `---` 区切り数 = front 2本 + (slide数 − 1)、pptx のスライド数 = deck.json の slides 数
- 新レイアウトが html(`section.<layout>`)と pptx(該当図形/表)の**両方**に出る

## コミット対象

ソースのみ(`scripts/` `theme/lab.css` `theme/tokens.json` `catalog/layouts.yaml` `catalog/demo_deck.json` `skills/` `agents/` `templates/` とマニフェスト)。生成物 `catalog/demo_deck.{md,html,pptx}` / `theme/_tokens.css` / `*-merged.css` / `node_modules/` は gitignore 済み。
