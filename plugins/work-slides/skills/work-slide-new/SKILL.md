---
name: work-slide-new
description: ビジネススライド(提案書・報告書・定例資料・議事録ベース)を新規作成する。@で指定した案件ディレクトリの素材から結論ファーストで段階生成。「提案書作って」「報告資料を作りたい」「議事録を資料にして」で発動。
---

# work-slide-new — ビジネススライド新規作成

素材からスライドを段階生成する。**いきなり完成品を作らない。**
関門が2つ + 冒頭に brief(誰に・何を決めさせるか)があり、
それぞれユーザーの承認を得るまで次へ進まないこと。

## Step 0: コンテキスト収集

1. **案件ディレクトリの特定**: ユーザーが @ で指定したディレクトリを起点にする。
   未指定なら「どの案件ですか?(素材のあるディレクトリを @ で教えてください)」と聞く。
2. **職場設定の解決**: 案件ディレクトリから上へ `.work-slides/workspace.yaml` を探す。
   - あれば `company: <id>` を読み、`${CLAUDE_PLUGIN_ROOT}/companies/<id>/rules.yaml`
     (体裁規定・文体・禁則)を読み込んで以降の生成に従わせる
   - 無ければ「職場ディレクトリのルートに .work-slides/ を作りますか?
     会社パックは未設定でも既定テーマで動きます」と確認して雛形を作る
3. **文書タイプの確定**: proposal / report / regular / minutes から選ぶ(会話から自明なら確認だけ)。
   テンプレを読む: `${CLAUDE_PLUGIN_ROOT}/templates/<タイプ>.yaml`
4. regular(定例)の2回目以降は、案件の `.work-slides/outlines/` から前回の deck.json を
   読み、前回の next-action を recap セクションに自動転記する。

## Step 1: brief の確定(研究スライドとの最大の違い)

テンプレの `brief_required` をすべて埋める。**ここが曖昧なまま作り始めない**:

- **audience**: 誰に見せる?(役職・関心事)
- **decision / status**: この資料で何を決めさせたい?(exec-summary の ask になる)
- **objections**: 想定される反論・懸念(本文で先回りして潰す)

会話と素材から推定できる項目は推定で埋めて確認だけ取る。
結果を `<案件>/slides/work/<日付>_<タイプ>/brief.yaml` に書く。

## Step 2: 構成設計 → outline.yaml(★関門1: ストーリーレビュー)

テンプレの sections に素材の内容を割り付け、`slide_budget_per_min` で枚数上限を決めて
`outline.yaml` を書く。1枚ごとに:

```yaml
- n: 2
  section: summary
  layout: exec-summary        # catalog/layouts.yaml の id から選ぶ
  headline: 本日お願いしたいこと
  ask: 試験導入(3ヶ月・50万円)をご承認いただきたい   # brief の decision
  content: [...]
  time_sec: 90
```

- 見出しは主張文で書く(「〜の件」「〜について」は禁止。rules.yaml の headline_style に従う)
- brief の objections それぞれに「どのスライドで答えるか」を対応付ける(表に含めて見せる)

**ここで停止。** outline を表形式で見せ、「この順番で audience は納得するか」の観点で
構成レベルの修正(枚数・順序・主張の取捨)を反映してから先へ進む。

## Step 3: deck.json 生成(唯一の真実)

承認された outline から `deck.json` を生成する。プレビュー(Marp/HTML)と
本番(編集可能pptx)の**両方がここから生成される**。手で slides.md を書かないこと。

- スキーマ: `{ "meta": {...}, "slides": [ ... ] }`。各スライドは
  `${CLAUDE_PLUGIN_ROOT}/catalog/layouts.yaml` の各レイアウトの `deck` 例に厳密に従う
- 章立てがある資料は各章スライドに `header`(章名)を入れて上部固定表示
- 文体は rules.yaml の tone(既定: です・ます調)。confidential_label があれば footer 相当に
- 図・スクリーンショットは案件の `input/` から相対パスで参照(two-col / 画像系)
- カタログに無い表現が必要なら、近いレイアウトで作り、あとで /catalog-add を提案する

## Step 4: HTML プレビュー(★関門2: 体裁レビュー)

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> html
open <出力された .html>
```

会社パック・職場 theme.css は build.sh が自動合成する(設定不要)。
同時に **work-slide-validator エージェント**を起動して機械チェック
(文字あふれ・情報過多・画像参照切れ・スキーマ違反・rules.yaml 違反)を並走させる。
指摘は **deck.json に**反映し、承認まで繰り返す。

## Step 5: 最終ビルド(編集可能pptx)

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> pptx   # ★本番: 図形・表を保持した編集可能pptx
${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <deck.json> pdf    # 共有用 PDF が要る場合
```

完了時、brief.yaml / outline.yaml / deck.json を案件の `.work-slides/outlines/` 相当
(職場ルートではなく**案件ディレクトリ側** `<案件>/slides/` に残す)にコピーし、
定例なら次回の recap 用になることを伝える。
