# work-slides

ビジネススライド(提案書・報告書・定例資料など)を生成するプラグイン。
研究用の lab-slides と同じエンジン(deck.json 二枚看板・編集可能pptx)を積みつつ、
**結論ファースト構成**と**会社テンプレパック(転職対応)**がビジネス向けの新機軸。

> この repo は companies/ に会社の配色・ロゴ・規定を含むため **private 前提**。公開しないこと。

---

## セットアップ

必要なもの: Node.js のみ。Marp CLI は npx 経由、pptx 用の pptxgenjs は初回ビルド時に
build.sh が自動 `npm install` する(手動セットアップ不要)。

### A. 使うだけ(消費側 / どのマシンでも)

```
/plugin marketplace add <owner>/ai-marketplace     # private repo。ローカルパスでも可
/plugin install work-slides@ai-marketplace
```

動作確認(デモデッキから HTML と編集可能pptx が両方出れば正常):

```bash
<plugin>/scripts/build.sh <plugin>/catalog/demo_deck.json all
open <plugin>/catalog/demo_deck.html <plugin>/catalog/demo_deck.pptx
```

### B. カタログ・会社パックを育てる側(repo を clone するマシン)

```bash
git clone <ai-marketplace の URL>
bash <clone先>/plugins/work-slides/scripts/promote.sh init   # このマシン用に config を自動生成
```

`init` は clone 内の自分の位置から repo を検出し、
`~/.config/work-slides/config.json` にこのマシンの clone パスを書く。
マシン乗り換え時もこの2コマンドをやり直すだけ(lab-slides と同じ仕組み)。

## 最初にやること: 職場ディレクトリを作る

仕事用のディレクトリ(職場ごとに1つ)を作り、ルートに1行だけ設定を置く:

```
仕事ディレクトリ/
├── .work-slides/
│   └── workspace.yaml        ← company: <会社id> の1行だけ(未設定なら既定テーマで動く)
├── 2027-04_○○社向け提案/     ← 案件ごとにフォルダを切る
│   ├── input/                # 議事録・データ・過去資料を放り込む
│   └── slides/               # 出力(deck.json / html / 編集可能pptx)
└── 2027-05_△△定例/
```

**案件フォルダ側の設定は不要。** deck の場所から上へ辿って workspace.yaml を
自動発見するので、この配下で作る全スライドに会社の体裁が効く。

## 使い方

案件ディレクトリを @ で指定して頼む(skill は現在準備中。それまでは手動ビルド):

```
> /work-slide-new @2027-04_○○社向け提案/input 部長向けの提案書。試験導入の承認が欲しい
```

流れ(lab-slides と同じ2関門方式 + ビジネス特有の brief):

1. **brief の確認** — 誰に見せる? 何を決めさせたい? 想定される反論は?(結論ファーストの核)
2. **構成案(outline)** ← 関門1。ストーリーの順番・主張をここで直す
3. **HTML プレビュー** ← 関門2。デザイン・体裁をここで直す
4. 承認 → **編集可能 pptx** を案件の `slides/` に出力

### 手動ビルド(skill を通さない場合)

```bash
scripts/build.sh deck.json html   # プレビュー(会社パック・職場 theme.css を自動合成)
scripts/build.sh deck.json pptx   # 編集可能pptx(図形保持・ネイティブ表)
scripts/build.sh deck.json pdf    # 共有用 PDF
scripts/build.sh deck.json all    # html + pptx 一括
```

deck.json の書き方は `catalog/layouts.yaml` の各レイアウトの deck 例、
全型の実例は `catalog/demo_deck.json` を参照。

## 会社テンプレパック(転職対応の核)

会社(職場)ごとの体裁は `companies/<会社id>/` のパックに閉じ込める。
**転職・副業のたびにパックを1つ足すだけ**で、エンジン・カタログ・文書テンプレは使い回し。

```bash
scripts/promote.sh company <会社id>    # _example を複製して雛形を作る
```

