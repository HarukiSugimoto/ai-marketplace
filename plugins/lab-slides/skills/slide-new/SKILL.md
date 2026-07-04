---
name: slide-new
description: 研究発表スライドを新規作成する。素材(メモ・実験ログ・論文PDF・arXiv URL)から進捗報告または学会/修論発表のスライドを段階生成。「進捗スライド作って」「発表資料を作りたい」で発動。
---

# slide-new — スライド新規作成

素材からスライドを段階生成する。**いきなり完成品を作らない。** 関門が2つあり、
それぞれでユーザーの承認を得るまで次へ進まないこと。

## Step 0: コンテキスト収集

1. **プロジェクト層の検出**: カレントディレクトリから上へ `.lab-slides/` を探す。
   あれば読み込む: `figures.yaml`(使える図の索引)、`outlines/` の最新(前回発表)、
   `overrides.yaml`(テンプレ調整)、`theme.css`(追加CSS)。
   無ければ「作りますか?」と聞き、承認されたら雛形を作る。
2. **ユーザーに確認**(まだ聞いていなければ): 発表タイプ(進捗 / 学会・修論)、持ち時間、素材の場所。
3. テンプレを読む: `${CLAUDE_PLUGIN_ROOT}/templates/{progress,conference}.yaml`
   (overrides.yaml があればマージ。プロジェクト層が優先)

## Step 1: 内容の構造化 → content.yaml

素材を読み、**スライドのことはまだ考えずに**内容を整理して
`.lab-slides/work/<日付>_<タイプ>/content.yaml` に書く:

- claims: 主張(この発表で言いたいこと。優先度順)
- evidence: 各主張の根拠(実験結果・数値・引用)
- figures: 使う図(figures.yaml の id で参照。無い図は `missing: true` で明示)
- open_questions: 未解決点・議論したい点

## Step 2: 構成設計 → outline.yaml(★関門1)

テンプレの sections に content.yaml を割り付け、持ち時間 × slide_budget_per_min で
枚数上限を決めて `outline.yaml` を書く。1枚ごとに:

```yaml
- n: 3
  section: results
  layout: figure-full        # catalog/layouts.yaml の id から選ぶ
  headline: 提案手法が全条件でベースラインを上回る   # 主張文で書く
  content: [...]
  figure: fig_main_result
  time_sec: 60
```

**ここで停止。** outline を表形式でユーザーに見せ、構成レベルの修正
(枚数・順序・主張の取捨)を反映してから先へ進む。

## Step 3: Marp Markdown 生成

承認された outline から `slides.md` を生成する。

- 冒頭: `marp: true` / `theme: lab` / `paginate: true`
- 各スライドは outline の layout に対応する `${CLAUDE_PLUGIN_ROOT}/catalog/layouts.yaml`
  の snippet を雛形にする
- 章構成のある発表(学会・修論)では表紙直後に toc(目次)を置き、
  各章の最初のスライドに `<!-- header: 章名 -->` を設定して現在章を上部に固定表示する
  (進捗報告など短い発表では省略可)
- 色・サイズは **theme/lab.css のトークン以外を直接指定しない**(インライン style の色指定禁止)
- カタログに無い表現が必要なときだけ HTML を直書きし、あとで /catalog-add を提案する

## Step 4: HTML プレビュー(★関門2)

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh slides.md html
open <出力された .html>
```

同時に **slide-validator エージェント**を起動して機械チェック(文字あふれ・情報過多・
図参照切れ・枚数と持ち時間の整合)を並走させる。
ユーザーのデザイン指摘 + validator の指摘を slides.md に反映し、承認まで繰り返す。

## Step 5: 最終ビルド

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh slides.md pdf
```

学会・修論テンプレ(generate_script: true)の場合はさらに:
- `script.md`: スライドごとの読み上げ原稿(1枚 = outline の time_sec 以内で話せる分量)
- 時間配分表(累積時間つき)

完了時、今回の outline.yaml を `.lab-slides/outlines/` にコピーして次回の recap 用に残す。