パックの中身と有効化の手順は [companies/README.md](companies/README.md) を参照。
配色は `tokens.json`(共通 → 会社の深マージ)で、**HTML プレビューと pptx の両方に一括で効く**。
パックに `assets.logo` があれば表紙に自動配置される。

## レイアウトカタログ(現在12型)

| 型 | 用途 |
|---|---|
| title / agenda / section | 表紙(宛先・ロゴ)/ 目次 / 章扉(ネイビー全面) |
| **exec-summary** | 冒頭の要旨。「決めてほしいこと」を結論ボックスで先出し |
| body / two-col | 汎用の説明 / 図と説明の2カラム |
| **problem-solution** | 課題カード → 矢印 → 解決カード。提案の中核 |
| **compare** | 2〜4案の比較。recommended に「推奨」バッジ(松竹梅) |
| **table** | 費用表・機能一覧。pptx でも**ネイティブ表**(セル編集可) |
| **roadmap** | chevron の横タイムライン。導入計画・スケジュール |
| kpi / **next-action** | 数値の大書き / 誰が・何を・いつまで + 依頼メッセージ |

新しい型は lab-slides と同じ4点セット(layouts.yaml / work.css / render-pptx.js / render-marp.js)で追加。
手順は `/catalog-add` が案内する(登録先は常に開発リポジトリ。キャッシュは編集しない)。

## 二枚看板レンダラーとトークン解決(内部設計)

**唯一の真実は deck.json**。そこから2つのレンダラーが出力を生む:

```
deck.json ──▶ render-marp.js ──▶ slides.md ──▶ Marp ──▶ HTML / PDF   … 高速プレビュー
          └─▶ render-pptx.js ──────────────────────────▶ 編集可能 .pptx … ★本番(図形・表を保持)
```

体裁は3層カスケードで解決される(resolve-tokens.js):

```
共通既定(theme/tokens.json) < 会社パック(companies/<id>/) < 職場・案件(.work-slides/theme.css)
```

- 配色を変える → `tokens.json`(共通)か会社パックの `tokens.json` を編集。CSS は自動生成
- 数式・複雑な図・チャートは図形化できないので画像(PNG)で貼る(その部分は pptx でも編集不可)
- グラフは Excel 由来なら元データごと渡す運用を推奨

## lab-slides との違い(まとめ)

| | lab-slides | work-slides |
|---|---|---|
| 駆動軸 | 内容(何がわかったか) | 相手・意思決定(誰に何を決めさせるか) |
| 論理構造 | 積み上げ式 | 結論ファースト(exec-summary が先頭) |
| デザイン | Academic Ink(自分の趣味でOK) | Corporate Navy 既定 + **会社パックで上書き** |
| 中間層 | なし(2層) | **会社層あり(3層)** |
| 出力先 | 研究PJ の .lab-slides/ | 案件フォルダの slides/ |

## 今後の予定(未実装)

- `/work-slide-new` skill(brief → outline 関門 → HTML 関門 → pptx)+ validator agent
- 文書タイプ yaml テンプレ群(提案書 / 報告書 / 定例 / 議事録ベース。タイプ=yaml 1枚で追加)
- `ingest-template.js` — 会社の指定 pptx から配色・書体を吸い出してパックの tokens.json を自動生成

## トラブルシュート

- **pptx が生成されない** — 初回は build.sh が自動 `npm install` する。失敗する場合はプラグインディレクトリで手動 `npm install`
- **会社の体裁にならない** — 職場ルートに `.work-slides/workspace.yaml`(`company: <id>`)があるか、`companies/<id>/` が存在するか確認。`node scripts/resolve-tokens.js <deck.json> --company` で解決結果を見られる
- **色を変えたのに反映されない** — 編集先は tokens.json(共通 or 会社パック)。work.css の色は自動生成なので触らない
- **プラグインを編集したのに反映されない** — 実体は repo のキャッシュコピー。`/plugin update work-slides` で更新
